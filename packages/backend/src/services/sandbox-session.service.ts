import { WebSocket } from 'ws';
import pino from 'pino';
import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { translatorSessions } from '../db/schema.js';
import { env } from '../config/env.js';
import { LANG_NAMES } from '../config/languages.js';

const log = pino({ name: 'sandbox-session' });

// Same pinned Grok Voice Agent model as the production translator. See
// conference-translator.ts for the long story on why this is version-pinned.
const GROK_VOICE_MODEL = process.env.GROK_VOICE_MODEL || 'grok-voice-fast-1.0';

export type SandboxMode = 'echo' | 'simulation' | 'support';

interface SandboxSessionOptions {
  browserWs: WebSocket;
  workspaceId: string; // authenticated user's workspace (creds + training rows)
  mode: SandboxMode;
  lang: string;       // user's native language (e.g. 'ru')
  voiceId?: string;
  maxSeconds?: number; // hard cap for THIS session (remaining daily budget)
}

interface BrowserMessage {
  type: string;
  payload?: string;
}

/**
 * Online Sandbox (AI-trainer) — a browser-based, Twilio-free variant of the
 * Live Translator. The user talks from their microphone; this class bridges
 * the browser WebSocket to the xAI Grok Voice Agent realtime API and streams
 * audio + transcript back. Audio is mulaw 8 kHz end-to-end (identical to the
 * phone translator) so the Grok session config is unchanged and the frontend
 * can reuse the existing mulaw decoder / Web-Audio player.
 *
 * Unlike ConferenceTranslator this is NOT a verbatim translator — Grok plays a
 * persona (coach / mock support agent), so we deliberately let it respond and
 * stream its audio straight through (no direction detection, no barge-in logic,
 * no Twilio mark/ack cycle).
 */
export class SandboxSession {
  private browserWs: WebSocket;
  private grokWs: WebSocket | null = null;
  private mode: SandboxMode;
  private lang: string;
  private voiceId: string;

  private sessionId: string | null = null;
  private workspaceId: string;
  private xaiApiKey = '';
  private startTime = Date.now();
  private saved = false;
  private grokReady = false;

  private transcript: Array<{ role: 'user' | 'assistant'; text: string; timestamp: string }> = [];
  private currentInputTranscript = '';
  private currentOutputTranscript = '';

  private capTimer?: ReturnType<typeof setTimeout>;
  private maxSeconds: number;
  private onFinalize?: (durationSecs: number) => void;

  constructor(options: SandboxSessionOptions) {
    this.browserWs = options.browserWs;
    this.mode = options.mode;
    this.lang = options.lang;
    this.voiceId = options.voiceId || env.SANDBOX_TTS_VOICE;
    this.workspaceId = options.workspaceId;
    this.maxSeconds = Math.max(1, options.maxSeconds ?? env.SANDBOX_MAX_SECONDS);
  }

  /** Register a callback fired once on finalize with the session duration (for rate-limit accounting). */
  setOnFinalize(cb: (durationSecs: number) => void): void {
    this.onFinalize = cb;
  }

  async start(): Promise<void> {
    // Resolve xAI key from the sandbox workspace (with global fallback) — same
    // path the translator uses.
    const { resolveCredentialsWithGlobalFallback } = await import('./credential-resolver.service.js');
    const creds = await resolveCredentialsWithGlobalFallback<{ api_key: string }>(this.workspaceId, 'xai');
    this.xaiApiKey = creds.api_key;

    // Persist a training row (not billed). call_id / subscriber_id stay null.
    try {
      const [session] = await db
        .insert(translatorSessions)
        .values({
          subscriber_id: null as any,
          call_id: null as any,
          workspace_id: this.workspaceId,
          is_training: true,
        })
        .returning();
      this.sessionId = session.id;
    } catch (err) {
      log.error({ err }, 'Failed to create sandbox training session row');
    }

    this.connectGrok();

    // Hard cap — close the session after its remaining time budget.
    this.capTimer = setTimeout(() => {
      log.info({ sessionId: this.sessionId }, 'Sandbox session hit time cap');
      this.sendToBrowser({ type: 'limit' });
      this.finalize();
    }, this.maxSeconds * 1000);

    log.info({ sessionId: this.sessionId, mode: this.mode, lang: this.lang }, 'Sandbox session started');
  }

  private buildInstructions(): string {
    const langName = LANG_NAMES[this.lang] || this.lang;
    const cta = `\n\nAt the END of the conversation (when the user is wrapping up or says goodbye), warmly remind them in ${langName} that they already have $2 of free credit on their balance for real calls, and encourage them to try a real call.`;

    if (this.mode === 'echo') {
      return `You are an AI instructor for the Live Translator service, helping an immigrant overcome the fear of calling US institutions. Be a patient, encouraging coach.

ECHO MODE — translation quality check:
- The user speaks a phrase in ${langName}.
- First SAY the English translation of their phrase aloud, clearly.
- Then SAY the same phrase back in ${langName} so they can confirm the translation is accurate.
- Keep it tight: just the two renderings plus a one-line word of encouragement in ${langName}. No long explanations.
- Respond fast and naturally — aim for under one second of perceived latency.${cta}`;
    }

    if (this.mode === 'simulation') {
      return `You are role-playing as a US customer-support representative (bank or hospital) so an immigrant can practice a real phone call and overcome their fear.

SIMULATION MODE:
- Speak ONLY in English, staying fully in character as a friendly but realistic support agent.
- Run a believable dialogue: greet the caller, ask how you can help, ask the kinds of verification questions a real agent would (name, date of birth, account/reference number), and respond naturally to their answers.
- Speak clearly and at a reasonable pace; be patient if the caller hesitates. Never break character to explain or translate — this is immersion practice.
- Respond fast and naturally — aim for under one second of perceived latency.${cta}`;
    }

    // support
    return `You are a friendly support assistant for the Live Translator service, helping a new user understand how it works.

SUPPORT MODE:
- Answer the user's questions about the service in ${langName}.
- Explain simply: how Live Translator works on a real phone call, that both people can be on speakerphone, that it works from any phone and carrier, and that the voice is premium-quality (not robotic).
- Be concise, warm, and reassuring. Respond fast and naturally — aim for under one second of perceived latency.${cta}`;
  }

  private greetingPrompt(): string {
    const langName = LANG_NAMES[this.lang] || this.lang;
    if (this.mode === 'echo') {
      return `Greet the user briefly in ${langName}: tell them this is Echo mode — they should say any phrase in ${langName} and you'll show them the English translation and read it back. One or two short sentences only.`;
    }
    if (this.mode === 'simulation') {
      return `Open the call in English as a US support agent would: a short, friendly greeting and "how can I help you today?". One or two short sentences only.`;
    }
    return `Greet the user briefly in ${langName}: introduce yourself as the Live Translator assistant and invite them to ask anything about how the service works. One or two short sentences only.`;
  }

  private connectGrok(): void {
    this.grokWs = new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(GROK_VOICE_MODEL)}`, {
      headers: { Authorization: `Bearer ${this.xaiApiKey}` },
    });

    this.grokWs.on('open', () => {
      log.info({ sessionId: this.sessionId, model: GROK_VOICE_MODEL }, 'Sandbox Grok WS connected');
      this.grokReady = true;
      this.grokWs!.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'],
          voice: this.voiceId,
          instructions: this.buildInstructions(),
          turn_detection: {
            type: 'server_vad',
            threshold: 0.7,
            silence_duration_ms: 1000,
            prefix_padding_ms: 400,
          },
          input_audio_transcription: { model: 'grok-3-mini' },
          audio: {
            input: { format: { type: 'audio/pcmu' } },
            output: { format: { type: 'audio/pcmu' } },
          },
        },
      }));

      // Opening line from the persona (a greeting IS desired here, unlike the
      // verbatim translator). server_vad then drives subsequent turns automatically.
      this.grokWs!.send(JSON.stringify({
        type: 'response.create',
        response: { modalities: ['audio', 'text'], instructions: this.greetingPrompt() },
      }));

      this.sendToBrowser({ type: 'ready' });
    });

    this.grokWs.on('message', (data: Buffer) => {
      try {
        this.handleGrokEvent(JSON.parse(data.toString()));
      } catch { /* ignore parse errors */ }
    });

    this.grokWs.on('error', (err: Error) => {
      log.error({ err, sessionId: this.sessionId }, 'Sandbox Grok WS error');
    });

    this.grokWs.on('close', () => {
      log.info({ sessionId: this.sessionId }, 'Sandbox Grok WS closed');
    });
  }

  /** Forward mulaw 8 kHz audio (from the browser mic) to Grok. */
  sendAudio(audioBuffer: Buffer): void {
    if (this.grokWs?.readyState === WebSocket.OPEN) {
      this.grokWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioBuffer.toString('base64'),
      }));
    }
  }

  /** Handle a JSON message from the browser. */
  handleBrowserMessage(raw: Buffer | string): void {
    let msg: BrowserMessage;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
    } catch {
      return;
    }
    if (msg.type === 'audio' && msg.payload) {
      this.sendAudio(Buffer.from(msg.payload, 'base64'));
    }
  }

  private handleGrokEvent(msg: any): void {
    switch (msg.type) {
      case 'response.output_audio.delta':
        // Stream Grok audio (mulaw 8 kHz, base64) straight to the browser.
        if (msg.delta) this.sendToBrowser({ type: 'audio', payload: msg.delta });
        break;

      case 'response.audio_transcript.delta':
      case 'response.output_audio_transcript.delta':
        if (msg.delta) {
          this.currentOutputTranscript += msg.delta;
          this.sendToBrowser({ type: 'transcript', role: 'assistant', text: this.currentOutputTranscript, final: false });
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (msg.transcript) {
          this.currentInputTranscript = msg.transcript.trim();
          this.transcript.push({ role: 'user', text: this.currentInputTranscript, timestamp: new Date().toISOString() });
          this.sendToBrowser({ type: 'transcript', role: 'user', text: this.currentInputTranscript, final: true });
        }
        break;

      case 'response.done': {
        const text = this.currentOutputTranscript.trim();
        if (text) {
          this.transcript.push({ role: 'assistant', text, timestamp: new Date().toISOString() });
          this.sendToBrowser({ type: 'transcript', role: 'assistant', text, final: true });
        }
        this.currentInputTranscript = '';
        this.currentOutputTranscript = '';
        break;
      }

      case 'error':
        log.warn({ error: msg.error, sessionId: this.sessionId }, 'Sandbox Grok error event');
        break;
    }
  }

  private sendToBrowser(obj: Record<string, unknown>): void {
    if (this.browserWs.readyState === WebSocket.OPEN) {
      this.browserWs.send(JSON.stringify(obj));
    }
  }

  /** Idempotent teardown — persists the (unbilled) transcript and closes both sockets. */
  async finalize(): Promise<void> {
    if (this.saved) return;
    this.saved = true;

    if (this.capTimer) { clearTimeout(this.capTimer); this.capTimer = undefined; }
    try { this.grokWs?.close(); } catch { /* ignore */ }

    const durationSecs = Math.floor((Date.now() - this.startTime) / 1000);

    if (this.sessionId) {
      try {
        // Training sessions are free: cost_usd / minutes_used stay zero and we
        // deliberately do NOT call finalizeSession() (no balance deduction).
        await db.update(translatorSessions).set({
          duration_seconds: durationSecs,
          minutes_used: '0',
          cost_usd: '0',
          transcript: this.transcript as any,
          status: 'completed',
        }).where(eq(translatorSessions.id, this.sessionId));
      } catch (err) {
        log.error({ err, sessionId: this.sessionId }, 'Failed to finalize sandbox session');
      }
    }

    log.info({ sessionId: this.sessionId, durationSecs, turns: this.transcript.length }, 'Sandbox session finalized');

    try { this.onFinalize?.(durationSecs); } catch { /* ignore */ }
    try { if (this.browserWs.readyState === WebSocket.OPEN) this.browserWs.close(); } catch { /* ignore */ }
  }
}
