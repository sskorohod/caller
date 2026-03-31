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

export type TTSProvider = ElevenLabsTTS | OpenAITTS;

export async function createTTSProvider(
  workspaceId: string,
  provider: 'elevenlabs' | 'openai',
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
  return new OpenAITTS(creds.api_key, voiceId ?? 'alloy');
}
