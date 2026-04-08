import { EventEmitter } from 'node:events';
import pino from 'pino';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../config/db.js';
import { translatorSubscribers, translatorSessions, calls as callsTable, workspaces as workspacesSchema } from '../db/schema.js';
import { createSTTProvider, type STTProvider, type TranscriptEvent } from './stt.service.js';
import { createTTSProvider, type TTSProvider } from './tts.service.js';
import { createLLMProvider, type LLMProvider } from './llm.service.js';
import { getIo } from '../realtime/io.js';
import * as callService from './call.service.js';
import { queuePostCallProcessing } from '../workers/post-call.worker.js';
import { calculateSTTCost, calculateTelephonyCost } from '../config/pricing.js';
import { sendTranslatorSessionStart, sendTranslatorSessionEnd } from './telegram.service.js';
import { decrypt } from '../lib/crypto.js';
import { providerCredentials, callShareTokens } from '../db/schema.js';
import { env } from '../config/env.js';
import type { WebSocket } from 'ws';

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
  socket: WebSocket;        // Twilio media stream WebSocket
  streamSid: string;        // Twilio stream SID
}

const MODEL_MAP: Record<string, string> = {
  openai: process.env.OPENAI_OAUTH_PROXY_URL ? 'gpt-5.4-mini' : 'gpt-4o-mini',
  xai: 'grok-3-mini-fast',
};

/**
 * Conference Translator — listens to a phone conference and translates
 * bidirectionally between two languages.
 *
 * Audio flow (conference = single mixed stream from Twilio):
 *   mixed audio → STT (language auto-detect or configured) → detect language →
 *   translate → TTS → inject back into stream
 */
export class ConferenceTranslator extends EventEmitter {
  private callId: string;
  private workspaceId: string;
  private subscriberId: string;
  private myLang: string;
  private targetLang: string;
  private mode: 'voice' | 'text' | 'both';
  private whoHears: 'subscriber' | 'both';

  private stt: STTProvider | null = null;
  private tts: TTSProvider | null = null;
  private llm: LLMProvider | null = null;
  private llmProviderName: string = 'openai';

  private socket: WebSocket;
  private streamSid: string;
  private ttsProviderName: string;
  private ttsVoiceId?: string;

  private transcript: Array<{ speaker: string; text: string; lang: string; translated: string; timestamp: string }> = [];
  private sessionId: string | null = null;
  private startTime: number = Date.now();
  private saved: boolean = false;
  private safetyTimer?: ReturnType<typeof setTimeout>;

  // Accumulate final segments for utterance-level processing
  private accum: string = '';
  private lastDetectedLang: string = '';

  constructor(options: ConferenceTranslatorOptions) {
    super();
    this.callId = options.callId;
    this.workspaceId = options.workspaceId;
    this.subscriberId = options.subscriberId;
    this.myLang = options.myLanguage;
    this.targetLang = options.targetLanguage;
    this.mode = options.mode;
    this.whoHears = options.whoHears;
    this.socket = options.socket;
    this.streamSid = options.streamSid;
    this.ttsProviderName = options.ttsProvider;
    this.ttsVoiceId = options.ttsVoiceId;
  }

  async start(): Promise<void> {
    // Resolve providers
    for (const provider of ['openai', 'xai'] as const) {
      try {
        this.llm = await createLLMProvider(this.workspaceId, provider);
        this.llmProviderName = provider;
        break;
      } catch { /* try next */ }
    }
    if (!this.llm) throw new Error('No LLM provider available for translator');

    // OpenAI Whisper required for conference translator (auto language detection for mixed ru/en)
    this.stt = await createSTTProvider(this.workspaceId, 'openai');

    try {
      this.tts = await createTTSProvider(
        this.workspaceId,
        this.ttsProviderName as 'elevenlabs' | 'openai' | 'xai',
        this.ttsVoiceId,
        this.targetLang,
      );
    } catch {
      // Fallback TTS
      for (const fb of ['elevenlabs', 'openai', 'xai'] as const) {
        try {
          this.tts = await createTTSProvider(this.workspaceId, fb, undefined, this.targetLang);
          this.ttsProviderName = fb;
          break;
        } catch { /* next */ }
      }
    }
    if (!this.tts) throw new Error('No TTS provider available for translator');

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

    // Wire STT events
    this.stt.on('transcript', (evt: TranscriptEvent) => this.handleTranscript(evt));
    this.stt.on('utterance_end', () => this.handleUtteranceEnd());
    this.stt.on('error', (err: Error) => log.error({ err, callId: this.callId }, 'Translator STT error'));

    // Connect STT — Whisper auto-detects language, no language param needed
    this.stt.connect({});

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
    }, 'Conference translator started');

    // Send Telegram notification with live translate link (fire-and-forget)
    this.sendTelegramNotification('start').catch(() => {});
  }

  sendAudio(audioBuffer: Buffer): void {
    if (this.stt) {
      this.stt.sendAudio(audioBuffer);
    }
  }

  private handleTranscript(evt: TranscriptEvent): void {
    const text = evt.text.trim();
    if (!text) return;

    if (!evt.isFinal) {
      // Emit interim transcript to UI (if text mode)
      if (this.mode === 'text' || this.mode === 'both') {
        const io = getIo();
        if (io) {
          io.to(`call:${this.callId}`).volatile.emit('call:transcript', {
            call_id: this.callId,
            speaker: 'conference',
            text: this.accum ? this.accum + ' ' + text : text,
            timestamp: new Date().toISOString(),
            isFinal: false,
          });
        }
      }
      return;
    }

    // Final segment — accumulate
    this.accum += (this.accum ? ' ' : '') + text;

    // Detect language from text heuristic
    this.lastDetectedLang = this.detectLanguage(text);

    // Translate each final segment immediately
    this.translateSegment(text, this.lastDetectedLang);
  }

  private handleUtteranceEnd(): void {
    const text = this.accum.trim();
    this.accum = '';
    if (!text) return;

    // Emit final transcript to UI
    const io = getIo();
    if (io) {
      io.to(`call:${this.callId}`).emit('call:transcript', {
        call_id: this.callId,
        speaker: 'conference',
        text,
        timestamp: new Date().toISOString(),
        isFinal: true,
      });
    }
  }

  private detectLanguage(text: string): string {
    // Simple heuristic: if text contains Cyrillic → it's Russian (subscriber's language)
    const cyrillicRatio = (text.match(/[\u0400-\u04FF]/g) || []).length / text.length;
    if (cyrillicRatio > 0.3) return this.myLang;

    // Check for common CJK, Arabic, etc. — for now default to target language
    return this.targetLang;
  }

  private translateSegment(text: string, detectedLang: string): void {
    if (!this.llm) return;

    // Determine translation direction
    const isMyLanguage = detectedLang === this.myLang;
    const translateTo = isMyLanguage ? this.targetLang : this.myLang;

    const model = MODEL_MAP[this.llmProviderName] ?? 'gpt-4o-mini';

    // Fire-and-forget translation pipeline
    (async () => {
      try {
        const client = (this.llm as any).client;
        const resp = await client.chat.completions.create({
          model,
          temperature: 0.3,
          max_tokens: 200,
          stream: false,
          messages: [
            {
              role: 'system',
              content: `Translate to ${translateTo}. Phone conversation. Be natural and concise.\nOnly output the translation, nothing else.`,
            },
            { role: 'user', content: `"${text}"` },
          ],
        });

        const translated = resp.choices?.[0]?.message?.content?.trim();
        if (!translated) return;

        // Save to transcript
        this.transcript.push({
          speaker: isMyLanguage ? 'subscriber' : 'other',
          text,
          lang: detectedLang,
          translated,
          timestamp: new Date().toISOString(),
        });

        // Emit translation to UI (text mode)
        if (this.mode === 'text' || this.mode === 'both') {
          const io = getIo();
          if (io) {
            io.to(`call:${this.callId}:translate`).emit('call:translation', {
              call_id: this.callId,
              speaker: isMyLanguage ? 'subscriber' : 'other',
              original: text,
              translated,
              detected_language: detectedLang,
              timestamp: new Date().toISOString(),
            });
          }
        }

        // Voice mode — synthesize and inject into stream
        if (this.mode === 'voice' || this.mode === 'both') {
          await this.synthesizeAndInject(translated, isMyLanguage);
        }
      } catch (err) {
        log.error({ err, callId: this.callId }, 'Translation pipeline error');
      }
    })();
  }

  private async synthesizeAndInject(translatedText: string, isMyLanguage: boolean): Promise<void> {
    if (!this.tts || !this.socket || this.socket.readyState !== 1) return;

    try {
      let audio = await this.tts.synthesize(translatedText);

      // Convert PCM to mulaw if needed (ElevenLabs/xAI output mulaw directly)
      const isNativeMulaw = this.ttsProviderName === 'elevenlabs' || this.ttsProviderName === 'xai';
      if (!isNativeMulaw) {
        const { pcmToMulaw } = await import('../routes/webhooks/media-stream.js');
        audio = pcmToMulaw(audio);
      }

      // Inject into stream — in a conference, audio goes to all participants
      const chunkSize = 640;
      for (let i = 0; i < audio.length; i += chunkSize) {
        this.socket.send(JSON.stringify({
          event: 'media',
          streamSid: this.streamSid,
          media: { payload: audio.subarray(i, i + chunkSize).toString('base64') },
        }));
      }
    } catch (err) {
      log.error({ err, callId: this.callId }, 'TTS synthesis/inject error');
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

    // Close STT
    try { this.stt?.close(); } catch { /* ignore */ }

    const durationSecs = Math.floor((Date.now() - this.startTime) / 1000);
    const durationMins = durationSecs / 60;
    const minutesUsed = Math.ceil(durationMins * 100) / 100; // round up to 2 decimals

    // Calculate costs
    const costStt = calculateSTTCost('deepgram', durationMins);
    const costTelephony = calculateTelephonyCost('twilio', durationMins);
    const costTotal = costStt + costTelephony;

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

    // Deduct balance from subscriber (legacy minutes)
    try {
      await db.update(translatorSubscribers).set({
        balance_minutes: sql`GREATEST(${translatorSubscribers.balance_minutes} - ${minutesUsed}, 0)`,
        updated_at: new Date(),
      }).where(eq(translatorSubscribers.id, this.subscriberId));
    } catch (err) {
      log.error({ err, callId: this.callId }, 'Failed to deduct subscriber balance');
    }

    // Deduct USD from workspace deposit (new billing system)
    try {
      const { deductUsageCost } = await import('./billing.service.js');
      const [ws] = await db.select({ provider_config: workspacesSchema.provider_config })
        .from(workspacesSchema)
        .where(eq(workspacesSchema.id, this.workspaceId))
        .limit(1);
      await deductUsageCost({
        workspaceId: this.workspaceId,
        providerCosts: {
          stt: costStt,
          llm: 0,
          tts: 0,
          telephony: costTelephony,
          sttProvider: 'deepgram',
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

      // Update AI session with costs
      const aiSession = await callService.getAiSession(this.callId);
      if (aiSession) {
        await callService.updateAiSession(aiSession.id, {
          transcript: this.transcript as any,
          total_turns: this.transcript.length,
          cost_stt: String(costStt),
          cost_telephony: String(costTelephony),
          cost_total: String(costTotal),
        } as any);
      }

      // Queue post-call processing (summary)
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

    // Send Telegram end notification
    this.sendTelegramNotification('end', durationSecs, minutesUsed).catch(() => {});
  }

  private async sendTelegramNotification(type: 'start' | 'end', durationSecs?: number, minutesUsed?: number): Promise<void> {
    // Get subscriber's telegram_chat_id OR workspace telegram credentials
    const [sub] = await db.select().from(translatorSubscribers).where(eq(translatorSubscribers.id, this.subscriberId));
    if (!sub) return;

    // Try subscriber's own telegram chat first, then workspace telegram
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
      // Create share token for live translate page
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
