import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { providerCredentials } from '../db/schema.js';
import { decrypt } from '../lib/crypto.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  latencyMs: number;
}

export interface LLMStreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (response: LLMResponse) => void;
  onError: (error: Error) => void;
}

/**
 * Anthropic (Claude) LLM provider.
 */
export class AnthropicLLM {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateStream(
    messages: LLMMessage[],
    model: string,
    temperature: number,
    callbacks: LLMStreamCallbacks,
  ): Promise<void> {
    const start = Date.now();
    const systemMsg = messages.find(m => m.role === 'system')?.content ?? '';
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      let fullText = '';
      const stream = this.client.messages.stream({
        model,
        max_tokens: 1024,
        temperature,
        system: systemMsg,
        messages: chatMessages,
      });

      stream.on('text', (text) => {
        fullText += text;
        callbacks.onToken(text);
      });

      const finalMessage = await stream.finalMessage();

      callbacks.onComplete({
        text: fullText,
        tokensIn: finalMessage.usage.input_tokens,
        tokensOut: finalMessage.usage.output_tokens,
        model: finalMessage.model,
        latencyMs: Date.now() - start,
      });
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

/**
 * OpenAI LLM provider.
 * Supports custom baseURL for OAuth proxy (e.g. openai-oauth on port 10531).
 */
export class OpenAILLM {
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });
  }

  async generateStream(
    messages: LLMMessage[],
    model: string,
    temperature: number,
    callbacks: LLMStreamCallbacks,
  ): Promise<void> {
    const start = Date.now();

    try {
      let fullText = '';
      let tokensIn = 0;
      let tokensOut = 0;

      const stream = await this.client.chat.completions.create({
        model,
        temperature,
        max_tokens: 1024,
        stream: true,
        stream_options: { include_usage: true },
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          callbacks.onToken(delta);
        }
        if (chunk.usage) {
          tokensIn = chunk.usage.prompt_tokens;
          tokensOut = chunk.usage.completion_tokens;
        }
      }

      callbacks.onComplete({
        text: fullText,
        tokensIn,
        tokensOut,
        model,
        latencyMs: Date.now() - start,
      });
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

export type LLMProvider = AnthropicLLM | OpenAILLM;

export async function createLLMProvider(
  workspaceId: string,
  provider: 'anthropic' | 'openai' | 'openai_proxy' | 'xai',
): Promise<LLMProvider> {
  // OpenAI Proxy mode — uses ChatGPT Plus/Pro subscription via openai-oauth proxy
  const oauthProxyUrl = process.env.OPENAI_OAUTH_PROXY_URL;
  if (provider === 'openai_proxy' && oauthProxyUrl) {
    return new OpenAILLM('dummy', oauthProxyUrl);
  }
  if (provider === 'openai' && oauthProxyUrl) {
    return new OpenAILLM('dummy', oauthProxyUrl);
  }
  // Map openai_proxy back to openai for credential lookup (fallback if no proxy URL)
  const resolvedProvider = provider === 'openai_proxy' ? 'openai' : provider;

  const providerKey = resolvedProvider === 'xai' ? 'xai' : resolvedProvider;

  const { resolveCredentials } = await import('./credential-resolver.service.js');
  const creds = await resolveCredentials(workspaceId, providerKey);

  if (resolvedProvider === 'anthropic') {
    return new AnthropicLLM(creds.api_key);
  }

  if (resolvedProvider === 'xai') {
    // xAI uses OpenAI-compatible API at api.x.ai
    return new OpenAILLM(creds.api_key, 'https://api.x.ai/v1');
  }

  return new OpenAILLM(creds.api_key);
}
