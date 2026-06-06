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

    if (this.mode === 'echo') {
      // Pure verbatim translator — NO greeting (see connectGrok), NO assistant
      // persona, NO added/encouraging phrases. Same hard rules as the production
      // ConferenceTranslator, which is the proven "translate only, add nothing" prompt.
      return `You are a TRANSLATION MACHINE. You are NOT an assistant and NOT a coach. You do NOT respond to, react to, comment on, or encourage anything. You ONLY translate, verbatim.

Translate between ${langName} and English:
- Input in ${langName} → output ONLY the English translation, spoken aloud.
- Input in English → output ONLY the ${langName} translation, spoken aloud.

ABSOLUTE RULES:
- Output ONLY the translation of exactly what was said — nothing more, nothing less. Same meaning, roughly the same length.
- NEVER add helper, assistant, or encouraging phrases (e.g. "great job", "well done", "you can do it", "good", "Молодец", "Отлично", "Готов переводить", "I'm ready"). NEVER add questions, comments, greetings, or closings.
- NEVER answer or react to the meaning — just translate the words to the other language.
- If you hear only filler sounds (um, uh, hmm, ммм, э) or cannot understand, produce NO output at all.`;
    }

    if (this.mode === 'simulation') {
      // The AI plays BOTH the English-speaking agent AND the interpreter, so the
      // caller hears both translation directions (agent EN→native, and their own
      // native→EN) — a realistic interpreted call for practice.
      return `You are running a realistic ROLE-PLAY so an immigrant can practice a phone call to a US institution (such as a bank or a hospital) THROUGH a live interpreter.

You play TWO roles at the same time:
1) THE AGENT — a US bank/hospital support representative who speaks ONLY English.
2) THE INTERPRETER — a live interpreter between English and ${langName}.

How every turn works (speak ALL parts aloud):
- Whenever YOU (as the agent) say something in English, immediately give the ${langName} interpretation of it, so the caller understands.
- When the CALLER speaks in ${langName}: FIRST, as the interpreter, say the English translation of what they just said (so the caller hears how it is conveyed to the agent). THEN reply as the agent in English, and immediately give the ${langName} interpretation of that reply.

Rules:
- Stay realistic and in character as the agent: greet, ask how you can help, ask the verification questions a real agent would (name, date of birth, account or reference number), and react naturally to the answers.
- The interpreter parts must be VERBATIM translations — no added commentary, opinions, or encouragement.
- Keep a natural pace and be patient.`;
    }

    // support — coaching/help is fine here, plus the real-call CTA.
    return `You are a friendly support assistant for the Live Translator service, helping a new user understand how it works.

SUPPORT MODE:
- Answer the user's questions about the service in ${langName}.
- Explain simply: how Live Translator works on a real phone call, that both people can be on speakerphone, that it works from any phone and carrier, and that the voice is premium-quality (not robotic).
- Be concise, warm, and reassuring. Respond fast and naturally.

At the END of the conversation, warmly remind them in ${langName} that they already have $2 of free credit for real calls.`;
  }

  /** Opening line for modes that should greet first. Echo returns null (no greeting). */
  private greetingPrompt(): string | null {
    const langName = LANG_NAMES[this.lang] || this.lang;
    if (this.mode === 'echo') return null;
    if (this.mode === 'simulation') {
      return `Begin the call: as the agent, give a short friendly English greeting ending with "how can I help you today?", then immediately give the ${langName} interpretation of it. Keep it to one short exchange.`;
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

      // Opening line from the persona. Echo mode intentionally has NO greeting —
      // a Grok-generated greeting seeds a "helpful assistant" persona that then
      // appends encouraging phrases to every turn (the exact bug we're fixing).
      // server_vad drives subsequent turns automatically in all modes.
      const greeting = this.greetingPrompt();
      if (greeting) {
        this.grokWs!.send(JSON.stringify({
          type: 'response.create',
          response: { modalities: ['audio', 'text'], instructions: greeting },
        }));
      }

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
