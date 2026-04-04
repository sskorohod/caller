import { EventEmitter } from 'node:events';
import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { providerCredentials } from '../db/schema.js';
import { decrypt } from '../lib/crypto.js';

export interface TTSChunk {
  audio: Buffer;
  index: number;
}

/**
 * ElevenLabs streaming TTS.
 * Sends text, receives audio chunks via WebSocket for low-latency playback.
 */
export class ElevenLabsTTS extends EventEmitter {
  private apiKey: string;
  private voiceId: string;

  constructor(apiKey: string, voiceId: string) {
    super();
    this.apiKey = apiKey;
    this.voiceId = voiceId;
  }

  async synthesize(text: string): Promise<Buffer> {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        output_format: 'ulaw_8000',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`ElevenLabs TTS error: ${res.status} ${res.statusText}`);
    }

    const chunks: Buffer[] = [];
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    let chunkIndex = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const buf = Buffer.from(value);
      chunks.push(buf);
      this.emit('chunk', { audio: buf, index: chunkIndex++ } as TTSChunk);
    }

    return Buffer.concat(chunks);
  }
}

/**
 * OpenAI TTS (fallback, cheaper).
 */
export class OpenAITTS extends EventEmitter {
  private apiKey: string;
  private voice: string;

  constructor(apiKey: string, voice = 'alloy') {
    super();
    this.apiKey = apiKey;
    this.voice = voice;
  }

  async synthesize(text: string): Promise<Buffer> {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: this.voice,
        response_format: 'pcm',
        speed: 1.0,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI TTS error: ${res.status} ${res.statusText}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const audio = Buffer.from(arrayBuf);
    this.emit('chunk', { audio, index: 0 } as TTSChunk);
    return audio;
  }
}

/**
 * xAI Grok TTS.
 * Uses xAI native TTS API at api.x.ai/v1/tts with Grok voices: ara, rex, sal, eve, leo.
 * Outputs mulaw 8kHz directly for telephony — no PCM conversion needed.
 */
export class XaiTTS extends EventEmitter {
  private apiKey: string;
  private voice: string;
  /** When true, output is already mulaw 8kHz (no conversion needed) */
  public readonly nativemulaw = true;

  constructor(apiKey: string, voice = 'ara') {
    super();
    this.apiKey = apiKey;
    this.voice = voice.toLowerCase();
  }

  async synthesize(text: string): Promise<Buffer> {
    const res = await fetch('https://api.x.ai/v1/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        text,
        voice_id: this.voice,
        language: 'auto',
        output_format: 'mulaw',
        sample_rate: 8000,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`xAI TTS error: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const audio = Buffer.from(arrayBuf);
    this.emit('chunk', { audio, index: 0 } as TTSChunk);
    return audio;
  }
}

export type TTSProvider = ElevenLabsTTS | OpenAITTS | XaiTTS;

export async function createTTSProvider(
  workspaceId: string,
  provider: 'elevenlabs' | 'openai' | 'xai',
  voiceId?: string,
): Promise<TTSProvider> {
  const [row] = await db
    .select({ credential_data: providerCredentials.credential_data })
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.workspace_id, workspaceId),
        eq(providerCredentials.provider, provider),
      ),
    );

  if (!row) throw new Error(`${provider} TTS credentials not configured`);

  const creds = JSON.parse(decrypt(row.credential_data));

  if (provider === 'elevenlabs') {
    return new ElevenLabsTTS(creds.api_key, voiceId ?? 'EXAVITQu4vr4xnSDxMaL');
  }
  if (provider === 'xai') {
    return new XaiTTS(creds.api_key, voiceId ?? 'ara');
  }
  return new OpenAITTS(creds.api_key, voiceId ?? 'alloy');
}
