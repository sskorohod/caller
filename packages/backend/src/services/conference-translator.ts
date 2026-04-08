import { EventEmitter } from 'node:events';
import pino from 'pino';
import { WebSocket } from 'ws';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../config/db.js';
import { translatorSubscribers, translatorSessions, calls as callsTable, workspaces as workspacesSchema } from '../db/schema.js';
import { getIo } from '../realtime/io.js';
import * as callService from './call.service.js';
import { queuePostCallProcessing } from '../workers/post-call.worker.js';
import { calculateSTTCost, calculateTelephonyCost } from '../config/pricing.js';
import { sendTranslatorSessionStart, sendTranslatorSessionEnd } from './telegram.service.js';
import { decrypt } from '../lib/crypto.js';
import { providerCredentials, callShareTokens } from '../db/schema.js';
import { env } from '../config/env.js';

const log = pino({ name: 'conference-translator' });

interface ConferenceTranslatorOptions {
  callId: string;
  workspaceId: string;
  subscriberId: string;
  myLanguage: string;       // subscriber's language (e.g. 'ru')
  targetLanguage: string;   // other party's language (e.g. 'en')
  mode: 'voice' | 'text' | 'both';
  whoHears: 'subscriber' | 'both';
  ttsProvider: string;
  ttsVoiceId?: string;
  tone?: string;
  socket: WebSocket;        // Twilio media stream WebSocket
  streamSid: string;        // Twilio stream SID
}

const LANG_NAMES: Record<string, string> = {
  en: 'English', ru: 'Russian', es: 'Spanish', de: 'German', fr: 'French',
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  neutral: 'Translate naturally, preserving the original tone and meaning.',
  business: 'Use a professional, formal business tone. Remove filler words (um, uh, er, hmm). Use clear, precise language appropriate for business meetings and appointments.',
  friendly: 'Use a warm, casual, friendly tone. Keep the conversational feel natural and relaxed.',
  medical: 'Use precise medical terminology. Translate accurately without simplifying medical terms. Maintain a calm, professional tone.',
  legal: 'Use precise legal terminology. Translate accurately without paraphrasing legal concepts. Maintain a formal, authoritative tone.',
};

/**
 * Conference Translator — uses xAI Grok Voice Agent API for speech-to-speech
 * translation with minimal latency. Single WebSocket replaces STT+LLM+TTS pipeline.
 *
 * Audio flow:
 *   mixed audio (mulaw 8kHz) → Grok Voice Agent → translated audio (mulaw 8kHz) → inject
 */
export class ConferenceTranslator extends EventEmitter {
  private callId: string;
  private workspaceId: string;
  private subscriberId: string;
  private myLang: string;
  private targetLang: string;
  private mode: 'voice' | 'text' | 'both';
  private whoHears: 'subscriber' | 'both';

  private grokWs: WebSocket | null = null;
  private twilioSocket: WebSocket;
  private streamSid: string;
  private ttsVoiceId?: string;
  private tone: string;

  private transcript: Array<{ speaker: string; text: string; lang: string; translated: string; timestamp: string }> = [];
  private sessionId: string | null = null;
  private startTime: number = Date.now();
  private saved: boolean = false;
  private safetyTimer?: ReturnType<typeof setTimeout>;

  // Accumulate transcript text from Grok responses
  private currentInputTranscript: string = '';
  private currentOutputTranscript: string = '';

  constructor(options: ConferenceTranslatorOptions) {
    super();
    this.callId = options.callId;
    this.workspaceId = options.workspaceId;
    this.subscriberId = options.subscriberId;
    this.myLang = options.myLanguage;
    this.targetLang = options.targetLanguage;
    this.mode = options.mode;
    this.whoHears = options.whoHears;
    this.twilioSocket = options.socket;
    this.streamSid = options.streamSid;
    this.ttsVoiceId = options.ttsVoiceId;
    this.tone = options.tone || 'neutral';
  }

  async start(): Promise<void> {
    // Get xAI API key
    const [row] = await db.select({ credential_data: providerCredentials.credential_data })
      .from(providerCredentials)
      .where(and(
        eq(providerCredentials.workspace_id, this.workspaceId),
        eq(providerCredentials.provider, 'xai'),
      ));
    if (!row) throw new Error('xAI credentials not configured — required for conference translator');
    const creds = JSON.parse(decrypt(row.credential_data)) as { api_key: string };
    const apiKey = creds.api_key;

    // Create translator session record
    const [session] = await db
      .insert(translatorSessions)
      .values({
        subscriber_id: this.subscriberId,
        call_id: this.callId,
        workspace_id: this.workspaceId,
      })
      .returning();
    this.sessionId = session.id;

    // Connect to Grok Voice Agent API
    const myLangName = LANG_NAMES[this.myLang] || this.myLang;
    const targetLangName = LANG_NAMES[this.targetLang] || this.targetLang;

    this.grokWs = new WebSocket('wss://api.x.ai/v1/realtime', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    this.grokWs.on('open', () => {
      log.info({ callId: this.callId }, 'Grok Voice Agent WebSocket connected');

      this.grokWs!.send(JSON.stringify({
        type: 'session.update',
        session: {
          voice: this.ttsVoiceId || 'eve',
          instructions: `You are a live phone interpreter. Your ONLY job is to translate speech between ${myLangName} and ${targetLangName}.

Rules:
- When you hear ${myLangName}, translate it to ${targetLangName} and speak the translation.
- When you hear ${targetLangName}, translate it to ${myLangName} and speak the translation.
- ONLY speak the translation. Do NOT add any commentary, greetings, or explanations.
- If you cannot understand something, stay silent.

Tone: ${TONE_INSTRUCTIONS[this.tone] || TONE_INSTRUCTIONS.neutral}`,
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            silence_duration_ms: 400,
            prefix_padding_ms: 200,
          },
          audio: {
            input: { format: { type: 'audio/pcmu', rate: 8000 } },
            output: { format: { type: 'audio/pcmu', rate: 8000 } },
          },
        },
      }));
    });

    this.grokWs.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleGrokEvent(msg);
      } catch { /* ignore parse errors */ }
    });

    this.grokWs.on('error', (err: Error) => {
      log.error({ err, callId: this.callId }, 'Grok Voice Agent WebSocket error');
    });

    this.grokWs.on('close', () => {
      log.info({ callId: this.callId }, 'Grok Voice Agent WebSocket closed');
    });

    // Safety timer (4 hours max)
    this.safetyTimer = setTimeout(() => {
      log.warn({ callId: this.callId }, 'Translator safety timer fired');
      this.finalize().catch(() => {});
    }, 4 * 60 * 60 * 1000);

    log.info({
      callId: this.callId,
      subscriber: this.subscriberId,
      myLang: this.myLang,
      targetLang: this.targetLang,
      mode: this.mode,
    }, 'Conference translator started (Grok Voice Agent)');

    // Send Telegram notification
    this.sendTelegramNotification('start').catch(() => {});
  }

  /** Forward telephony audio to Grok Voice Agent */
  sendAudio(audioBuffer: Buffer): void {
    if (this.grokWs?.readyState === WebSocket.OPEN) {
      this.grokWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioBuffer.toString('base64'),
      }));
    }
  }

  private handleGrokEvent(msg: any): void {
    switch (msg.type) {
      case 'input_audio_buffer.speech_started':
        // User started speaking — emit to UI
        this.currentInputTranscript = '';
        this.currentOutputTranscript = '';
        break;

      case 'response.output_audio.delta':
        // Streaming translated audio — inject into Twilio stream
        if (msg.delta && this.twilioSocket.readyState === 1) {
          const audio = Buffer.from(msg.delta, 'base64');
          const chunkSize = 640;
          for (let i = 0; i < audio.length; i += chunkSize) {
            this.twilioSocket.send(JSON.stringify({
              event: 'media',
              streamSid: this.streamSid,
              media: { payload: audio.subarray(i, i + chunkSize).toString('base64') },
            }));
          }
        }
        break;

      case 'response.audio_transcript.delta':
      case 'response.output_audio_transcript.delta':
        // Accumulate output transcript (the translation)
        if (msg.delta) {
          this.currentOutputTranscript += msg.delta;
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // Input speech transcribed — this is what was said
        if (msg.transcript) {
          this.currentInputTranscript = msg.transcript.trim();
        }
        break;

      case 'response.done': {
        // Translation turn complete — save transcript and emit to UI
        const original = this.currentInputTranscript;
        const translated = this.currentOutputTranscript.trim();

        if (original && translated) {
          // Detect direction
          const cyrillicRatio = (original.match(/[\u0400-\u04FF]/g) || []).length / Math.max(original.length, 1);
          const isMyLang = cyrillicRatio > 0.3 ? this.myLang === 'ru' : this.myLang !== 'ru';
          const speaker = isMyLang ? 'subscriber' : 'other';
          const detectedLang = isMyLang ? this.myLang : this.targetLang;

          this.transcript.push({
            speaker,
            text: original,
            lang: detectedLang,
            translated,
            timestamp: new Date().toISOString(),
          });

          // Emit to UI
          const io = getIo();
          if (io) {
            io.to(`call:${this.callId}:translate`).emit('call:translation', {
              call_id: this.callId,
              speaker,
              original,
              translated,
              detected_language: detectedLang,
              timestamp: new Date().toISOString(),
            });

            io.to(`call:${this.callId}`).emit('call:transcript', {
              call_id: this.callId,
              speaker: 'conference',
              text: original,
              timestamp: new Date().toISOString(),
              isFinal: true,
            });
          }
        }

        this.currentInputTranscript = '';
        this.currentOutputTranscript = '';
        break;
      }

      case 'error':
        log.error({ error: msg.error, callId: this.callId }, 'Grok Voice Agent error');
        break;
    }
  }

  /** Idempotent finalization — saves transcript, costs, deducts balance */
  async finalize(): Promise<void> {
    if (this.saved) return;
    this.saved = true;

    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = undefined;
    }

    // Close Grok WebSocket
    try { this.grokWs?.close(); } catch { /* ignore */ }

    const durationSecs = Math.floor((Date.now() - this.startTime) / 1000);
    const durationMins = durationSecs / 60;
    const minutesUsed = Math.ceil(durationMins * 100) / 100;

    // Calculate costs (Grok Voice Agent pricing: ~$0.05/min)
    const costVoiceAgent = durationMins * 0.05;
    const costTelephony = calculateTelephonyCost('twilio', durationMins);
    const costTotal = costVoiceAgent + costTelephony;

    // Update translator session
    if (this.sessionId) {
      try {
        await db.update(translatorSessions).set({
          duration_seconds: durationSecs,
          minutes_used: String(minutesUsed),
          cost_usd: String(costTotal),
          transcript: this.transcript as any,
          status: 'completed',
        }).where(eq(translatorSessions.id, this.sessionId));
      } catch (err) {
        log.error({ err, callId: this.callId }, 'Failed to update translator session');
      }
    }

    // Deduct balance from subscriber
    try {
      await db.update(translatorSubscribers).set({
        balance_minutes: sql`GREATEST(${translatorSubscribers.balance_minutes} - ${minutesUsed}, 0)`,
        updated_at: new Date(),
      }).where(eq(translatorSubscribers.id, this.subscriberId));
    } catch (err) {
      log.error({ err, callId: this.callId }, 'Failed to deduct subscriber balance');
    }

    // Deduct USD from workspace deposit
    try {
      const { deductUsageCost } = await import('./billing.service.js');
      const [ws] = await db.select({ provider_config: workspacesSchema.provider_config })
        .from(workspacesSchema)
        .where(eq(workspacesSchema.id, this.workspaceId))
        .limit(1);
      await deductUsageCost({
        workspaceId: this.workspaceId,
        providerCosts: {
          stt: costVoiceAgent, // Grok Voice Agent covers STT+LLM+TTS
          llm: 0,
          tts: 0,
          telephony: costTelephony,
          sttProvider: 'xai',
        },
        providerConfig: (ws?.provider_config as any) || {},
        referenceType: 'translator_session',
        referenceId: this.sessionId || this.callId,
      });
    } catch (err) {
      log.error({ err, callId: this.callId }, 'Failed to deduct workspace deposit');
    }

    // Update call status
    try {
      await callService.updateCallStatus(this.callId, 'completed', {
        duration_seconds: durationSecs,
      } as any);

      const aiSession = await callService.getAiSession(this.callId);
      if (aiSession) {
        await callService.updateAiSession(aiSession.id, {
          transcript: this.transcript as any,
          total_turns: this.transcript.length,
          cost_stt: String(costVoiceAgent),
          cost_telephony: String(costTelephony),
          cost_total: String(costTotal),
        } as any);
      }

      if (this.transcript.length > 0 && aiSession) {
        queuePostCallProcessing({
          callId: this.callId,
          workspaceId: this.workspaceId,
          sessionId: aiSession.id,
        });
      }
    } catch (err) {
      log.error({ err, callId: this.callId }, 'Failed to finalize call status');
    }

    // Notify frontend
    const io = getIo();
    if (io) {
      io.to(`call:${this.callId}`).emit('call:status', {
        call_id: this.callId,
        status: 'completed',
      });
    }

    log.info({
      callId: this.callId,
      durationSecs,
      minutesUsed,
      costTotal,
      turns: this.transcript.length,
    }, 'Conference translator finalized');

    this.sendTelegramNotification('end', durationSecs, minutesUsed).catch(() => {});
  }

  private async sendTelegramNotification(type: 'start' | 'end', durationSecs?: number, minutesUsed?: number): Promise<void> {
    const [sub] = await db.select().from(translatorSubscribers).where(eq(translatorSubscribers.id, this.subscriberId));
    if (!sub) return;

    let botToken: string | null = null;
    let chatId: string | null = sub.telegram_chat_id;

    const [telegramCreds] = await db.select().from(providerCredentials)
      .where(and(eq(providerCredentials.workspace_id, this.workspaceId), eq(providerCredentials.provider, 'telegram')));

    if (telegramCreds) {
      const creds = JSON.parse(decrypt(telegramCreds.credential_data)) as { bot_token: string; chat_id: string };
      botToken = creds.bot_token;
      if (!chatId) chatId = creds.chat_id;
    }

    if (!botToken || !chatId) return;

    if (type === 'start') {
      let liveUrl: string | undefined;
      try {
        const shareToken = await callService.createShareToken(this.callId);
        liveUrl = `https://${env.API_DOMAIN}/translate/${shareToken}`;
      } catch { /* no live URL */ }

      await sendTranslatorSessionStart(botToken, chatId, {
        subscriberName: sub.name,
        liveUrl,
      });
    } else {
      const balance = parseFloat(sub.balance_minutes as string);
      await sendTranslatorSessionEnd(botToken, chatId, {
        subscriberName: sub.name,
        durationSecs: durationSecs ?? 0,
        minutesUsed: minutesUsed ?? 0,
        balanceRemaining: Math.max(balance - (minutesUsed ?? 0), 0),
      });
    }
  }

  stop(): void {
    this.finalize().catch(err => log.error({ err, callId: this.callId }, 'Finalize error on stop'));
  }
}
