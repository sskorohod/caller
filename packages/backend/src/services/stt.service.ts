import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { providerCredentials } from '../db/schema.js';
import { decrypt } from '../lib/crypto.js';

export interface TranscriptEvent {
  text: string;
  isFinal: boolean;
  speaker: 'caller' | 'agent';
  confidence: number;
  timestamp: string;
}

/**
 * Deepgram streaming STT client.
 * Connects to Deepgram's WebSocket API for real-time speech-to-text.
 */
export class DeepgramSTT extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  connect(options?: { language?: string; model?: string }): void {
    const lang = options?.language ?? 'en-US';
    const model = options?.model ?? 'nova-2';
    const url = `wss://api.deepgram.com/v1/listen?model=${model}&language=${lang}&punctuate=true&interim_results=true&endpointing=200&utterance_end_ms=1000&vad_events=true&encoding=mulaw&sample_rate=8000&channels=1`;

    this.ws = new WebSocket(url, {
      headers: { Authorization: `Token ${this.apiKey}` },
    });

    this.ws.on('upgrade', (res: any) => {
      // Connection succeeded
    });

    this.ws.on('unexpected-response', (_req: any, res: any) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        const errMsg = `Deepgram HTTP ${res.statusCode}: ${body.slice(0, 300)}`;
        this.emit('error', new Error(errMsg));
      });
    });

    this.ws.on('open', () => this.emit('open'));

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'Results') {
          const alt = msg.channel?.alternatives?.[0];
          if (alt && alt.transcript) {
            const event: TranscriptEvent = {
              text: alt.transcript,
              isFinal: msg.is_final ?? false,
              speaker: 'caller',
              confidence: alt.confidence ?? 0,
              timestamp: new Date().toISOString(),
            };
            this.emit('transcript', event);
          }
        }

        if (msg.type === 'UtteranceEnd') {
          this.emit('utterance_end');
        }

        if (msg.type === 'SpeechStarted') {
          this.emit('speech_started');
        }
      } catch {
        // ignore parse errors
      }
    });

    this.ws.on('error', (err: Error) => this.emit('error', err));
    this.ws.on('close', () => this.emit('close'));
  }

  /** Force Deepgram to emit buffered audio as a final transcript immediately. */
  finalize(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'Finalize' }));
    }
  }

  sendAudio(audioBuffer: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioBuffer);
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * OpenAI Whisper streaming STT.
 * Uses OpenAI's Realtime API in transcription-only mode.
 * Auto-detects language. Supports mulaw 8000Hz input (converted to PCM16 24kHz).
 */
export class OpenAISTT extends EventEmitter {
  private apiKey: string;
  private ws: WebSocket | null = null;
  private utteranceTimer: ReturnType<typeof setTimeout> | null = null;
  private hasNewTranscript: boolean = false;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  connect(options?: { language?: string }): void {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview';

    this.ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    this.ws.on('open', () => {
      // Configure session for transcription-only mode with VAD
      this.ws!.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text'],
          input_audio_format: 'g711_ulaw',
          input_audio_transcription: { model: 'whisper-1', language: options?.language || undefined },
          turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 800 },
        },
      }));
      this.emit('open');
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        // VAD detected speech start
        if (msg.type === 'input_audio_buffer.speech_started') {
          this.emit('speech_started');
        }

        // VAD detected speech stop → utterance end
        if (msg.type === 'input_audio_buffer.speech_stopped') {
          // Emit utterance_end after a short delay to let transcription arrive
          if (this.utteranceTimer) clearTimeout(this.utteranceTimer);
          this.hasNewTranscript = false;
          this.utteranceTimer = setTimeout(() => {
            this.emit('utterance_end');
          }, 500);
        }

        // Transcription completed for a conversation turn
        if (msg.type === 'conversation.item.input_audio_transcription.completed') {
          const text = msg.transcript ?? '';
          if (text.trim()) {
            const event: TranscriptEvent = {
              text: text.trim(),
              isFinal: true,
              speaker: 'caller',
              confidence: 1,
              timestamp: new Date().toISOString(),
            };
            this.emit('transcript', event);
            this.hasNewTranscript = true;

            // Emit utterance_end shortly after final transcript
            if (this.utteranceTimer) clearTimeout(this.utteranceTimer);
            this.utteranceTimer = setTimeout(() => {
              this.emit('utterance_end');
            }, 300);
          }
        }
      } catch { /* ignore parse errors */ }
    });

    this.ws.on('error', (err: Error) => this.emit('error', err));
    this.ws.on('close', () => this.emit('close'));
  }

  sendAudio(audioBuffer: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // OpenAI Realtime expects base64-encoded audio in input_audio_buffer.append
      this.ws.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioBuffer.toString('base64'),
      }));
    }
  }

  close(): void {
    if (this.utteranceTimer) clearTimeout(this.utteranceTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export type STTProvider = DeepgramSTT | OpenAISTT;

export async function createSTTProvider(workspaceId: string, provider: 'deepgram' | 'openai'): Promise<STTProvider> {
  // Try own credentials first, then fallback to platform (owner workspace) credentials
  let [row] = await db
    .select({ credential_data: providerCredentials.credential_data })
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.workspace_id, workspaceId),
        eq(providerCredentials.provider, provider),
      ),
    );

  if (!row) {
    // Fallback: find owner workspace with this provider configured
    const { workspaceMembers } = await import('../db/schema.js');
    const [ownerRow] = await db
      .select({ credential_data: providerCredentials.credential_data })
      .from(providerCredentials)
      .innerJoin(workspaceMembers, and(
        eq(workspaceMembers.workspace_id, providerCredentials.workspace_id),
        eq(workspaceMembers.role, 'owner'),
      ))
      .where(eq(providerCredentials.provider, provider))
      .limit(1);
    if (ownerRow) row = ownerRow;
  }

  if (!row) throw new Error(`${provider} credentials not configured`);

  const creds = JSON.parse(decrypt(row.credential_data));

  if (provider === 'deepgram') {
    return new DeepgramSTT(creds.api_key);
  }
  return new OpenAISTT(creds.api_key);
}
