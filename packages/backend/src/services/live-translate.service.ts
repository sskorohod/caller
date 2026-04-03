import pino from 'pino';
import { createSTTProvider, type STTProvider, type TranscriptEvent } from './stt.service.js';
import { createLLMProvider, type LLMProvider, type LLMMessage } from './llm.service.js';
import { getIo } from '../realtime/io.js';

const log = pino({ name: 'live-translate' });

interface LiveTranslatorOptions {
  callId: string;
  workspaceId: string;
  targetLanguage: string;
  mode: 'translate' | 'copilot';
  myLanguage?: string;
  context?: string;
  instant?: boolean;
  sourceLanguage?: string; // language of audio being transcribed (defaults to targetLanguage for backwards compat)
  skipStt?: boolean; // when true, don't create STT — text will be fed via translateText()
}

interface TranslationPayload {
  call_id: string;
  speaker: 'caller';
  original: string;
  translated: string;
  timestamp: string;
}

interface Suggestion {
  text: string;
  translation: string;
}

interface SuggestionsPayload {
  call_id: string;
  suggestions: Suggestion[];
  context_of: string;
}

const MODEL_MAP: Record<string, string> = {
  anthropic: 'claude-sonnet-4-5-20250514',
  xai: 'grok-3-mini-fast',
  openai: 'gpt-4o-mini',
};

export class LiveTranslator {
  private callId: string;
  private workspaceId: string;
  private targetLanguage: string;
  private mode: 'translate' | 'copilot';
  private myLanguage: string;
  private context: string;

  private stt: STTProvider | null = null;
  private llm: LLMProvider | null = null;
  private llmProviderName: string = 'anthropic';
  private accumulatedText: string = '';
  private running: boolean = false;
  private instant: boolean = false;
  private sourceLanguage: string;
  private skipStt: boolean = false;

  constructor(options: LiveTranslatorOptions) {
    this.callId = options.callId;
    this.workspaceId = options.workspaceId;
    this.targetLanguage = options.targetLanguage;
    this.mode = options.mode;
    this.myLanguage = options.myLanguage ?? 'en';
    this.context = options.context ?? 'general phone call';
    this.instant = options.instant ?? false;
    this.sourceLanguage = options.sourceLanguage ?? options.targetLanguage;
    this.skipStt = options.skipStt ?? false;
  }

  async start(): Promise<void> {
    if (this.running) {
      log.warn({ callId: this.callId }, 'LiveTranslator already running');
      return;
    }

    // Resolve LLM provider — prefer fast models for translation (xai → openai → anthropic)
    for (const provider of ['xai', 'openai', 'anthropic'] as const) {
      try {
        this.llm = await createLLMProvider(this.workspaceId, provider);
        this.llmProviderName = provider;
        break;
      } catch {
        log.debug({ provider, callId: this.callId }, 'LLM provider unavailable, trying next');
      }
    }

    if (!this.llm) {
      throw new Error('No LLM provider available for live translation');
    }

    // Skip STT creation if text will be fed directly via translateText()
    if (!this.skipStt) {
      this.stt = await createSTTProvider(this.workspaceId, 'deepgram');

      this.stt.on('transcript', (event: TranscriptEvent) => {
        this.handleTranscript(event);
      });

      this.stt.on('utterance_end', () => {
        this.handleUtteranceEnd();
      });

      this.stt.on('error', (err: Error) => {
        log.error({ err, callId: this.callId }, 'STT error in live translator');
      });

      this.stt.on('close', () => {
        log.info({ callId: this.callId }, 'STT connection closed in live translator');
      });

      this.stt.connect({ language: this.sourceLanguage });
    }

    this.running = true;

    log.info(
      { callId: this.callId, mode: this.mode, targetLanguage: this.targetLanguage, skipStt: this.skipStt },
      'LiveTranslator started',
    );
  }

  /** Feed already-transcribed text directly (bypasses internal STT). */
  translateText(text: string): void {
    if (!this.running || !text.trim()) return;

    if (this.instant) {
      this.translateAndEmit(text.trim()).catch((err) => {
        log.error({ err, callId: this.callId }, 'Instant translation error');
      });
    } else {
      this.accumulatedText += (this.accumulatedText ? ' ' : '') + text.trim();
    }
  }

  /** Flush accumulated text for translation (call on utterance_end). */
  flushTranslation(): void {
    const text = this.accumulatedText.trim();
    this.accumulatedText = '';
    if (!text) return;

    this.translateAndEmit(text).catch((err) => {
      log.error({ err, callId: this.callId }, 'Translation pipeline error');
    });
  }

  feedAudio(buffer: Buffer): void {
    if (!this.running || !this.stt) return;
    this.stt.sendAudio(buffer);
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;

    if (this.stt) {
      this.stt.close();
      this.stt.removeAllListeners();
      this.stt = null;
    }

    this.llm = null;
    this.accumulatedText = '';

    log.info({ callId: this.callId }, 'LiveTranslator stopped');
  }

  /* ------------------------------------------------------------------ */
  /*  Internal handlers                                                  */
  /* ------------------------------------------------------------------ */

  private handleTranscript(event: TranscriptEvent): void {
    if (!event.isFinal || !event.text.trim()) return;

    if (this.instant) {
      // Instant mode: translate each final segment immediately
      this.translateAndEmit(event.text.trim()).catch((err) => {
        log.error({ err, callId: this.callId }, 'Instant translation error');
      });
    } else {
      this.accumulatedText += (this.accumulatedText ? ' ' : '') + event.text.trim();
    }
  }

  private handleUtteranceEnd(): void {
    const text = this.accumulatedText.trim();
    this.accumulatedText = '';

    if (!text) return;

    // Fire-and-forget — errors are logged internally
    this.translateAndEmit(text).catch((err) => {
      log.error({ err, callId: this.callId }, 'Translation pipeline error');
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Translation pipeline                                               */
  /* ------------------------------------------------------------------ */

  private async translateAndEmit(original: string): Promise<void> {
    if (!this.llm) return;

    const model = MODEL_MAP[this.llmProviderName] ?? 'gpt-4o-mini';
    const channel = `call:${this.callId}:translate`;
    const start = Date.now();

    // Step 1: Translate
    const translated = await this.runLLM(
      [
        {
          role: 'system',
          content: `Translate to ${this.targetLanguage}. Phone call fragment. Be natural and concise.\nOnly output the translation, nothing else.`,
        },
        { role: 'user', content: `"${original}"` },
      ],
      model,
    );

    const latency = Date.now() - start;
    log.info({ callId: this.callId, provider: this.llmProviderName, model, latency, original: original.slice(0, 50) }, 'Translation LLM call');

    if (!translated) return;

    // Emit translation
    const io = getIo();
    if (!io) {
      log.warn({ callId: this.callId }, 'Socket.IO not available, cannot emit translation');
      return;
    }

    const translationPayload: TranslationPayload = {
      call_id: this.callId,
      speaker: 'caller',
      original,
      translated,
      timestamp: new Date().toISOString(),
    };

    io.to(channel).emit('call:translation', translationPayload);

    log.debug(
      { callId: this.callId, original, translated },
      'Translation emitted',
    );

    // Step 2: Copilot suggestions (if enabled)
    if (this.mode === 'copilot') {
      await this.generateSuggestions(original, translated, model, channel);
    }
  }

  private async generateSuggestions(
    original: string,
    translated: string,
    model: string,
    channel: string,
  ): Promise<void> {
    const prompt = [
      {
        role: 'system' as const,
        content: [
          `You are helping someone during a phone call about ${this.context}.`,
          `The other person just said: "${original}" (${this.targetLanguage} translation: "${translated}")`,
          '',
          `Suggest 2-3 natural spoken responses in the other person's language.`,
          `Include ${this.myLanguage} translation for each.`,
          `Keep responses conversational and natural for a phone call.`,
          '',
          `Return JSON array: [{"text": "response", "translation": "перевод"}]`,
        ].join('\n'),
      },
      { role: 'user' as const, content: 'Generate suggestions.' },
    ];

    const raw = await this.runLLM(prompt, model);
    if (!raw) return;

    let suggestions: Suggestion[];
    try {
      // Extract JSON array from response (handles markdown code blocks, etc.)
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        log.warn({ callId: this.callId, raw }, 'Could not extract JSON from copilot response');
        return;
      }
      suggestions = JSON.parse(jsonMatch[0]);
    } catch (err) {
      log.warn({ err, callId: this.callId, raw }, 'Failed to parse copilot suggestions JSON');
      return;
    }

    const io = getIo();
    if (!io) return;

    const payload: SuggestionsPayload = {
      call_id: this.callId,
      suggestions,
      context_of: original,
    };

    io.to(channel).emit('call:copilot:suggestions', payload);

    log.debug(
      { callId: this.callId, suggestionsCount: suggestions.length },
      'Copilot suggestions emitted',
    );
  }

  /* ------------------------------------------------------------------ */
  /*  LLM helper                                                         */
  /* ------------------------------------------------------------------ */

  private runLLM(messages: LLMMessage[], model: string): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.llm) {
        resolve(null);
        return;
      }

      let result = '';

      this.llm.generateStream(messages, model, 0.3, {
        onToken: (token: string) => {
          result += token;
        },
        onComplete: () => {
          resolve(result.trim() || null);
        },
        onError: (err: Error) => {
          log.error({ err, callId: this.callId }, 'LLM generation error');
          resolve(null);
        },
      });
    });
  }
}
