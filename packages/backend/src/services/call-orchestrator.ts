import { EventEmitter } from 'node:events';
import pino from 'pino';
import type { WebSocket } from 'ws';
import type { DeepgramSTT } from './stt.service.js';
import type { TTSProvider } from './tts.service.js';
import type { LLMProvider, LLMMessage, LLMResponse } from './llm.service.js';
import type { AgentProfile, Call } from '../models/types.js';
import * as callService from './call.service.js';

const logger = pino({ name: 'call-orchestrator' });

const FILLER_TIMEOUT_MS = 1500;
const FILLER_PHRASES: Record<string, string[]> = {
  en: ['One moment...', 'Let me check...', 'Just a second...'],
  ru: ['Одну секунду...', 'Сейчас проверю...', 'Минуточку...'],
};

export interface CallOrchestratorConfig {
  call: Call;
  agentProfile: AgentProfile;
  stt: DeepgramSTT;
  tts: TTSProvider;
  llm: LLMProvider;
  twilioWs: WebSocket;
  streamSid: string;
  language: string;
  systemPrompt: string;
  callerContext?: string; // memory/knowledge context
  knowledgeSearch?: (query: string) => Promise<Array<{ chunk_text: string; similarity: number; document_title: string }>>;
}

interface ConversationTurn {
  speaker: 'caller' | 'agent';
  text: string;
  timestamp: string;
}

/**
 * Orchestrates a single phone call conversation.
 * Connects Twilio MediaStream <-> STT <-> LLM <-> TTS pipeline.
 */
export class CallOrchestrator extends EventEmitter {
  private config: CallOrchestratorConfig;
  private conversationHistory: ConversationTurn[] = [];
  private llmMessages: LLMMessage[] = [];
  private currentCallerUtterance = '';
  private isAgentSpeaking = false;
  private isStopped = false;
  private turnCount = 0;
  private totalTokensIn = 0;
  private totalTokensOut = 0;
  private totalTtsCharacters = 0;
  private sttAudioDurationMs = 0;
  private latencies: number[] = [];
  private farewellSent = false;
  private fillerTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: CallOrchestratorConfig) {
    super();
    this.config = config;

    // Build initial LLM context
    this.llmMessages = [
      { role: 'system', content: config.systemPrompt },
    ];

    if (config.callerContext) {
      this.llmMessages.push({
        role: 'system',
        content: `Context about this caller:\n${config.callerContext}`,
      });
    }
  }

  start(): void {
    logger.info({ callId: this.config.call.id }, 'Starting call orchestration');

    this.setupSTT();
    this.setupTwilioStream();

    // Connect STT
    this.config.stt.connect({ language: this.config.language === 'ru' ? 'ru' : 'en-US' });

    // Send greeting if configured
    if (this.config.agentProfile.greeting_message) {
      this.speakText(this.config.agentProfile.greeting_message);
    }
  }

  private setupSTT(): void {
    const { stt } = this.config;

    stt.on('transcript', (event) => {
      if (this.isStopped) return;

      if (event.isFinal) {
        this.currentCallerUtterance += (this.currentCallerUtterance ? ' ' : '') + event.text;
      } else {
        // Partial — useful for interruption detection
        if (this.isAgentSpeaking && event.text.length > 3) {
          this.handleInterruption();
        }
      }
    });

    stt.on('utterance_end', () => {
      if (this.isStopped) return;
      if (this.currentCallerUtterance.trim()) {
        this.handleCallerUtterance(this.currentCallerUtterance.trim());
        this.currentCallerUtterance = '';
      }
    });

    stt.on('speech_started', () => {
      if (this.isAgentSpeaking) {
        this.handleInterruption();
      }
    });

    stt.on('error', (err) => {
      logger.error({ err, callId: this.config.call.id }, 'STT error');
      this.emit('error', err);
    });
  }

  private setupTwilioStream(): void {
    const { twilioWs, stt } = this.config;

    twilioWs.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.event === 'media') {
          // Forward audio to STT
          const audio = Buffer.from(msg.media.payload, 'base64');
          stt.sendAudio(audio);
          // Each Twilio media chunk is 20ms of audio
          this.sttAudioDurationMs += 20;
        }

        if (msg.event === 'stop') {
          this.stop('twilio_stream_stopped');
        }
      } catch {
        // ignore parse errors
      }
    });

    twilioWs.on('close', () => {
      this.stop('twilio_disconnected');
    });
  }

  private handleInterruption(): void {
    if (!this.isAgentSpeaking) return;

    logger.debug({ callId: this.config.call.id }, 'Caller interrupted agent');
    this.isAgentSpeaking = false;

    // Clear Twilio audio queue
    this.sendTwilioMessage({ event: 'clear', streamSid: this.config.streamSid });

    this.emit('interruption');
  }

  private async handleCallerUtterance(text: string): Promise<void> {
    if (this.isStopped) return;

    // After agent said goodbye, don't process new utterances — call is ending
    if (this.farewellSent) {
      logger.info({ callId: this.config.call.id, text }, 'Ignoring caller utterance after farewell');
      return;
    }

    this.turnCount++;
    logger.info({ callId: this.config.call.id, turn: this.turnCount, text }, 'Caller utterance');

    // Record turn
    this.conversationHistory.push({
      speaker: 'caller',
      text,
      timestamp: new Date().toISOString(),
    });

    this.emit('transcript', { speaker: 'caller', text, timestamp: new Date().toISOString(), isFinal: true });

    // Add to LLM history
    this.llmMessages.push({ role: 'user', content: text });

    // Log event
    await callService.addCallEvent({
      callId: this.config.call.id,
      workspaceId: this.config.call.workspace_id,
      eventType: 'turn_caller',
      eventData: { text, turn: this.turnCount },
    });

    // Start filler timer
    this.startFillerTimer();

    // RAG: search knowledge bases for relevant context
    if (this.config.knowledgeSearch) {
      try {
        const results = await this.config.knowledgeSearch(text);
        if (results.length > 0) {
          const ragContext = results
            .filter(r => r.similarity > 0.3)
            .map(r => `[${r.document_title}]: ${r.chunk_text}`)
            .join('\n');
          if (ragContext) {
            this.llmMessages.push({
              role: 'system',
              content: `Relevant knowledge:\n${ragContext}`,
            });
          }
        }
      } catch (err) {
        logger.warn({ err }, 'RAG search failed, continuing without knowledge');
      }
    }

    // Generate AI response
    await this.generateAndSpeak();
  }

  private startFillerTimer(): void {
    this.clearFillerTimer();
    this.fillerTimer = setTimeout(() => {
      if (!this.isAgentSpeaking && !this.isStopped) {
        const lang = this.config.language === 'ru' ? 'ru' : 'en';
        const fillers = FILLER_PHRASES[lang];
        const filler = fillers[Math.floor(Math.random() * fillers.length)];
        this.speakText(filler);
      }
    }, FILLER_TIMEOUT_MS);
  }

  private clearFillerTimer(): void {
    if (this.fillerTimer) {
      clearTimeout(this.fillerTimer);
      this.fillerTimer = null;
    }
  }

  private async generateAndSpeak(): Promise<void> {
    this.clearFillerTimer();

    const { llm, tts } = this.config;
    let fullResponse = '';
    let sentenceBuffer = '';
    let firstChunkSent = false;

    const startTime = Date.now();

    await llm.generateStream(
      this.llmMessages,
      this.config.agentProfile.llm_model,
      this.config.agentProfile.llm_temperature,
      {
        onToken: (token: string) => {
          if (this.isStopped) return;

          fullResponse += token;
          sentenceBuffer += token;

          // Stream TTS in sentence chunks for natural speech
          const sentenceEnd = sentenceBuffer.match(/[.!?]\s/);
          if (sentenceEnd && sentenceBuffer.length > 20) {
            const sentence = sentenceBuffer.trim();
            sentenceBuffer = '';
            if (!firstChunkSent) {
              firstChunkSent = true;
              this.isAgentSpeaking = true;
            }
            this.speakText(sentence);
          }
        },
        onComplete: async (response: LLMResponse) => {
          // Speak remaining text
          if (sentenceBuffer.trim() && !this.isStopped) {
            if (!firstChunkSent) this.isAgentSpeaking = true;
            this.speakText(sentenceBuffer.trim());
          }

          this.totalTokensIn += response.tokensIn;
          this.totalTokensOut += response.tokensOut;
          this.latencies.push(response.latencyMs);

          // Record turn
          this.conversationHistory.push({
            speaker: 'agent',
            text: fullResponse,
            timestamp: new Date().toISOString(),
          });

          this.llmMessages.push({ role: 'assistant', content: fullResponse });

          this.emit('transcript', { speaker: 'agent', text: fullResponse, timestamp: new Date().toISOString(), isFinal: true });

          await callService.addCallEvent({
            callId: this.config.call.id,
            workspaceId: this.config.call.workspace_id,
            eventType: 'turn_agent',
            eventData: {
              text: fullResponse,
              turn: this.turnCount,
              latencyMs: response.latencyMs,
              tokensIn: response.tokensIn,
              tokensOut: response.tokensOut,
            },
          });

          // Detect end-of-call: explicit [END_CALL] marker OR farewell heuristics
          const hasEndMarker = fullResponse.includes('[END_CALL]');
          const farewellPattern = /\b(пока|до свидания|goodbye|bye|bye-bye|всего доброго|до встречи|see you|take care)\b/i;
          const hasFarewell = farewellPattern.test(fullResponse);

          if (hasEndMarker || (hasFarewell && !this.farewellSent)) {
            this.farewellSent = true;
            logger.info({ callId: this.config.call.id, hasEndMarker, hasFarewell }, 'Agent farewell detected, ending call');
            setTimeout(() => this.stop('agent_ended_call'), 3000); // 3s for TTS to finish
          } else if (hasFarewell && this.farewellSent) {
            // Agent said goodbye AGAIN — stop immediately, don't speak it
            logger.warn({ callId: this.config.call.id }, 'Agent repeated farewell, stopping immediately');
            this.stop('agent_repeated_farewell');
          }

          // Detect skill activation markers [ACTIVATE:skill_intent]
          const skillMatch = fullResponse.match(/\[ACTIVATE:(\w+)\]/);
          if (skillMatch) {
            const skillIntent = skillMatch[1];
            logger.info({ callId: this.config.call.id, skillIntent }, 'Agent activated optional skill');
            this.emit('skill_activated', { intent: skillIntent });
            await callService.addCallEvent({
              callId: this.config.call.id,
              workspaceId: this.config.call.workspace_id,
              eventType: 'skill_activated',
              eventData: { intent: skillIntent },
            });
          }

          this.emit('agent_response', fullResponse);
        },
        onError: (err: Error) => {
          logger.error({ err, callId: this.config.call.id }, 'LLM error');
          this.emit('error', err);
        },
      },
    );
  }

  private async speakText(text: string): Promise<void> {
    // Strip control markers before speaking
    const clean = text.replace(/\[END_CALL\]/g, '').replace(/\[ACTIVATE:\w+\]/g, '').trim();
    if (this.isStopped || !clean) return;
    text = clean;

    try {
      const { tts } = this.config;
      this.totalTtsCharacters += text.length;
      const audio = await tts.synthesize(text);

      // Emit agent audio for browser listening
      if (audio.length > 0) {
        this.emit('agent_audio', { payload: audio.toString('base64') });
      }

      if (!this.isStopped && this.isAgentSpeaking) {
        // Send audio to Twilio as base64 mulaw
        const payload = audio.toString('base64');
        this.sendTwilioMessage({
          event: 'media',
          streamSid: this.config.streamSid,
          media: { payload },
        });
      }
    } catch (err) {
      logger.error({ err, callId: this.config.call.id }, 'TTS error');
    }
  }

  private sendTwilioMessage(msg: Record<string, unknown>): void {
    const { twilioWs } = this.config;
    if (twilioWs.readyState === twilioWs.OPEN) {
      twilioWs.send(JSON.stringify(msg));
    }
  }

  async stop(reason = 'normal'): Promise<void> {
    if (this.isStopped) return;
    this.isStopped = true;
    this.clearFillerTimer();

    logger.info({ callId: this.config.call.id, reason }, 'Stopping call orchestration');

    // Close STT
    this.config.stt.close();

    // Calculate average latency
    const avgLatency = this.latencies.length > 0
      ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length)
      : null;

    this.emit('stopped', {
      reason,
      conversationHistory: this.conversationHistory,
      turnCount: this.turnCount,
      totalTokensIn: this.totalTokensIn,
      totalTokensOut: this.totalTokensOut,
      totalTtsCharacters: this.totalTtsCharacters,
      sttAudioDurationMs: this.sttAudioDurationMs,
      avgLatencyMs: avgLatency,
      // Provider info for cost calculation
      llmModel: this.config.agentProfile.llm_model,
      llmProvider: this.config.agentProfile.llm_provider,
      voiceProvider: this.config.agentProfile.voice_provider,
      sttProvider: this.config.agentProfile.stt_provider,
    });
  }

  injectInstruction(text: string): void {
    // Inject as a system message so the next LLM call picks it up
    this.llmMessages.push({
      role: 'system',
      content: `[Operator instruction - apply immediately]: ${text}`,
    });
  }

  getTranscript(): ConversationTurn[] {
    return [...this.conversationHistory];
  }
}
