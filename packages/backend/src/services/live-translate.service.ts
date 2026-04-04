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
  openai: process.env.OPENAI_OAUTH_PROXY_URL ? 'gpt-5.4-mini' : 'gpt-4o-mini',
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

  // Speculative translation state
  private lastInterimText: string = '';
  private lastInterimTranslation: string = '';
  private interimDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingInterimTranslation: boolean = false;

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

    // Resolve LLM provider — OpenAI first (GPT-4o-mini fastest for translation)
    for (const provider of ['openai', 'xai'] as const) {
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
    if (this.interimDebounceTimer) {
      clearTimeout(this.interimDebounceTimer);
      this.interimDebounceTimer = null;
    }

    log.info({ callId: this.callId }, 'LiveTranslator stopped');
  }

  /* ------------------------------------------------------------------ */
  /*  Internal handlers                                                  */
  /* ------------------------------------------------------------------ */

  private handleTranscript(event: TranscriptEvent): void {
    const text = event.text.trim();
    if (!text) return;

    if (event.isFinal) {
      // Cancel any pending interim translation
      if (this.interimDebounceTimer) {
        clearTimeout(this.interimDebounceTimer);
        this.interimDebounceTimer = null;
      }

      if (this.instant) {
        // Check if we already translated this via interim (speculative)
        if (this.lastInterimTranslation && this.textSimilar(text, this.lastInterimText)) {
          // Interim translation was close enough — skip re-translating
          this.lastInterimText = '';
          this.lastInterimTranslation = '';
          return;
        }
        this.lastInterimText = '';
        this.lastInterimTranslation = '';
        this.translateAndEmit(text).catch((err) => {
          log.error({ err, callId: this.callId }, 'Instant translation error');
        });
      } else {
        this.accumulatedText += (this.accumulatedText ? ' ' : '') + text;
      }
    } else {
      // Interim result — speculative translation with debounce
      // Only translate if we have enough words (>3) and not already translating
      const wordCount = text.split(/\s+/).length;
      if (wordCount >= 3 && !this.pendingInterimTranslation) {
        if (this.interimDebounceTimer) clearTimeout(this.interimDebounceTimer);
        this.interimDebounceTimer = setTimeout(() => {
          this.speculativeTranslate(text);
        }, 150); // 150ms debounce
      }
    }
  }

  /** Check if two texts are similar enough to skip re-translation */
  private textSimilar(a: string, b: string): boolean {
    if (!a || !b) return false;
    const al = a.toLowerCase().replace(/[^\w\s]/g, '');
    const bl = b.toLowerCase().replace(/[^\w\s]/g, '');
    if (al === bl) return true;
    // Check if >80% of words overlap
    const aWords = new Set(al.split(/\s+/));
    const bWords = bl.split(/\s+/);
    const overlap = bWords.filter(w => aWords.has(w)).length;
    return overlap / Math.max(aWords.size, bWords.length) > 0.8;
  }

  /** Speculative translation from interim results — sends early translation */
  private speculativeTranslate(interimText: string): void {
    if (!this.running || !this.llm || this.pendingInterimTranslation) return;
    this.pendingInterimTranslation = true;
    this.lastInterimText = interimText;

    this.translateAndEmitSpeculative(interimText).catch((err) => {
      log.error({ err, callId: this.callId }, 'Speculative translation error');
    }).finally(() => {
      this.pendingInterimTranslation = false;
    });
  }

  /** Translate and emit as speculative (early) result */
  private async translateAndEmitSpeculative(original: string): Promise<void> {
    if (!this.llm) return;

    const model = MODEL_MAP[this.llmProviderName] ?? 'gpt-4o-mini';
    const channel = `call:${this.callId}:translate`;

    const translated = await this.runLLMFast(
      [
        {
          role: 'system',
          content: `Translate to ${this.targetLanguage}. Phone call fragment. Be natural and concise.\nOnly output the translation, nothing else.`,
        },
        { role: 'user', content: `"${original}"` },
      ],
      model,
      150,
    );

    if (!translated) return;

    this.lastInterimTranslation = translated;

    const io = getIo();
    if (!io) return;

    const translationPayload: TranslationPayload = {
      call_id: this.callId,
      speaker: 'caller',
      original,
      translated,
      timestamp: new Date().toISOString(),
    };

    io.to(channel).emit('call:translation', translationPayload);
    log.debug({ callId: this.callId, original: original.slice(0, 40), speculative: true }, 'Speculative translation emitted');
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

    // Step 1: Translate (non-streaming for speed — translation is short)
    const translated = await this.runLLMFast(
      [
        {
          role: 'system',
          content: `Translate to ${this.targetLanguage}. Phone call fragment. Be natural and concise.\nOnly output the translation, nothing else.`,
        },
        { role: 'user', content: `"${original}"` },
      ],
      model,
      150,
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

  /** Fast non-streaming LLM call for short translations. */
  private async runLLMFast(messages: LLMMessage[], model: string, maxTokens: number = 150): Promise<string | null> {
    if (!this.llm) return null;

    try {
      // Access the underlying OpenAI client for non-streaming call
      const client = (this.llm as any).client;
      if (client?.chat?.completions?.create) {
        const response = await client.chat.completions.create({
          model,
          temperature: 0.3,
          max_tokens: maxTokens,
          stream: false,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        });
        return response.choices?.[0]?.message?.content?.trim() || null;
      }
    } catch (err) {
      log.error({ err, callId: this.callId }, 'Fast LLM call failed, falling back to stream');
    }

    // Fallback to streaming
    return this.runLLM(messages, model);
  }

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
