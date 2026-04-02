import { EventEmitter } from 'node:events';
import pino from 'pino';
import WebSocket from 'ws';
import type { WebSocket as TWS } from 'ws';
import type { AgentProfile, Call } from '../models/types.js';

const logger = pino({ name: 'grok-realtime' });

const GROK_REALTIME_URL = 'wss://api.x.ai/v1/realtime';

export interface GrokRealtimeConfig {
  call: Call;
  agentProfile: AgentProfile;
  twilioWs: TWS;
  streamSid: string;
  systemPrompt: string;
  callerContext?: string;
  apiKey: string;
  timezone?: string;
}

interface ConversationTurn {
  speaker: 'caller' | 'agent';
  text: string;
  timestamp: string;
}

/**
 * Orchestrates a phone call via Grok Realtime API (voice-to-voice).
 * Replaces the STT -> LLM -> TTS pipeline with a single WebSocket connection
 * when both voice_provider and llm_provider are 'xai'.
 */
export class GrokRealtimeOrchestrator extends EventEmitter {
  private config: GrokRealtimeConfig;
  private grokWs: WebSocket | null = null;
  private conversationHistory: ConversationTurn[] = [];
  private turnCount = 0;
  private isStopped = false;
  private currentAgentTranscript = '';
  private currentInstructions = '';
  private pendingHangup = false;

  constructor(config: GrokRealtimeConfig) {
    super();
    this.config = config;
  }

  start(): void {
    logger.info({ callId: this.config.call.id }, 'Starting Grok Realtime orchestration');
    this.connectGrok();
  }

  private connectGrok(): void {
    const { apiKey } = this.config;

    this.grokWs = new WebSocket(GROK_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    this.grokWs.on('open', () => {
      logger.info({ callId: this.config.call.id }, 'Grok Realtime WebSocket connected');
    });

    this.grokWs.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleGrokMessage(msg);
      } catch (err) {
        logger.error({ err, callId: this.config.call.id }, 'Error parsing Grok message');
      }
    });

    this.grokWs.on('error', (err) => {
      logger.error({ err, callId: this.config.call.id }, 'Grok Realtime WebSocket error');
      this.emit('error', err);
    });

    this.grokWs.on('close', (code, reason) => {
      logger.info(
        { callId: this.config.call.id, code, reason: reason.toString() },
        'Grok Realtime WebSocket closed',
      );
      if (!this.isStopped) {
        this.stop('grok_disconnected');
      }
    });
  }

  private handleGrokMessage(msg: Record<string, unknown>): void {
    if (this.isStopped) return;

    const type = msg.type as string;

    switch (type) {
      case 'conversation.created':
        this.onConversationCreated();
        break;

      case 'session.updated':
        this.onSessionUpdated();
        break;

      case 'response.output_audio.delta':
        this.onAudioDelta(msg);
        break;

      case 'input_audio_buffer.speech_started':
        this.onSpeechStarted();
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.onCallerTranscript(msg);
        break;

      case 'response.output_audio_transcript.delta':
        this.onAgentTranscriptDelta(msg);
        break;

      case 'response.done':
        this.onResponseDone();
        break;

      case 'response.output_item.done':
        this.onOutputItemDone(msg);
        break;

      case 'error':
        logger.error({ callId: this.config.call.id, error: msg.error }, 'Grok Realtime error event');
        this.emit('error', new Error(JSON.stringify(msg.error)));
        break;

      default:
        logger.info({ callId: this.config.call.id, type }, 'Grok event');
        break;
    }
  }

  /**
   * On conversation.created, configure the session with voice, audio format, and system prompt.
   */
  private onConversationCreated(): void {
    logger.info({ callId: this.config.call.id }, 'Grok conversation created, sending session.update');

    const lang = this.config.agentProfile.language;
    const langInstruction = lang === 'auto'
      ? '\n\nIMPORTANT: Detect the language the caller is speaking and respond in the same language. Switch languages mid-conversation if the caller switches.'
      : `\n\nIMPORTANT: Always respond in ${lang === 'ru' ? 'Russian' : lang === 'es' ? 'Spanish' : lang === 'de' ? 'German' : lang === 'fr' ? 'French' : 'English'}.`;

    // Add current date/time in workspace timezone
    const tz = this.config.timezone || 'America/Los_Angeles';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const currentTime = formatter.format(now);

    let instructions = this.config.systemPrompt + langInstruction;
    instructions += `\n\nCURRENT DATE/TIME: ${currentTime} (${tz})`;

    if (this.config.callerContext) {
      instructions += `\n\nContext about this caller:\n${this.config.callerContext}`;
    }

    instructions += `\n\nPHONE CONVERSATION RULES:\n` +
      `- This is a PHONE call. Keep responses SHORT — 1-2 sentences max. Be concise and natural.\n` +
      `- Do NOT write long paragraphs. People can't read on a phone call — they listen.\n` +
      `- Sound natural, like a real person on a phone, not a chatbot.\n\n` +
      `CALL ENDING RULES:\n` +
      `- Only call end_call when the caller EXPLICITLY says goodbye: "пока", "до свидания", "bye", "that's all goodbye".\n` +
      `- Do NOT end the call just because the caller said "спасибо" or "thanks" — that's just politeness, not goodbye.\n` +
      `- When an operator instructs you to end the call — politely wrap up and then call end_call.\n` +
      `- When ending: ONE short farewell sentence, then end_call. Do not keep talking after.`;

    this.currentInstructions = instructions;

    this.sendGrok({
      type: 'session.update',
      session: {
        instructions,
        voice: this.config.agentProfile.voice_id ?? 'eve',
        audio: {
          input: { format: { type: 'audio/pcmu' } },
          output: { format: { type: 'audio/pcmu' } },
        },
        turn_detection: { type: 'server_vad' },
        input_audio_transcription: { model: 'grok-3-mini' },
        tools: [{
          type: 'function',
          name: 'end_call',
          description: 'End the phone call. Use this when: the caller says goodbye, the conversation is clearly over, or the operator instructs to end the call.',
          parameters: { type: 'object', properties: { reason: { type: 'string', description: 'Brief reason for ending' } } },
        }],
      },
    });
  }

  /**
   * On session.updated, trigger the greeting by creating a response.
   */
  private onSessionUpdated(): void {
    this.sessionReady = true;
    logger.info({ callId: this.config.call.id }, 'Grok session updated, triggering greeting');

    const greeting = this.config.agentProfile.greeting_message;
    if (greeting) {
      // Use response.create with an initial message to trigger greeting
      this.sendGrok({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `[System: The call just connected. Greet the caller with: "${greeting}"]`,
            },
          ],
        },
      });
    }

    this.sendGrok({ type: 'response.create' });
  }

  /**
   * Forward audio delta from Grok to Twilio.
   */
  private onAudioDelta(msg: Record<string, unknown>): void {
    const delta = msg.delta as string;
    if (!delta) return;

    this.sendTwilio({
      event: 'media',
      streamSid: this.config.streamSid,
      media: { payload: delta },
    });
  }

  /**
   * On caller speech start, clear Twilio audio queue (barge-in).
   */
  private onSpeechStarted(): void {
    logger.debug({ callId: this.config.call.id }, 'Caller speech started (barge-in)');
    this.sendTwilio({
      event: 'clear',
      streamSid: this.config.streamSid,
    });
  }

  /**
   * Record caller transcript when transcription completes.
   */
  private onCallerTranscript(msg: Record<string, unknown>): void {
    const transcript = msg.transcript as string;
    if (!transcript?.trim()) return;

    // If caller speaks after end_call was triggered, cancel hangup — they want to continue
    if (this.pendingHangup) {
      logger.info({ callId: this.config.call.id }, 'Caller spoke after end_call — cancelling hangup');
      this.pendingHangup = false;
    }

    this.turnCount++;
    logger.info({ callId: this.config.call.id, turn: this.turnCount, text: transcript }, 'Caller utterance (Grok)');

    this.conversationHistory.push({
      speaker: 'caller',
      text: transcript.trim(),
      timestamp: new Date().toISOString(),
    });

    this.emit('transcript', { speaker: 'caller', text: transcript.trim(), timestamp: new Date().toISOString(), isFinal: true });
  }

  /**
   * Accumulate agent transcript deltas.
   */
  private onAgentTranscriptDelta(msg: Record<string, unknown>): void {
    const delta = msg.delta as string;
    if (delta) {
      this.currentAgentTranscript += delta;
    }
  }

  /**
   * On response.done, save the accumulated agent transcript.
   */
  private onResponseDone(): void {
    const text = this.currentAgentTranscript.trim();
    if (text) {
      // Deduplicate: skip if identical to last agent response
      const lastAgent = [...this.conversationHistory].reverse().find(t => t.speaker === 'agent');
      if (lastAgent && lastAgent.text === text) {
        logger.debug({ callId: this.config.call.id }, 'Skipping duplicate agent response');
        this.currentAgentTranscript = '';
        return;
      }

      this.conversationHistory.push({ speaker: 'agent', text, timestamp: new Date().toISOString() });
      logger.info({ callId: this.config.call.id, text }, 'Agent response (Grok)');
      this.emit('transcript', { speaker: 'agent', text, timestamp: new Date().toISOString(), isFinal: true });
    }

    this.currentAgentTranscript = '';
  }

  /**
   * Handle completed output items — check for function calls (e.g. end_call).
   */
  private onOutputItemDone(msg: Record<string, unknown>): void {
    const item = msg.item as Record<string, unknown> | undefined;
    if (!item || item.type !== 'function_call') return;

    const functionName = item.name as string;
    const callId = item.call_id as string;

    if (functionName === 'end_call') {
      logger.info({ callId: this.config.call.id }, 'Grok called end_call — waiting for goodbye to finish');

      // Send function result back — tell Grok to say goodbye first
      this.sendGrok({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify({ status: 'say_goodbye_first', instruction: 'Say your goodbye phrase now, then the call will end.' }),
        },
      });
      this.sendGrok({ type: 'response.create' });

      // Wait 6 seconds for:
      // 1. Grok to finish saying goodbye (~3s)
      // 2. Caller to potentially respond (~3s)
      // If caller speaks, Grok will respond naturally (VAD still active)
      // After 6s, hang up regardless
      this.pendingHangup = true;
      setTimeout(() => {
        if (!this.pendingHangup || this.isStopped) return;
        logger.info({ callId: this.config.call.id }, 'Hanging up after goodbye delay');
        this.stop('agent_ended_call');
        try { this.config.twilioWs.close(); } catch { /* ignore */ }
      }, 6000);
    }
  }

  /**
   * Send incoming Twilio audio to Grok Realtime.
   */
  private audioPacketCount = 0;
  private sessionReady = false;

  sendAudio(payload: string): void {
    if (this.isStopped || !this.sessionReady) return;

    this.audioPacketCount++;
    if (this.audioPacketCount === 1 || this.audioPacketCount % 500 === 0) {
      logger.info({ callId: this.config.call.id, packets: this.audioPacketCount, grokState: this.grokWs?.readyState }, 'Audio packets sent to Grok');
    }

    this.sendGrok({
      type: 'input_audio_buffer.append',
      audio: payload,
    });
  }

  stop(reason = 'normal'): void {
    if (this.isStopped) return;
    this.isStopped = true;

    logger.info({ callId: this.config.call.id, reason }, 'Stopping Grok Realtime orchestration');

    if (this.grokWs && this.grokWs.readyState === WebSocket.OPEN) {
      this.grokWs.close();
    }
    this.grokWs = null;

    this.emit('stopped', {
      reason,
      conversationHistory: this.conversationHistory,
      turnCount: this.turnCount,
      totalTokensIn: 0,
      totalTokensOut: 0,
      avgLatencyMs: null,
    });
  }

  getTranscript(): ConversationTurn[] {
    return [...this.conversationHistory];
  }

  injectInstruction(text: string): void {
    // Add instruction as a system message in the conversation history.
    // This does NOT interrupt the current response or reset context.
    // The agent will see it and naturally incorporate it in the next turn.
    // We do NOT use session.update (resets context) or response.cancel (interrupts).
    this.sendGrok({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
        content: [{
          type: 'input_text',
          text: `[OPERATOR INSTRUCTION — Rules for handling this:\n` +
            `1. You are MID-CONVERSATION. Do NOT greet again. Do NOT restart.\n` +
            `2. IMPORTANT: Unless the instruction explicitly says "keep trying", "convince", "persist", or "repeat until" — ` +
            `treat it as a ONE-TIME action. Say it ONCE naturally, then move on. Do NOT repeat it in subsequent responses.\n` +
            `3. Weave it smoothly into the current topic. Don't abruptly change subject.\n` +
            `4. After you've done it once, consider this instruction COMPLETED and forget about it.\n\n` +
            `Instruction: ${text}]`,
        }],
      },
    });

    // Do NOT send response.create — let the natural conversation flow continue.
    // The instruction will be picked up when the caller speaks next and Grok generates a response.

    logger.info({ callId: this.config.call.id, instruction: text }, 'Instruction added to conversation (smooth mode)');
  }

  private sendGrok(msg: Record<string, unknown>): void {
    if (this.grokWs && this.grokWs.readyState === WebSocket.OPEN) {
      this.grokWs.send(JSON.stringify(msg));
    }
  }

  private sendTwilio(msg: Record<string, unknown>): void {
    const { twilioWs } = this.config;
    if (twilioWs.readyState === twilioWs.OPEN) {
      twilioWs.send(JSON.stringify(msg));
    }
  }
}
