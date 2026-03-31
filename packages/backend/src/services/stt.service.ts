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
    const url = `wss://api.deepgram.com/v1/listen?model=${model}&language=${lang}&punctuate=true&interim_results=true&endpointing=300&utterance_end_ms=1000&vad_events=true&encoding=mulaw&sample_rate=8000&channels=1`;

    this.ws = new WebSocket(url, {
      headers: { Authorization: `Token ${this.apiKey}` },
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
 * OpenAI Whisper streaming STT (fallback).
 * Uses OpenAI's realtime transcription endpoint.
 */
export class OpenAISTT extends EventEmitter {
  private apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  connect(options?: { language?: string }): void {
    // OpenAI Realtime API connection
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';

    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    ws.on('open', () => {
      // Configure session for transcription-only mode
      ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: { type: 'server_vad' },
        },
      }));
      this.emit('open');
    });

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'conversation.item.input_audio_transcription.completed') {
          const event: TranscriptEvent = {
            text: msg.transcript ?? '',
            isFinal: true,
            speaker: 'caller',
            confidence: 1,
            timestamp: new Date().toISOString(),
          };
          this.emit('transcript', event);
        }
      } catch { /* ignore */ }
    });

    ws.on('error', (err: Error) => this.emit('error', err));
    ws.on('close', () => this.emit('close'));
  }

  sendAudio(audioBuffer: Buffer): void {
    // Would send audio_append event to OpenAI Realtime
  }

  close(): void {
    this.emit('close');
  }
}

export type STTProvider = DeepgramSTT | OpenAISTT;

export async function createSTTProvider(workspaceId: string, provider: 'deepgram' | 'openai'): Promise<STTProvider> {
  const [row] = await db
    .select({ credential_data: providerCredentials.credential_data })
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.workspace_id, workspaceId),
        eq(providerCredentials.provider, provider),
      ),
    );

  if (!row) throw new Error(`${provider} credentials not configured`);

  const creds = JSON.parse(decrypt(row.credential_data));

  if (provider === 'deepgram') {
    return new DeepgramSTT(creds.api_key);
  }
  return new OpenAISTT(creds.api_key);
}
