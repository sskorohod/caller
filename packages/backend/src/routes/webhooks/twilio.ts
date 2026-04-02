import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { telephonyConnections, workspaces } from '../../db/schema.js';
import * as callService from '../../services/call.service.js';
import * as telephonyService from '../../services/telephony.service.js';
import * as agentService from '../../services/agent.service.js';
import { deliverWebhookEvent } from '../../services/webhook.service.js';
import { env } from '../../config/env.js';
import { validateTwilioSignature } from '../../middleware/twilio-auth.js';
import { calls, providerCredentials } from '../../db/schema.js';
import { getIo } from '../../realtime/io.js';
import * as memoryService from '../../services/memory.service.js';
import { sendCallNotification } from '../../services/telegram.service.js';
import { decrypt } from '../../lib/crypto.js';

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
    const agentProfileId = connection.default_agent_profile_id;

    let agentProfile = agentProfileId
      ? await agentService.getAgentProfile(workspace.id, agentProfileId)
      : await agentService.getDefaultAgentProfile(workspace.id);

    if (!agentProfile) {
      reply.type('text/xml').send('<Response><Say>No agent configured. Goodbye.</Say><Hangup/></Response>');
      return;
    }

    const call = await callService.createCall({
      workspaceId: workspace.id,
      direction: 'inbound',
      fromNumber: callerNumber,
      toNumber: calledNumber,
      telephonyConnectionId: connection.id,
      conversationOwnerRequested: workspace.conversation_owner_default as any,
      agentProfileId: agentProfile.id,
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
          const creds = JSON.parse(decrypt(telegramCreds.credential_data)) as { bot_token: string; chat_id: string };
          sendCallNotification(creds.bot_token, creds.chat_id, {
            phone: callerNumber,
            name: profile.name,
            company: profile.company,
            total_calls: profile.total_calls,
            agent_name: agentProfile.display_name,
            recent_facts: facts.map(f => f.content),
          }).catch(() => {});
        }
      } catch {
        // Non-critical — don't fail the call
      }
    })();

    const streamUrl = `wss://${env.API_DOMAIN}/webhooks/ws/media-stream/${call.id}`;
    const disclosure = workspace.call_recording_disclosure
      ? (agentProfile.language === 'ru'
        ? 'Этот звонок может быть записан для повышения качества обслуживания.'
        : 'This call may be recorded for quality purposes.')
      : undefined;

    const twiml = telephonyService.generateInboundTwiml({
      callId: call.id,
      streamUrl,
      disclosureMessage: disclosure,
    });

    reply.type('text/xml').send(twiml);
  });

  app.post('/status', async (request, reply) => {
    const body = statusSchema.parse(request.body);
    const callSid = body.CallSid;
    const callStatus = body.CallStatus;
    const duration = body.CallDuration;

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
      duration_seconds: duration ? parseInt(duration, 10) : undefined,
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
        duration_seconds: duration ? parseInt(duration, 10) : null,
      });
    }

    // Deliver outbound webhooks based on status
    if (ourStatus === 'in_progress') {
      deliverWebhookEvent(call.workspace_id, 'call.started', {
        call_id: call.id,
        twilio_call_sid: callSid,
        status: ourStatus,
      }).catch(() => {});
    } else if (ourStatus === 'completed') {
      deliverWebhookEvent(call.workspace_id, 'call.completed', {
        call_id: call.id,
        twilio_call_sid: callSid,
        status: ourStatus,
        duration_seconds: duration ? parseInt(duration, 10) : null,
      }).catch(() => {});
    } else if (ourStatus === 'failed') {
      deliverWebhookEvent(call.workspace_id, 'call.failed', {
        call_id: call.id,
        twilio_call_sid: callSid,
        status: ourStatus,
        twilio_status: callStatus,
      }).catch(() => {});
    }

    reply.status(200).send('OK');
  });

  // POST /webhooks/twilio/recording — Twilio sends recording URL when ready
  app.post('/recording', async (request, reply) => {
    const body = recordingSchema.parse(request.body);

    if (body.RecordingStatus !== 'completed') {
      reply.status(200).send('OK');
      return;
    }

    // Find call by Twilio SID
    const [call] = await db.select({ id: calls.id, workspace_id: calls.workspace_id })
      .from(calls)
      .where(eq(calls.twilio_call_sid, body.CallSid));

    if (!call) {
      reply.status(200).send('OK');
      return;
    }

    // Find AI session for this call and save recording URL
    const [session] = await db.select({ id: aiCallSessions.id })
      .from(aiCallSessions)
      .where(eq(aiCallSessions.call_id, call.id));

    if (session) {
      const durationSeconds = body.RecordingDuration ? parseInt(body.RecordingDuration, 10) : null;

      // Try to store in MinIO, fall back to Twilio URL
      let recordingUrl = `${body.RecordingUrl}.mp3`;
      try {
        const { storeRecording, isMinioConfigured } = await import('../../services/recording-storage.service.js');
        if (isMinioConfigured()) {
          const minioKey = await storeRecording({
            twilioRecordingUrl: body.RecordingUrl,
            callSid: body.CallSid,
            recordingSid: body.RecordingSid,
            workspaceId: call.workspace_id,
          });
          if (minioKey) {
            recordingUrl = `minio://${minioKey}`; // Store as minio:// scheme
          }
        }
      } catch (err) {
        // MinIO failed — keep Twilio URL
      }

      await db.update(aiCallSessions)
        .set({
          recording_url: recordingUrl,
          recording_duration_seconds: durationSeconds,
        })
        .where(eq(aiCallSessions.id, session.id));
    }

    await callService.addCallEvent({
      callId: call.id,
      workspaceId: call.workspace_id,
      eventType: 'recording_completed',
      eventData: {
        recording_sid: body.RecordingSid,
        recording_url: body.RecordingUrl,
        duration: body.RecordingDuration,
      },
    });

    reply.status(200).send('OK');
  });
};

export default twilioRoutes;
