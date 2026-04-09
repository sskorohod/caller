import { EventEmitter } from 'node:events';
import pino from 'pino';
import { WebSocket } from 'ws';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../config/db.js';
import { translatorSessions, calls as callsTable, workspaces as workspacesSchema } from '../db/schema.js';
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
  personalContext?: string;
  greetingText?: string;
  socket: WebSocket;        // Twilio media stream WebSocket
  streamSid: string;        // Twilio stream SID
}

const LANG_NAMES: Record<string, string> = {
  en: 'English', ru: 'Russian', es: 'Spanish', de: 'German', fr: 'French',
};

const DEFAULT_GREETING = `A live interpreter has joined this call. I will translate between your languages. Please speak naturally, then pause briefly after finishing your thought so I can translate. Let's begin.`;

const TONE_INSTRUCTIONS: Record<string, string> = {
  neutral: 'Translate naturally, preserving the original tone and meaning.',
  business: 'Use a professional, formal business tone. Remove filler words (um, uh, er, hmm). Use clear, precise language appropriate for business meetings and appointments.',
  friendly: 'Use a warm, casual, friendly tone. Keep the conversational feel natural and relaxed.',
  medical: 'Use precise medical terminology. Translate accurately without simplifying medical terms. Maintain a calm, professional tone.',
  legal: 'Use precise legal terminology. Translate accurately without paraphrasing legal concepts. Maintain a formal, authoritative tone.',
  intelligent: 'Before translating, mentally refine the speaker\'s words: remove ALL filler words (um, uh, er, hmm, М, Э, ну, типа, как бы), remove false starts and repetitions, rephrase to sound intelligent, polite, eloquent and well-spoken. Then translate the REFINED version into the other language. CRITICAL: You MUST always output in a DIFFERENT language than what was spoken — NEVER repeat back in the same language.',
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
  private personalContext: string;
  private greetingText: string;

  private transcript: Array<{ speaker: string; text: string; lang: string; translated: string; timestamp: string }> = [];
  private sessionId: string | null = null;
  private startTime: number = Date.now();
  private saved: boolean = false;
  private safetyTimer?: ReturnType<typeof setTimeout>;
  private statsTimer?: ReturnType<typeof setInterval>;
  private xaiApiKey: string = '';
  private greetingSent: boolean = false;

  // Accumulate transcript text from Grok responses
  private currentInputTranscript: string = '';
  private currentOutputTranscript: string = '';
  private currentResponseAudio: Buffer[] = []; // buffer audio for one-way filtering

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
    this.tone = options.tone || 'business';
    this.personalContext = options.personalContext || '';
    this.greetingText = options.greetingText || DEFAULT_GREETING;
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
    this.xaiApiKey = apiKey;

    // Create translator session record
    const [session] = await db
      .insert(translatorSessions)
      .values({
        subscriber_id: null as any,
        call_id: this.callId,
        workspace_id: this.workspaceId,
      })
      .returning();
    this.sessionId = session.id;

    // Connect to Grok Voice Agent API
    this.connectGrok();

    // Safety timer (4 hours max)
    this.safetyTimer = setTimeout(() => {
      log.warn({ callId: this.callId }, 'Translator safety timer fired');
      this.finalize().catch(() => {});
    }, 4 * 60 * 60 * 1000);

    // Stats emitter — send duration + cost every 5 seconds
    this.statsTimer = setInterval(() => {
      const io = getIo();
      if (io) {
        const secs = Math.floor((Date.now() - this.startTime) / 1000);
        io.to(`call:${this.callId}`).volatile.emit('translator:stats', {
          call_id: this.callId,
          duration_seconds: secs,
          cost_usd: (secs / 60) * 0.05,
        });
      }
    }, 5000);

    log.info({
      callId: this.callId,
      subscriber: this.subscriberId,
      myLang: this.myLang,
      targetLang: this.targetLang,
      mode: this.mode,
    }, 'Conference translator started (Grok Voice Agent)');

    // Telegram start notification is sent earlier (in twilio.ts inbound handler)
    // Only end notification is sent from here
  }

  private buildInstructions(): string {
    const myLangName = LANG_NAMES[this.myLang] || this.myLang;
    const targetLangName = LANG_NAMES[this.targetLang] || this.targetLang;
    const isOneWay = this.mode === 'text' || this.mode === 'unidirectional' as any;

    const commonRules = `
- ALWAYS wait for the speaker to finish their complete thought before translating. A brief pause (1-2 seconds) does NOT mean the speaker is done — they may be thinking or breathing.
- NEVER output a partial or incomplete translation. If you only received a fragment (e.g. ending with "and", "but", "that", "to"), wait for more input and combine it into one complete translation.
- When translating numbers, be EXTREMELY precise. For numbers above 99, spell them out clearly (e.g. "one hundred thirty-eight dollars", NOT "three hundred thirty-eight"). Double-check that the number in your translation matches exactly what was spoken.
- If someone interrupts while you are translating, finish your current translation first, then translate the new speech. Do NOT drop incomplete translations.
- ONLY output the translation. Do NOT add any commentary, greetings, or explanations.
- If you hear ONLY filler sounds (um, uh, er, hmm, М, Э, А, мм, ммм, угу) with NO actual words, do NOT translate or respond — produce NO output at all. These are thinking pauses, not speech.
- If you cannot understand something, stay silent — produce NO audio output.`;

    if (isOneWay) {
      return `You are a live phone interpreter.

Rules:
- When you hear ${myLangName}, translate it to ${targetLangName} and SPEAK the translation aloud.
- When you hear ${targetLangName}, translate it to ${myLangName} but ONLY output text — do NOT speak. Just provide a silent text translation.
${commonRules}

Tone: ${TONE_INSTRUCTIONS[this.tone] || TONE_INSTRUCTIONS.neutral}${this.personalContext ? `

Personal information about the subscriber (use when relevant — spell names carefully, dictate numbers clearly):
${this.personalContext}` : ''}`;
    }

    // Bidirectional: translate both directions with voice
    return `You are a live phone interpreter. Your ONLY job is to translate speech between ${myLangName} and ${targetLangName}.

Rules:
- When you hear ${myLangName}, you MUST translate it to ${targetLangName} and speak the translation in ${targetLangName}.
- When you hear ${targetLangName}, you MUST translate it to ${myLangName} and speak the translation in ${myLangName}.
- CRITICAL: Your output language must ALWAYS be different from the input language. Never output in the same language as the speaker.
${commonRules}

Tone: ${TONE_INSTRUCTIONS[this.tone] || TONE_INSTRUCTIONS.neutral}${this.personalContext ? `

Personal information about the subscriber (use when relevant — spell names carefully, dictate numbers clearly):
${this.personalContext}` : ''}`;
  }

  private connectGrok(): void {
    // Close existing connection if any
    try { this.grokWs?.close(); } catch { /* ignore */ }

    this.grokWs = new WebSocket('wss://api.x.ai/v1/realtime', {
      headers: { Authorization: `Bearer ${this.xaiApiKey}` },
    });

    this.grokWs.on('open', () => {
      log.info({ callId: this.callId }, 'Grok Voice Agent WebSocket connected');
      this.grokWs!.send(JSON.stringify({
        type: 'session.update',
        session: {
          voice: this.ttsVoiceId || 'eve',
          instructions: this.buildInstructions(),
          turn_detection: {
            type: 'server_vad',
            threshold: 0.7,
            silence_duration_ms: 1500,
            prefix_padding_ms: 400,
          },
          input_audio_transcription: { model: 'whisper-1' },
          audio: {
            input: { format: { type: 'audio/pcmu', rate: 8000 } },
            output: { format: { type: 'audio/pcmu', rate: 8000 } },
          },
        },
      }));

      // Speak greeting only on the first connection (not on reconnects for tone/voice/mode changes)
      if (this.greetingText && !this.greetingSent) {
        this.greetingSent = true;
        setTimeout(() => {
          if (this.grokWs?.readyState === WebSocket.OPEN) {
            this.grokWs.send(JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['audio', 'text'],
                instructions: `Say the following greeting exactly as written, in a warm professional tone. Do NOT translate it, just read it aloud: "${this.greetingText}"`,
              },
            }));
            log.info({ callId: this.callId }, 'Greeting sent to Grok Voice Agent');
          }
        }, 3000);
      }
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
  }

  /** Update translation mode on the fly — reconnects Grok with new instructions */
  updateMode(mode: string): void {
    this.mode = mode as any;
    log.info({ callId: this.callId, mode }, 'Translator mode updated — reconnecting Grok');
    this.connectGrok();
  }

  /** Update languages on the fly — reconnects Grok */
  updateLanguages(myLang: string, targetLang: string): void {
    this.myLang = myLang;
    this.targetLang = targetLang;
    log.info({ callId: this.callId, myLang, targetLang }, 'Translator languages updated — reconnecting Grok');
    this.connectGrok();
  }

  /** Update tone on the fly — reconnects Grok with new instructions */
  updateTone(tone: string): void {
    this.tone = tone;
    log.info({ callId: this.callId, tone }, 'Translator tone updated — reconnecting Grok');
    this.connectGrok();
  }

  /** Update voice on the fly — reconnects Grok with new voice */
  updateVoice(voice: string): void {
    this.ttsVoiceId = voice;
    log.info({ callId: this.callId, voice }, 'Translator voice updated — reconnecting Grok');
    this.connectGrok();
  }

  private paused: boolean = false;

  /** Pause translation — audio is dropped, no translations produced */
  pause(): void {
    this.paused = true;
    if (this.grokWs?.readyState === WebSocket.OPEN) {
      this.grokWs.send(JSON.stringify({ type: 'response.cancel' }));
    }
    log.info({ callId: this.callId }, 'Translator paused');
  }

  /** Resume translation */
  resume(): void {
    this.paused = false;
    log.info({ callId: this.callId }, 'Translator resumed');
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Forward telephony audio to Grok Voice Agent */
  sendAudio(audioBuffer: Buffer): void {
    if (this.paused) return;
    if (this.grokWs?.readyState === WebSocket.OPEN) {
      this.grokWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioBuffer.toString('base64'),
      }));
    }
  }

  private handleGrokEvent(msg: any): void {
    switch (msg.type) {
      case 'input_audio_buffer.speech_started': {
        // New speech detected — cancel any in-progress translation to prevent overlap
        if (this.grokWs?.readyState === WebSocket.OPEN) {
          this.grokWs.send(JSON.stringify({ type: 'response.cancel' }));
        }
        // Clear Twilio's audio playback buffer to stop stale translation audio
        if (this.twilioSocket.readyState === 1) {
          this.twilioSocket.send(JSON.stringify({
            event: 'clear',
            streamSid: this.streamSid,
          }));
        }
        this.currentInputTranscript = '';
        this.currentOutputTranscript = '';
        this.currentResponseAudio = [];
        const io0 = getIo();
        if (io0) {
          io0.to(`call:${this.callId}`).volatile.emit('call:transcript', {
            call_id: this.callId, speaker: 'conference', text: '', timestamp: new Date().toISOString(), isFinal: false,
          });
        }
        break;
      }

      case 'response.output_audio.delta':
        if (msg.delta) {
          const isOneWay = this.mode === 'text' || this.mode === ('unidirectional' as any);
          if (isOneWay) {
            // Buffer audio — inject only after we know it's subscriber's speech (in response.done)
            this.currentResponseAudio.push(Buffer.from(msg.delta, 'base64'));
          } else {
            // Bidirectional — inject immediately
            if (this.twilioSocket.readyState === 1) {
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
          }
        }
        break;

      case 'response.audio_transcript.delta':
      case 'response.output_audio_transcript.delta':
        // Accumulate output transcript + emit interim translation
        if (msg.delta) {
          this.currentOutputTranscript += msg.delta;
          const io3 = getIo();
          if (io3) {
            io3.to(`call:${this.callId}:translate`).volatile.emit('call:translation:interim', {
              call_id: this.callId,
              original: this.currentInputTranscript,
              translated: this.currentOutputTranscript,
              timestamp: new Date().toISOString(),
            });
          }
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // Input speech transcribed — show original text on UI
        if (msg.transcript) {
          this.currentInputTranscript = msg.transcript.trim();
          const io2 = getIo();
          if (io2) {
            io2.to(`call:${this.callId}`).volatile.emit('call:transcript', {
              call_id: this.callId, speaker: 'conference', text: this.currentInputTranscript,
              timestamp: new Date().toISOString(), isFinal: false,
            });
          }
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

          // One-way mode: inject buffered audio only if subscriber spoke
          const isOneWay = this.mode === 'text' || this.mode === ('unidirectional' as any);
          if (isOneWay && this.currentResponseAudio.length > 0) {
            if (isMyLang && this.twilioSocket.readyState === 1) {
              // Subscriber spoke → inject translated voice for other party
              const chunkSize = 640;
              for (const buf of this.currentResponseAudio) {
                for (let i = 0; i < buf.length; i += chunkSize) {
                  this.twilioSocket.send(JSON.stringify({
                    event: 'media',
                    streamSid: this.streamSid,
                    media: { payload: buf.subarray(i, i + chunkSize).toString('base64') },
                  }));
                }
              }
            }
            // Other party spoke → no audio injection (text-only on screen)
          }

          // Emit to UI (always — both directions show as text)
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
        this.currentResponseAudio = [];
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

    // Close Grok WebSocket + stats timer
    try { this.grokWs?.close(); } catch { /* ignore */ }
    if (this.statsTimer) { clearInterval(this.statsTimer); this.statsTimer = undefined; }

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

    // Notify frontend — both call room and workspace room
    const io = getIo();
    if (io) {
      io.to(`call:${this.callId}`).emit('call:status', {
        call_id: this.callId,
        status: 'completed',
      });
      io.to(`workspace:${this.workspaceId}`).emit('call:status', {
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

    this.sendTelegramNotification('end', durationSecs, costTotal).catch(() => {});
  }

  private async sendTelegramNotification(type: 'start' | 'end', durationSecs?: number, costTotal?: number): Promise<void> {
    const [telegramCreds] = await db.select().from(providerCredentials)
      .where(and(eq(providerCredentials.workspace_id, this.workspaceId), eq(providerCredentials.provider, 'telegram')));
    if (!telegramCreds) return;

    const creds = JSON.parse(decrypt(telegramCreds.credential_data)) as { bot_token: string; chat_id: string };
    if (!creds.bot_token || !creds.chat_id) return;

    // Get workspace name for notification
    const [ws] = await db.select({ name: workspacesSchema.name, balance_usd: workspacesSchema.balance_usd })
      .from(workspacesSchema).where(eq(workspacesSchema.id, this.workspaceId)).limit(1);

    if (type === 'start') {
      let liveUrl: string | undefined;
      try {
        const shareToken = await callService.createShareToken(this.callId);
        liveUrl = `https://${env.API_DOMAIN}/translate/${shareToken}`;
      } catch { /* ignore */ }

      await sendTranslatorSessionStart(creds.bot_token, creds.chat_id, {
        subscriberName: ws?.name || 'User',
        liveUrl,
      });
    } else {
      const balanceUsd = parseFloat(ws?.balance_usd as string) || 0;
      await sendTranslatorSessionEnd(creds.bot_token, creds.chat_id, {
        subscriberName: ws?.name || 'User',
        durationSecs: durationSecs ?? 0,
        costUsd: costTotal ?? 0,
        balanceUsd,
      });
    }
  }

  stop(): void {
    this.finalize().catch(err => log.error({ err, callId: this.callId }, 'Finalize error on stop'));
  }
}
