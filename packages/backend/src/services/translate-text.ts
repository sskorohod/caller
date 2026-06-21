import pino from 'pino';

const log = pino({ name: 'translate-text' });

/** Default fast text-translation model on xAI (OpenAI-compatible chat endpoint). */
export const DEFAULT_TRANSLATE_MODEL = process.env.TRANSLATE_TEXT_MODEL || 'grok-3-mini';

export interface TranslateTextOptions {
  apiKey: string;
  /** Override the model (e.g. swap grok-3-mini → gpt-4o-mini). Defaults to DEFAULT_TRANSLATE_MODEL. */
  model?: string;
  /** xAI is OpenAI-compatible; override only if pointing at a different base URL. */
  baseUrl?: string;
  /** Abort the request after this many ms (default 6000). */
  timeoutMs?: number;
}

/**
 * Non-realtime text translation via an OpenAI-compatible chat endpoint (xAI by
 * default). The reliable, low-latency path used by:
 *   - ConferenceTranslator, when the realtime Voice Agent fails to translate
 *   - StealthTranslator, for every per-chunk translation
 *
 * Returns null on any error/empty so callers can mark the turn untranslated.
 */
export async function translateText(
  text: string,
  targetLangName: string,
  opts: TranslateTextOptions,
): Promise<string | null> {
  const base = opts.baseUrl || 'https://api.x.ai/v1';
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model || DEFAULT_TRANSLATE_MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: `You are a translation machine. Translate the user's message into ${targetLangName}. Output ONLY the ${targetLangName} translation — no quotes, no commentary, nothing else.` },
          { role: 'user', content: text },
        ],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 6000),
    });
    if (!res.ok) throw new Error(`text translate: HTTP ${res.status}`);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const out = data.choices?.[0]?.message?.content?.trim();
    return out || null;
  } catch (err) {
    log.warn({ err }, 'Text translation request failed');
    return null;
  }
}
