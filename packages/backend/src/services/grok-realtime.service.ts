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

    const instructions = this.config.callerContext
      ? `${this.config.systemPrompt}\n\nContext about this caller:\n${this.config.callerContext}`
      : this.config.systemPrompt;

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
        input_audio_transcription: { model: 'grok-2-latest' },
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

    this.turnCount++;
    logger.info({ callId: this.config.call.id, turn: this.turnCount, text: transcript }, 'Caller utterance (Grok)');

    this.conversationHistory.push({
      speaker: 'caller',
      text: transcript.trim(),
      timestamp: new Date().toISOString(),
    });
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
    if (this.currentAgentTranscript.trim()) {
      this.conversationHistory.push({
        speaker: 'agent',
        text: this.currentAgentTranscript.trim(),
        timestamp: new Date().toISOString(),
      });

      logger.info(
        { callId: this.config.call.id, text: this.currentAgentTranscript.trim() },
        'Agent response (Grok)',
      );
    }

    this.currentAgentTranscript = '';
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
