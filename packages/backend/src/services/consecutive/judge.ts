/**
 * Turn-taking judge: two small, fast classifiers over the live transcript.
 *
 * The consecutive translator's core needs two decisions that neither a pause nor punctuation
 * gives it. First: has the speaker finished the thought — a pause before "that", or midway
 * through dictating a number, is not the end of a turn, but a short "Yes." is. Second: what
 * speech over the playing translation means — a request to stop, a plain "uh-huh", or a remark
 * that can wait until the translation ends. The live transcript arrives without a trailing
 * period and with recognition errors, so a model judges it by meaning.
 *
 * Model and call shape are from a live-API measurement on 2026-09-24 (warm client, JSON
 * schema): gpt-4.1-mini answered in 0.63-0.96s and got 8/8 right; GPT-6 Luna was 0.73-1.38s;
 * gpt-4.1-nano was fast but wrong. The Responses API was ~0.4s slower on the same prompts,
 * hence Chat Completions.
 *
 * The judge only advises. Any failure — timeout, exception, garbage JSON, an unknown label —
 * returns null: the core decides on its own, from pause and timers, and the call never waits on
 * the model or crashes because of it.
 */

import pino from 'pino';
import { calculateLLMCost } from '../../config/pricing.js';

const log = pino({ name: 'consecutive' });

export const JUDGE_MODEL = 'gpt-4.1-mini';
// Margin over the worst measured 0.96s; a later answer is useless — the core decides without it.
export const TIMEOUT_MS = 2500;
export const INTENTS = ['interrupt', 'ack', 'later'] as const;
export type IntentLabel = (typeof INTENTS)[number];

export interface ChatClientLike {
  chat: { completions: { create(body: any, options?: any): Promise<any> } };
}

// strict: the model can't physically return anything but these fields, so free text never needs
// parsing. The schema has no way to hold a confidence range — we clamp it ourselves.
const END_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['complete', 'confidence'],
  properties: { complete: { type: 'boolean' }, confidence: { type: 'number' } },
};
const INTENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'confidence'],
  properties: { intent: { type: 'string', enum: [...INTENTS] }, confidence: { type: 'number' } },
};

// Prompts are deliberately short: the judge answers while the line is paused, and every extra
// word is a delay before the translation. The call's language pair is substituted in below.
const END_PROMPT =
  "You watch a live phone call between people speaking {first} and {second}.\nThe user message is the current utterance as live speech-to-text: final punctuation may be missing, small recognition errors are normal.\nHas the speaker finished the thought (complete: true), or will they continue (complete: false)?\nIncomplete: ends on a conjunction, preposition or linking word (and, because, that, to — in either language), a filler (um, uh), an open list, a number or address dictated halfway, or a phrase that needs its continuation, or a story in progress (announced, or the last sentence sets up more) even if that sentence is finished.\nComplete: a finished statement, question or request, including short answers like \"Yes.\" or \"Okay\", even without a final period.\nJudge meaning, not punctuation. confidence: 0 to 1, lower when unsure.";

const INTENT_PROMPT =
  "You assist an interpreter on a live phone call between people speaking {first} and {second}.\nSomeone spoke over the interpreter's translation while it played. You get the translation (Playing) and what was said (Heard). Heard is live speech-to-text: punctuation may be missing, small recognition errors are normal.\nClassify Heard:\n- interrupt: the interpreter must stop now — an objection or correction (\"no, that's wrong\"), \"wait\", \"stop\", an urgent question (\"what?\"), or the original speaker correcting themselves.\n- ack: only acknowledgement or agreement (\"yeah, okay, I understand\").\n- later: a real remark or question that can wait until the translation ends.\nGarbled or meaningless text, or a distorted piece of Playing (our own voice leaking back): ack, low confidence. confidence: 0 to 1, lower when unsure.";

function clampConfidence(value: any): number {
  if (typeof value !== 'number') throw new Error('confidence is not a number');
  return Math.min(Math.max(value, 0), 1);
}

function parseEnd(data: any): [boolean, number] {
  if (typeof data.complete !== 'boolean') throw new Error('complete is not a boolean');
  return [data.complete, clampConfidence(data.confidence)];
}

function parseIntent(data: any): [IntentLabel, number] {
  if (!INTENTS.includes(data.intent)) throw new Error('unknown intent');
  return [data.intent, clampConfidence(data.confidence)];
}

/**
 * Both classifiers for one call, and their usage/cost counters. `client` is the OpenAI SDK (or
 * a compatible fake), on the platform account's key.
 */
export class Judge {
  readonly usage = { calls: 0, errors: 0, in: 0, cached: 0, out: 0 };
  private endPrompt = '';
  private intentPrompt = '';

  constructor(private readonly client: ChatClientLike, opts: { languages: [string, string] }) {
    this.setLanguages(opts.languages);
  }

  /** Rebuilds both prompts for a (possibly changed) call language pair. */
  setLanguages(languages: [string, string]): void {
    const [first, second] = languages;
    this.endPrompt = END_PROMPT.replaceAll('{first}', first).replaceAll('{second}', second);
    this.intentPrompt = INTENT_PROMPT.replaceAll('{first}', first).replaceAll('{second}', second);
  }

  /** Whether the speaker finished the thought: [complete, confidence], or null if the judge didn't answer. */
  async semanticEnd(text: string): Promise<[boolean, number] | null> {
    text = text.trim();
    if (!text) return null;
    return this.ask('semantic_end', END_SCHEMA, this.endPrompt, text, parseEnd);
  }

  /**
   * What speech over the translation means: [label from INTENTS, confidence], or null.
   * `playing` is the text of the translation currently playing — without it a bare "no" can't
   * be told apart from an objection or an answer to a question.
   */
  async intent(text: string, playing: string): Promise<[IntentLabel, number] | null> {
    text = text.trim();
    if (!text) return null;
    return this.ask('intent', INTENT_SCHEMA, this.intentPrompt, `Playing: ${playing}\nHeard: ${text}`, parseIntent);
  }

  costUsd(): number {
    return calculateLLMCost(JUDGE_MODEL, this.usage.in, this.usage.out);
  }

  private async ask<T>(
    name: string,
    schema: Record<string, unknown>,
    system: string,
    user: string,
    parse: (data: any) => T,
  ): Promise<T | null> {
    this.usage.calls++;
    try {
      const response = await this.client.chat.completions.create(
        {
          model: JUDGE_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_schema', json_schema: { name, schema, strict: true } },
          // the answer is a two-field JSON, a dozen tokens; a truncated one would not parse and becomes null
          max_tokens: 40,
          temperature: 0,
        },
        { signal: AbortSignal.timeout(TIMEOUT_MS), maxRetries: 0 }, // a late verdict is useless; no SDK retries
      );
      this.count(response.usage); // before parsing: an unparsed answer is still paid for
      return parse(JSON.parse(response.choices[0].message.content || ''));
    } catch (err) {
      // the judge only advises: any failure means "don't know", not a crashed call. The error
      // text can carry the API key, so only the exception class name may reach the log.
      this.usage.errors++;
      log.warn({ judge: name, errorName: (err as Error)?.name }, 'consecutive judge call failed');
      return null;
    }
  }

  private count(usage: any): void {
    if (usage == null) return;
    const details = usage.prompt_tokens_details;
    this.usage.in += Number(usage.prompt_tokens) || 0;
    this.usage.cached += Number(details?.cached_tokens) || 0;
    this.usage.out += Number(usage.completion_tokens) || 0;
  }
}
