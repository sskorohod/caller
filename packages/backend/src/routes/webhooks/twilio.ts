import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { telephonyConnections, workspaces } from '../../db/schema.js';
import * as callService from '../../services/call.service.js';
import * as telephonyService from '../../services/telephony.service.js';
import * as agentService from '../../services/agent.service.js';
import { deliverWebhookEvent } from '../../services/webhook.service.js';
import { env } from '../../config/env.js';
import { normalizePhone } from '../../lib/phone.js';
import { validateTwilioSignature } from '../../middleware/twilio-auth.js';
import { calls, providerCredentials } from '../../db/schema.js';
import { getIo } from '../../realtime/io.js';
import * as memoryService from '../../services/memory.service.js';
import { sendCallNotification } from '../../services/telegram.service.js';
import { decrypt } from '../../lib/crypto.js';
import { trackError } from '../../lib/error-tracker.js';

const inboundSchema = z.object({
  Called: z.string().optional(),
  To: z.string().optional(),
  Caller: z.string().optional(),
  From: z.string().optional(),
  CallSid: z.string().min(1),
});

const statusSchema = z.object({
  CallSid: z.string().min(1),
  CallStatus: z.string().min(1),
  CallDuration: z.string().optional(),
});

import { aiCallSessions } from '../../db/schema.js';

const recordingSchema = z.object({
  CallSid: z.string().min(1),
  RecordingSid: z.string().min(1),
  RecordingUrl: z.string().url(),
  RecordingStatus: z.string(),
  RecordingDuration: z.string().optional(),
});

const twilioRoutes: FastifyPluginAsync = async (app) => {
  // Twilio sends application/x-www-form-urlencoded
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        done(null, Object.fromEntries(new URLSearchParams(body as string).entries()));
      } catch (e) {
        done(e as Error, undefined);
      }
    },
  );

  app.addHook('onRequest', validateTwilioSignature);

  app.post('/inbound', async (request, reply) => {
    const body = inboundSchema.parse(request.body);
    const calledNumber = body.Called ?? body.To;
    const callerNumber = body.Caller ?? body.From;
    const callSid = body.CallSid;

    if (!calledNumber || !callerNumber) {
      reply.status(400).send('Missing phone numbers');
      return;
    }

    // Find connection + workspace via join
    const rows = await db.select({
      connection: telephonyConnections,
      workspace: workspaces,
    })
      .from(telephonyConnections)
      .innerJoin(workspaces, eq(telephonyConnections.workspace_id, workspaces.id))
      .where(and(
        eq(telephonyConnections.phone_number, calledNumber),
        eq(telephonyConnections.ai_answering_enabled, true),
      ))
      .limit(1);

    const row = rows[0];
    if (!row) {
      reply.type('text/xml').send('<Response><Say>This number is not configured. Goodbye.</Say><Hangup/></Response>');
      return;
    }

    const { connection, workspace } = row;

    // --- Check if caller has a workspace with phone_number (translator user) ---
    const callerNormalized = normalizePhone(callerNumber);
    const [callerWorkspace] = await db
      .select()
      .from(workspaces)
      .where(sql`${workspaces.phone_numbers} @> ${JSON.stringify([callerNormalized])}::jsonb`)
      .limit(1);

    const isTranslatorCall = !!callerWorkspace;

    if (isTranslatorCall) {
      const translatorBalance = parseFloat(callerWorkspace.balance_usd as string);
      const wsDefs = (callerWorkspace.translator_defaults as Record<string, string>) || {};

      if (translatorBalance <= 0) {
        const myLang = wsDefs.my_language || 'en';
        const noBalanceTwiml = new (await import('twilio')).default.twiml.VoiceResponse();
        noBalanceTwiml.say({ voice: myLang === 'ru' ? 'Polly.Tatyana' : 'Polly.Joanna' },
          myLang === 'ru'
            ? 'Ваш баланс исчерпан. Пожалуйста, пополните баланс для использования переводчика.'
            : 'Your balance is depleted. Please top up to use the translator service.');
        noBalanceTwiml.hangup();
        reply.type('text/xml').send(noBalanceTwiml.toString());
        return;
      }

      // Create call record for translator session
      const translatorCall = await callService.createCall({
        workspaceId: workspace.id,
        direction: 'inbound',
        fromNumber: callerNumber,
        toNumber: calledNumber,
        telephonyConnectionId: connection.id,
        conversationOwnerRequested: 'internal',
        metadata: {
          call_type: 'translator',
          caller_workspace_id: callerWorkspace.id,
          greeting_text: wsDefs.greeting_text || '',
        },
      });

      await callService.updateCallStatus(translatorCall.id, 'in_progress', {
        twilio_call_sid: callSid,
      } as any);

      // Start recording for translator call
      telephonyService.startCallRecording(workspace.id, callSid)
        .catch((err: unknown) => { app.log.warn({ err, callId: translatorCall.id }, 'Failed to start recording on translator call'); });

      // Create AI session for cost tracking
      await callService.createAiSession({
        callId: translatorCall.id,
        workspaceId: workspace.id,
        conversationOwner: 'internal',
      });

      // Send Telegram notifications (fire-and-forget)
      (async () => {
        try {
          const { providerCredentials, workspaceMembers } = await import('../../db/schema.js');
          const { decrypt } = await import('../../lib/crypto.js');
          const { sendTranslatorSessionStart, sendAdminTranslatorStart } = await import('../../services/telegram.service.js');

          const shareToken = await callService.createShareToken(translatorCall.id);
          const liveUrl = `https://${env.API_DOMAIN}/translate/${shareToken}`;

          // Notify the user
          const [telegramCreds] = await db.select({ credential_data: providerCredentials.credential_data }).from(providerCredentials)
            .where(and(eq(providerCredentials.workspace_id, callerWorkspace.id), eq(providerCredentials.provider, 'telegram')));
          if (telegramCreds) {
            try {
              const creds = JSON.parse(decrypt(telegramCreds.credential_data)) as { bot_token: string; chat_id: string };
              if (creds.bot_token && creds.chat_id) {
                await sendTranslatorSessionStart(creds.bot_token, creds.chat_id, {
                  subscriberName: callerWorkspace.name,
                  liveUrl,
                });
              }
            } catch { /* non-critical */ }
          }

          // Notify admin (platform owner)
          const [adminTg] = await db
            .select({ credential_data: providerCredentials.credential_data })
            .from(providerCredentials)
            .innerJoin(workspaceMembers, and(
              eq(workspaceMembers.workspace_id, providerCredentials.workspace_id),
              eq(workspaceMembers.role, 'owner'),
            ))
            .where(eq(providerCredentials.provider, 'telegram'))
            .limit(1);
          if (adminTg) {
            try {
              const adminCreds = JSON.parse(decrypt(adminTg.credential_data)) as { bot_token: string; chat_id: string };
              if (adminCreds.bot_token && adminCreds.chat_id) {
                await sendAdminTranslatorStart(adminCreds.bot_token, adminCreds.chat_id, {
                  subscriberName: callerWorkspace.name,
                  callerPhone: callerNumber,
                  liveUrl,
                });
              }
            } catch { /* non-critical */ }
          }

          app.log.info({ callId: translatorCall.id, liveUrl }, 'Telegram notification sent');
        } catch (err) {
          app.log.error({ err }, 'Failed to send Telegram notification');
        }
      })();

      // Return TwiML: connect directly to media stream (greeting spoken by Grok Voice Agent)
      const twiml = new (await import('twilio')).default.twiml.VoiceResponse();
      const connect = twiml.connect();
      connect.stream({
        url: `wss://${env.API_DOMAIN}/webhooks/ws/media-stream/${translatorCall.id}`,
        name: `translator-${translatorCall.id}`,
      });

      app.log.info({ callId: translatorCall.id, user: callerWorkspace.name, phone: callerNormalized }, 'Translator call connected');
      reply.type('text/xml').send(twiml.toString());
      return;
    }

    // --- Regular inbound call flow ---
    const agentProfileId = connection.default_agent_profile_id;

    let agentProfile = agentProfileId
      ? await agentService.getAgentProfile(workspace.id, agentProfileId)
      : await agentService.getDefaultAgentProfile(workspace.id);

    if (!agentProfile) {
      reply.type('text/xml').send('<Response><Say>No agent configured. Goodbye.</Say><Hangup/></Response>');
      return;
    }

    // Find or create caller profile for memory
    const callerProfile = await memoryService.findOrCreateCallerProfile(workspace.id, callerNumber);

    const call = await callService.createCall({
      workspaceId: workspace.id,
      direction: 'inbound',
      fromNumber: callerNumber,
      toNumber: calledNumber,
      telephonyConnectionId: connection.id,
      conversationOwnerRequested: workspace.conversation_owner_default as any,
      agentProfileId: agentProfile.id,
      callerProfileId: callerProfile.id,
    });

    await callService.updateCallStatus(call.id, 'ringing', {
      twilio_call_sid: callSid,
    } as any);

    await callService.createAiSession({
      callId: call.id,
      workspaceId: workspace.id,
      agentProfileId: agentProfile.id,
      conversationOwner: workspace.conversation_owner_default as any,
      promptSnapshot: agentProfile.system_prompt ?? undefined,
    });

    await callService.addCallEvent({
      callId: call.id,
      workspaceId: workspace.id,
      eventType: 'inbound_call_received',
      eventData: { callerNumber, calledNumber, callSid },
    });

    // --- Real-time notifications (fire-and-forget) ---
    (async () => {
      try {
        const profile = await memoryService.findOrCreateCallerProfile(workspace.id, callerNumber);
        const facts = await memoryService.getUnresolvedFacts(profile.id, 5);

        // Socket.IO event
        const io = getIo();
        if (io) {
          io.to(`workspace:${workspace.id}`).emit('call:incoming', {
            call_id: call.id,
            from_number: callerNumber,
            to_number: calledNumber,
            direction: 'inbound',
            agent_name: agentProfile.display_name,
            caller: {
              name: profile.name,
              company: profile.company,
              total_calls: profile.total_calls,
              last_call_at: profile.last_call_at,
              recent_facts: facts.map(f => f.content),
            },
          });
        }

        // Telegram notification
        const [telegramCreds] = await db
          .select()
          .from(providerCredentials)
          .where(and(
            eq(providerCredentials.workspace_id, workspace.id),
            eq(providerCredentials.provider, 'telegram'),
          ));

        if (telegramCreds) {
          let creds: { bot_token: string; chat_id: string };
          try { creds = JSON.parse(decrypt(telegramCreds.credential_data)); } catch { return; }
          // Generate share token for monitor link
          const shareToken = await callService.createShareToken(call.id);
          const monitorUrl = `https://${env.API_DOMAIN}/calls/${call.id}/monitor?token=${shareToken}`;
          sendCallNotification(creds.bot_token, creds.chat_id, {
            phone: callerNumber,
            direction: 'inbound',
            name: profile.name,
            company: profile.company,
            total_calls: profile.total_calls,
            agent_name: agentProfile.display_name,
            recent_facts: facts.map(f => f.content),
            monitor_url: monitorUrl,
          }).catch((err: unknown) => { app.log.warn({ err }, 'Telegram notification failed'); });
        }
      } catch (err) {
        trackError(err, { service: 'twilio-inbound', callId: call.id, workspaceId: workspace.id });
      }
    })();

    // Hold TwiML — wait for operator to answer/reject, or auto-answer by agent
    const autoAnswerDelay = (workspace as any).inbound_auto_answer_delay_seconds ?? 30;
    const holdTwiml = new (await import('twilio')).default.twiml.VoiceResponse();
    if (workspace.call_recording_disclosure) {
      holdTwiml.say({ voice: 'Polly.Joanna' },
        agentProfile.language === 'ru'
          ? 'Пожалуйста, подождите. Ваш звонок будет обработан в ближайшее время.'
          : 'Please hold. Your call will be answered shortly.');
    }
    holdTwiml.pause({ length: Math.max(autoAnswerDelay + 5, 65) });
    holdTwiml.say({ voice: 'Polly.Joanna' }, 'We are sorry, no one is available right now. Goodbye.');

    // Auto-answer timer: if operator doesn't respond, AI agent takes over
    const callId = call.id;
    const wsId = workspace.id;
    setTimeout(async () => {
      try {
        const [currentCall] = await db.select().from(calls).where(eq(calls.id, callId));
        if (currentCall && currentCall.status === 'ringing') {
          // Auto-answer with AI agent
          const streamUrl = `wss://${env.API_DOMAIN}/webhooks/ws/media-stream/${callId}`;
          const twiml = telephonyService.generateInboundTwiml({ callId, streamUrl });
          await telephonyService.updateActiveCall(wsId, callSid, twiml);
          await callService.updateCallStatus(callId, 'in_progress', {
            conversation_owner_actual: 'internal',
          } as any);
          // Start recording on auto-answered inbound call
          telephonyService.startCallRecording(wsId, callSid)
            .catch((err: unknown) => { app.log.warn({ err, callId }, 'Failed to start recording on auto-answered call'); });
          const io = getIo();
          if (io) {
            io.to(`workspace:${wsId}`).emit('call:answered', { call_id: callId, mode: 'internal', auto: true });
          }
          app.log.info({ callId, autoAnswerDelay }, 'Inbound call auto-answered by AI agent');
        }
      } catch (err) {
        app.log.error({ err, callId }, 'Auto-answer failed');
      }
    }, autoAnswerDelay * 1000);

    // Send auto_answer_delay to frontend via Socket.IO
    const io2 = getIo();
    if (io2) {
      io2.to(`workspace:${workspace.id}`).emit('call:incoming:config', {
        call_id: call.id,
        auto_answer_delay_seconds: autoAnswerDelay,
      });
    }

    reply.type('text/xml').send(holdTwiml.toString());
  });

  app.post('/status', async (request, reply) => {
    const body = statusSchema.parse(request.body);
    const callSid = body.CallSid;
    const callStatus = body.CallStatus;
    const duration = body.CallDuration;

    app.log.info({ callSid, callStatus, duration, rawBody: request.body }, 'Twilio status callback');

    const [call] = await db.select({ id: calls.id, workspace_id: calls.workspace_id })
      .from(calls)
      .where(eq(calls.twilio_call_sid, callSid));

    if (!call) {
      reply.status(200).send('OK');
      return;
    }

    const statusMap: Record<string, string> = {
      'initiated': 'initiated',
      'ringing': 'ringing',
      'in-progress': 'in_progress',
      'completed': 'completed',
      'busy': 'failed',
      'no-answer': 'failed',
      'canceled': 'canceled',
      'failed': 'failed',
    };

    const ourStatus = statusMap[callStatus] ?? callStatus;

    await callService.updateCallStatus(call.id, ourStatus as any, {
      twilio_status: callStatus,
      duration_seconds: duration && /^\d+$/.test(duration) ? parseInt(duration, 10) : undefined,
    } as any);

    await callService.addCallEvent({
      callId: call.id,
      workspaceId: call.workspace_id,
      eventType: `twilio_status_${callStatus}`,
      eventData: { callSid, callStatus, duration },
    });

    // Emit real-time status update
    const io = getIo();
    if (io) {
      io.to(`workspace:${call.workspace_id}`).emit('call:status', {
        call_id: call.id,
        status: ourStatus,
        twilio_status: callStatus,
        duration_seconds: duration && /^\d+$/.test(duration) ? parseInt(duration, 10) : null,
      });
    }

    // Deliver outbound webhooks based on status
    if (ourStatus === 'in_progress') {
      deliverWebhookEvent(call.workspace_id, 'call.started', {
        call_id: call.id,
        twilio_call_sid: callSid,
        status: ourStatus,
      }).catch((err: unknown) => { app.log.warn({ err, callId: call.id }, 'Webhook delivery failed for call.started'); });
    } else if (ourStatus === 'completed') {
      deliverWebhookEvent(call.workspace_id, 'call.completed', {
        call_id: call.id,
        twilio_call_sid: callSid,
        status: ourStatus,
        duration_seconds: duration && /^\d+$/.test(duration) ? parseInt(duration, 10) : null,
      }).catch((err: unknown) => { app.log.warn({ err, callId: call.id }, 'Webhook delivery failed for call.completed'); });

      // Recording webhook safety net: Twilio occasionally drops /recording callbacks.
      // Wait 30s (for Twilio to finalize the recording), then poll and persist if missing.
      setTimeout(() => {
        (app as any).__pollTwilioRecordings(callSid, call.workspace_id).catch(() => { /* logged inside */ });
      }, 30_000);
    } else if (ourStatus === 'failed') {
      deliverWebhookEvent(call.workspace_id, 'call.failed', {
        call_id: call.id,
        twilio_call_sid: callSid,
        status: ourStatus,
        twilio_status: callStatus,
      }).catch((err: unknown) => { app.log.warn({ err, callId: call.id }, 'Webhook delivery failed for call.failed'); });
    }

    reply.status(200).send('OK');
  });

  /**
   * Fetch a Twilio recording, upload to MinIO, and persist the URL on the AI session.
   * Idempotent: skips if the session already has recording_url set.
   * Used by both the webhook handler and the fallback poller.
   */
  async function persistRecording(params: {
    callSid: string;
    recordingSid: string;
    recordingUrl: string; // no .mp3 suffix
    recordingDuration?: string;
  }): Promise<boolean> {
    const [call] = await db.select({ id: calls.id, workspace_id: calls.workspace_id })
      .from(calls)
      .where(eq(calls.twilio_call_sid, params.callSid));
    if (!call) {
      app.log.warn({ callSid: params.callSid, recordingSid: params.recordingSid }, 'persistRecording — no call found for CallSid');
      return false;
    }

    const [session] = await db.select({ id: aiCallSessions.id, recording_url: aiCallSessions.recording_url })
      .from(aiCallSessions)
      .where(eq(aiCallSessions.call_id, call.id));
    if (!session) {
      app.log.warn({ callId: call.id, callSid: params.callSid }, 'persistRecording — no AI session found for call');
      return false;
    }
    if (session.recording_url) {
      // Already saved by an earlier webhook delivery — don't re-upload.
      return true;
    }

    const durationSeconds = params.recordingDuration ? parseInt(params.recordingDuration, 10) : null;
    let recordingUrl = `${params.recordingUrl}.mp3`;

    try {
      const { storeRecording, isMinioConfigured } = await import('../../services/recording-storage.service.js');
      if (isMinioConfigured()) {
        const { getTwilioCreds } = await import('../../services/telephony.service.js');
        let twilioAccountSid: string | undefined;
        let twilioAuthToken: string | undefined;
        try {
          const creds = await getTwilioCreds(call.workspace_id);
          twilioAccountSid = creds.account_sid;
          twilioAuthToken = creds.auth_token;
        } catch { /* proceed without auth */ }

        const minioKey = await storeRecording({
          twilioRecordingUrl: params.recordingUrl,
          callSid: params.callSid,
          recordingSid: params.recordingSid,
          workspaceId: call.workspace_id,
          twilioAccountSid,
          twilioAuthToken,
        });
        if (minioKey) recordingUrl = `minio://${minioKey}`;
      }
    } catch (err) {
      app.log.warn({ err, callSid: params.callSid }, 'MinIO storage failed, falling back to Twilio URL');
    }

    await db.update(aiCallSessions)
      .set({ recording_url: recordingUrl, recording_duration_seconds: durationSeconds })
      .where(eq(aiCallSessions.id, session.id));

    await callService.addCallEvent({
      callId: call.id,
      workspaceId: call.workspace_id,
      eventType: 'recording_completed',
      eventData: {
        recording_sid: params.recordingSid,
        recording_url: params.recordingUrl,
        duration: params.recordingDuration,
      },
    });

    app.log.info({ callId: call.id, sessionId: session.id, recordingUrl }, 'Recording URL saved to AI session');
    return true;
  }

  /**
   * Fallback poller — used when Twilio's /recording webhook isn't delivered.
   * Waits a short delay, then fetches recordings for the call via Twilio REST API
   * and persists any that haven't been saved yet.
   */
  async function pollTwilioRecordings(callSid: string, workspaceId: string): Promise<void> {
    try {
      const [call] = await db.select({ id: calls.id })
        .from(calls)
        .where(eq(calls.twilio_call_sid, callSid));
      if (!call) return;

      const [session] = await db.select({ recording_url: aiCallSessions.recording_url })
        .from(aiCallSessions)
        .where(eq(aiCallSessions.call_id, call.id));
      if (session?.recording_url) return; // webhook already delivered

      const { getTwilioClient } = await import('../../services/telephony.service.js');
      const client = await getTwilioClient(workspaceId);
      const recordings = await client.calls(callSid).recordings.list({ limit: 5 });
      const completed = recordings.filter(r => r.status === 'completed');
      if (completed.length === 0) {
        app.log.info({ callSid }, 'Fallback: no completed recordings found in Twilio');
        return;
      }

      app.log.info({ callSid, count: completed.length }, 'Fallback: persisting Twilio recordings (webhook missed)');
      for (const rec of completed) {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${rec.accountSid}/Recordings/${rec.sid}`;
        await persistRecording({
          callSid,
          recordingSid: rec.sid,
          recordingUrl: url,
          recordingDuration: rec.duration ?? undefined,
        });
      }
    } catch (err) {
      app.log.error({ err, callSid }, 'Fallback recording poll failed');
    }
  }

  // Expose for status webhook below
  (app as any).__pollTwilioRecordings = pollTwilioRecordings;

  // POST /webhooks/twilio/recording — Twilio sends recording URL when ready
  app.post('/recording', async (request, reply) => {
    const body = recordingSchema.parse(request.body);

    app.log.info({
      callSid: body.CallSid,
      recordingSid: body.RecordingSid,
      recordingStatus: body.RecordingStatus,
      recordingDuration: body.RecordingDuration,
    }, 'Recording webhook received');

    if (body.RecordingStatus !== 'completed') {
      app.log.info({ callSid: body.CallSid, status: body.RecordingStatus }, 'Recording webhook — non-completed status, ignoring');
      reply.status(200).send('OK');
      return;
    }

    await persistRecording({
      callSid: body.CallSid,
      recordingSid: body.RecordingSid,
      recordingUrl: body.RecordingUrl,
      recordingDuration: body.RecordingDuration,
    });

    reply.status(200).send('OK');
  });

  // POST /webhooks/twilio/voice-client — TwiML App webhook for browser-initiated calls
  app.post('/voice-client', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const to = body.To || body.to;
    const callId = body.CallId || body.callId;
    const voiceTranslate = body.VoiceTranslate === 'true';

    const twiml = new (await import('twilio')).default.twiml.VoiceResponse();

    if (to && to.startsWith('+')) {
      // Resolve outbound number from call record (preferred) or fallback to first outbound connection
      let callerNumber: string | null = null;
      let workspaceId: string | null = null;
      if (callId) {
        const [call] = await db.select().from(calls).where(eq(calls.id, callId));
        if (call) {
          callerNumber = call.from_number;
          workspaceId = call.workspace_id;
        }
      }
      if (!callerNumber) {
        const [conn] = await db.select().from(telephonyConnections)
          .where(eq(telephonyConnections.outbound_enabled, true))
          .limit(1);
        if (conn) callerNumber = conn.phone_number;
      }

      if (callerNumber) {
        // Always use <Connect><Stream> for dialer calls (supports mid-call translate toggle)
        const connect = twiml.connect();
        connect.stream({
          url: `wss://${env.API_DOMAIN}/webhooks/ws/media-stream/${callId || 'browser'}`,
          name: `call-${callId || Date.now()}`,
        });
        // Backend initiates callee call separately via REST API
      } else {
        twiml.say('No outbound number configured.');
      }
    } else {
      twiml.say('Call not supported.');
    }

    reply.type('text/xml').send(twiml.toString());
  });
};

export default twilioRoutes;
