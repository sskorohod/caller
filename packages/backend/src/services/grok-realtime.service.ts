import { EventEmitter } from 'node:events';
import pino from 'pino';
import WebSocket from 'ws';
import type { WebSocket as TWS } from 'ws';
import type { AgentProfile, Call } from '../models/types.js';

const logger = pino({ name: 'grok-realtime' });

// Model must be selected via ?model= query string. Without it, xAI's realtime
// endpoint returns response.done with status_details:"unimplemented" and zero
// output audio tokens — manifests as agent saying nothing on the call.
const GROK_REALTIME_URL = 'wss://api.x.ai/v1/realtime?model=grok-3-mini-fast';

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
// Window for merging back-to-back caller transcripts that Grok emits as separate
// finals. The dominant case: the first interim flips to final too early on a
// brief hesitation ("Эм, да, я") and the rest arrives as a new final 1s later.
const GROK_CALLER_MERGE_MS = 1500;
// If a function call takes longer than this before resolving, play a bridging
// phrase ("секунду, посмотрю") so the caller doesn't sit in silence.
const GROK_TOOL_BRIDGE_MS = 800;
// If the caller starts speaking within this window after the agent's
// response.done, treat it as a LATE INTERRUPTION — the agent's text generation
// finished but Twilio was still draining its audio buffer. The audio tail got
// truncated when we sent 'clear' on speech_started. The agent's full intended
// text never reached the caller's ear → capture it as interrupted_thought so
// the agent can resume the unfinished idea on the next turn.
const LATE_INTERRUPTION_WINDOW_MS = 1500;

export class GrokRealtimeOrchestrator extends EventEmitter {
  private config: GrokRealtimeConfig;
  private grokWs: WebSocket | null = null;
  private conversationHistory: ConversationTurn[] = [];
  private turnCount = 0;
  private isStopped = false;
  private currentAgentTranscript = '';
  private currentInstructions = '';
  private pendingHangup = false;
  // Turn-taking metrics (same shape as CallOrchestrator)
  private bargeInCount = 0;
  private callerSpeechMs = 0;
  private agentSpeechMs = 0;
  private callerSpeechStartedAt: number | null = null;
  private agentSpeechStartedAt: number | null = null;
  private pauseBeforeResponseMs: number[] = [];
  private longestSilenceMs = 0;
  private lastSpeechAt: number | null = null;
  private bargeInsByAgentTurn: number[] = [];
  private mergedUtterances = 0;
  // Capture the moment the caller finishes (final transcript) — used to
  // compute pauseBeforeResponse when the agent's first audio delta arrives.
  private lastCallerFinalAt: number | null = null;
  // Tool-call bridging — fires only if function call takes longer than threshold
  private toolBridgeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  // Interruption resume — capture full text of agent's last response and the
  // moment its audio finished playing (estimated). If the caller starts
  // speaking within LATE_INTERRUPTION_WINDOW_MS, the tail of that response was
  // audibly truncated when we cleared Twilio's audio buffer. Save the text so
  // we can inject a "resume from where you were cut off" system note for Grok
  // before its next response.
  private lastAgentText: string | null = null;
  private lastAgentResponseEndedAt: number | null = null;
  private interruptedFullText: string | null = null;

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

      case 'input_audio_buffer.speech_stopped':
        this.onSpeechStopped();
        break;

      case 'response.function_call_arguments.delta':
      case 'response.function_call_arguments.done':
        this.onToolCallProgress(msg);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.onCallerTranscript(msg);
        break;

      case 'response.output_audio_transcript.delta':
        this.onAgentTranscriptDelta(msg);
        break;

      case 'response.output_audio_transcript.done':
        // Full agent transcript available — trigger farewell check here
        // (response.done may not arrive from Grok)
        this.onResponseDone();
        break;

      case 'response.done':
        // Backup — also check here if transcript wasn't already processed
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

    // Mission context language overrides agent profile language
    const callCtx = (this.config.call as any).context;
    const lang = callCtx?.language || this.config.agentProfile.language;
    const langMap: Record<string, string> = { ru: 'Russian', en: 'English', es: 'Spanish', de: 'German', fr: 'French', hy: 'Armenian', he: 'Hebrew', uk: 'Ukrainian' };
    const langInstruction = lang === 'auto'
      ? '\n\nIMPORTANT: Detect the language the caller is speaking and respond in the same language. Switch languages mid-conversation if the caller switches.'
      : `\n\nIMPORTANT: Always respond in ${langMap[lang] || 'English'}. ALL your speech MUST be in ${langMap[lang] || 'English'} — never switch to another language.`;

    // CURRENT DATE & TIME is already baked into systemPrompt at the top by
    // buildSystemPrompt() in prompt-builder.service.ts — no need to repeat it
    // here. systemPrompt is built with the workspace timezone so the agent
    // already knows the date/time/day-of-week at call start.
    let instructions = this.config.systemPrompt + langInstruction;

    if (this.config.callerContext) {
      const contextLabel = this.config.call.direction === 'outbound'
        ? 'Context about the person you are calling'
        : 'Context about this caller';
      instructions += `\n\n${contextLabel}:\n${this.config.callerContext}`;
    }

    // Outbound-specific rules
    if (this.config.call.direction === 'outbound') {
      instructions += `\n\nOUTBOUND CALL RULES:\n` +
        `- YOU initiated this call. You called the other person.\n` +
        `- Do NOT say "thanks for calling" — YOU called THEM.\n` +
        `- After greeting, say ONE sentence about why you're calling, then STOP and WAIT for their response.\n` +
        `- NEVER speak more than 2 sentences in a row. Always pause and let the other person respond.\n` +
        `- This is a DIALOG. Speak → Wait → Listen → Respond. Never monologue.`;
    }

    instructions += `\n\nPHONE CONVERSATION RULES:\n` +
      `- This is a PHONE call. Keep responses SHORT — 1-2 sentences max. Be concise and natural.\n` +
      `- NEVER speak more than 2 sentences without pausing for the other person to respond.\n` +
      `- Sound natural, like a real person on a phone, not a chatbot.\n` +
      `- Ask ONE question at a time, then WAIT for the answer.\n\n` +
      `CALL ENDING RULES:\n` +
      `- When the caller says goodbye ("пока", "до свидания", "bye", "всё, пока", "ладно, пока") — ` +
      `say ONE SHORT farewell (max 5 words) and IMMEDIATELY call end_call. Do NOT say goodbye twice.\n` +
      `- Do NOT end the call just because the caller said "спасибо" or "thanks" — that's just politeness, not goodbye.\n` +
      `- When an operator instructs you to end the call — politely wrap up and then call end_call.\n` +
      `- NEVER say goodbye more than once. One "Пока!" or "До свидания!" then end_call. That's it.`;

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
          description: `End the phone call. ONLY use when ONE of the following is clearly true:
(a) The caller has explicitly said goodbye — "пока", "до свидания", "удачи", "bye", "see you", "всё, пока". NOT mere politeness like "спасибо".
(b) The goal is FULLY achieved AND explicitly confirmed by both sides.

NEVER use end_call when:
- The caller is thinking, hesitating, or asked for time ("дайте подумать", "подождите", "секунду", "минутку", "сейчас уточню", "let me think", "hold on", "give me a sec", "one moment").
- The caller just proposed a time, price, or option ("в 6:30", "tomorrow at 10", "$50", "могу в...") and you have not yet acknowledged it back. Confirm first, THEN consider ending.
- The caller asked you a question you have not answered.
- The conversation is mid-flow and the goal has not been mutually agreed upon.
- You are uncertain about whether to end. When unsure — DO NOT end. Continue the conversation.

If the operator/system instructs you to end — politely wrap up and call end_call.`,
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
    const isOutbound = this.config.call.direction === 'outbound';
    const hasMission = !!(this.config.call as any).goal;

    // For outbound mission calls, skip separate greeting — the mission prompt
    // already has step-by-step instructions (confirm identity → introduce → state purpose)
    if (isOutbound && hasMission) {
      this.sendGrok({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `[System: The call just connected. The other person picked up. Introduce yourself and state why you're calling. Do NOT ask if this is the right person — just introduce yourself and get to the point.]`,
            },
          ],
        },
      });
    } else if (greeting) {
      this.sendGrok({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: isOutbound
                ? `[System: The call just connected. You called this person. Say ONLY this greeting: "${greeting}". Do NOT explain your mission yet — just greet and WAIT for their response. Keep it under 2 sentences.]`
                : `[System: The call just connected. Greet the caller with: "${greeting}"]`,
            },
          ],
        },
      });
    } else if (isOutbound) {
      this.sendGrok({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `[System: The call just connected. You called this person. Introduce yourself briefly (name only) and say ONE short sentence about why you're calling. Then STOP and wait for their response. Maximum 2 sentences total.]`,
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

    // Track agent speech start (first delta of a response) for metrics.
    if (this.agentSpeechStartedAt === null) {
      const now = Date.now();
      this.agentSpeechStartedAt = now;
      if (this.lastCallerFinalAt !== null) {
        this.pauseBeforeResponseMs.push(now - this.lastCallerFinalAt);
        this.lastCallerFinalAt = null;
      }
    }

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

    const now = Date.now();
    if (this.callerSpeechStartedAt === null) this.callerSpeechStartedAt = now;
    // Compute silence gap from the last speech-end of EITHER side
    if (this.lastSpeechAt) {
      const gap = now - this.lastSpeechAt;
      if (gap > this.longestSilenceMs) this.longestSilenceMs = gap;
    }
    // Count as barge-in if agent was actively speaking
    if (this.agentSpeechStartedAt !== null) {
      this.bargeInCount++;
      this.bargeInsByAgentTurn.push(this.turnCount);
      this.agentSpeechMs += now - this.agentSpeechStartedAt;
      this.agentSpeechStartedAt = null;
      // Mid-response interruption — Grok's currentAgentTranscript holds the
      // partial generated text. The FULL intended text will arrive in
      // onResponseDone (or be missing if Grok cancels). We mark it here so
      // onResponseDone knows to stash the full text as interrupted.
      this.interruptedFullText = '__pending__'; // sentinel: replaced in onResponseDone
    } else if (
      this.lastAgentResponseEndedAt !== null &&
      now - this.lastAgentResponseEndedAt < LATE_INTERRUPTION_WINDOW_MS &&
      this.lastAgentText
    ) {
      // LATE INTERRUPTION: text generation done but Twilio was still playing
      // the tail. By clearing the buffer below, the caller never hears the
      // last ~0.5-1.5s of the agent's message. Capture the full text so we
      // can ask the agent to resume the unfinished idea next turn.
      this.bargeInCount++;
      this.bargeInsByAgentTurn.push(this.turnCount);
      this.interruptedFullText = this.lastAgentText;
      logger.info({ callId: this.config.call.id, gap: now - this.lastAgentResponseEndedAt, lastAgentText: this.lastAgentText.slice(0, 80) }, 'Late audio interruption detected');
    }

    this.sendTwilio({
      event: 'clear',
      streamSid: this.config.streamSid,
    });
  }

  /**
   * Caller stopped speaking — close the speech window.
   */
  private onSpeechStopped(): void {
    if (this.callerSpeechStartedAt !== null) {
      this.callerSpeechMs += Date.now() - this.callerSpeechStartedAt;
      this.callerSpeechStartedAt = null;
    }
    this.lastSpeechAt = Date.now();
  }

  /**
   * Tool-call bridging: when Grok starts emitting function_call args, schedule
   * a bridging phrase if execution will take >800ms. Today only end_call is
   * registered (instant), but the framework is in place for slower tools.
   */
  private onToolCallProgress(msg: Record<string, unknown>): void {
    const callId = (msg.call_id as string) || (msg.item_id as string) || 'unknown';
    const name = (msg.name as string) || '';
    const type = msg.type as string;

    if (type === 'response.function_call_arguments.delta') {
      // First delta — start the bridging timer if not already running.
      if (!this.toolBridgeTimers.has(callId) && name !== 'end_call') {
        const timer = setTimeout(() => {
          if (this.isStopped) return;
          // Inject a bridging utterance via Grok conversation item so the agent
          // speaks it naturally. Avoid speaking directly to Twilio — would conflict
          // with the in-flight response.
          logger.debug({ callId: this.config.call.id, toolCallId: callId }, 'Tool bridge fired');
          this.injectInstruction('Quickly say one short bridging phrase like "Секунду, посмотрю" / "One moment, let me check" while the tool runs.');
        }, GROK_TOOL_BRIDGE_MS);
        this.toolBridgeTimers.set(callId, timer);
      }
    } else if (type === 'response.function_call_arguments.done') {
      const t = this.toolBridgeTimers.get(callId);
      if (t) {
        clearTimeout(t);
        this.toolBridgeTimers.delete(callId);
      }
    }
  }

  /**
   * Record caller transcript when transcription completes.
   */
  private onCallerTranscript(msg: Record<string, unknown>): void {
    const transcript = msg.transcript as string;
    if (!transcript?.trim()) return;

    // If hangup is pending — ignore caller speech, call is ending
    if (this.pendingHangup) return;

    const trimmed = transcript.trim();
    const now = Date.now();
    this.lastCallerFinalAt = now;
    this.lastSpeechAt = now;

    // Deduplicate: merge with previous caller turn if same/similar text, OR if
    // emitted within GROK_CALLER_MERGE_MS (Grok sometimes flips an interim to
    // final too early on hesitation, then emits the rest as a second final).
    const prev = this.conversationHistory[this.conversationHistory.length - 1];
    if (prev && prev.speaker === 'caller') {
      const prevTime = new Date(prev.timestamp).getTime();
      const withinWindow = now - prevTime <= GROK_CALLER_MERGE_MS;
      const prevNorm = prev.text.toLowerCase().replace(/[?!.,\s]+/g, '');
      const currNorm = trimmed.toLowerCase().replace(/[?!.,\s]+/g, '');
      // Merge if (a) one is a substring of the other (Grok overlap pattern),
      // or (b) they arrived within the merge window (segmentation hiccup).
      const textOverlap = prevNorm === currNorm || prevNorm.includes(currNorm) || currNorm.includes(prevNorm);
      if (textOverlap || withinWindow) {
        // Stitch — keep both segments if they're distinct, prefer concatenation.
        let merged: string;
        if (textOverlap) {
          merged = trimmed.length > prev.text.length ? trimmed : prev.text;
        } else {
          // Adjacent finals from one continuous utterance → join with a space.
          merged = `${prev.text} ${trimmed}`.replace(/\s+/g, ' ').trim();
        }
        prev.text = merged;
        this.mergedUtterances++;
        logger.debug({ callId: this.config.call.id, mergedText: merged, reason: textOverlap ? 'overlap' : 'window' }, 'Grok caller transcript merged');
        this.emit('transcript', { speaker: 'caller', text: merged, timestamp: new Date().toISOString(), isFinal: true });
        return;
      }
    }

    this.turnCount++;
    logger.info({ callId: this.config.call.id, turn: this.turnCount, text: trimmed }, 'Caller utterance (Grok)');

    this.conversationHistory.push({
      speaker: 'caller',
      text: trimmed,
      timestamp: new Date().toISOString(),
    });

    this.emit('transcript', { speaker: 'caller', text: trimmed, timestamp: new Date().toISOString(), isFinal: true });

    // INTERRUPTION RESUME — if the previous agent turn was cut off (mid- or
    // late audio interruption), inject a system note so Grok knows to resume
    // the unfinished idea instead of restarting or fragmenting. We do this
    // AFTER recording the caller's turn so the system note lands between
    // their input and Grok's auto-generated response.
    if (this.interruptedFullText && this.interruptedFullText !== '__pending__') {
      const resumeText = this.interruptedFullText;
      this.interruptedFullText = null;
      this.injectInstruction(
        `Your previous turn was cut off — the caller started speaking before they could hear all of it. The FULL sentence you intended was:\n\n"${resumeText}"\n\n` +
        `Now check the caller's latest reply. If they addressed what you were trying to say — just continue the conversation normally. If they did NOT address it (e.g. they just said "Алё/Hello/Yes?", asked you to repeat, gave an unrelated brief response) — resume your unfinished thought NATURALLY from where you were cut off. Do not restart from the beginning. Do not fragment. Pick up the idea.`
      );
    }
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
      // If hangup is pending, skip any new agent responses (prevents double goodbye)
      if (this.pendingHangup) {
        logger.debug({ callId: this.config.call.id, text: text.slice(0, 50) }, 'Skipping agent response — hangup pending');
        this.currentAgentTranscript = '';
        return;
      }

      // Deduplicate: skip if identical to last agent response
      const lastAgent = [...this.conversationHistory].reverse().find(t => t.speaker === 'agent');
      if (lastAgent && lastAgent.text === text) {
        logger.debug({ callId: this.config.call.id }, 'Skipping duplicate agent response');
        this.currentAgentTranscript = '';
        return;
      }

      // Close agent speech window for metrics
      if (this.agentSpeechStartedAt !== null) {
        this.agentSpeechMs += Date.now() - this.agentSpeechStartedAt;
        this.agentSpeechStartedAt = null;
      }
      this.lastSpeechAt = Date.now();

      // Stash the full text + end timestamp so we can detect a late audio
      // interruption (caller speaks within LATE_INTERRUPTION_WINDOW_MS after
      // text generation completes while Twilio is still playing audio).
      this.lastAgentText = text;
      this.lastAgentResponseEndedAt = Date.now();

      // If a mid-response interruption was flagged during streaming, now we
      // have the full intended text — replace the sentinel with it.
      if (this.interruptedFullText === '__pending__') {
        this.interruptedFullText = text;
        logger.info({ callId: this.config.call.id, lastAgentText: text.slice(0, 80) }, 'Mid-response interruption: captured full intended text');
      }

      this.conversationHistory.push({ speaker: 'agent', text, timestamp: new Date().toISOString() });
      logger.info({ callId: this.config.call.id, text }, 'Agent response (Grok)');
      this.emit('transcript', { speaker: 'agent', text, timestamp: new Date().toISOString(), isFinal: true });

      // Farewell detection — hang up when agent says goodbye
      // Note: \b doesn't work with Cyrillic in JS regex, so use simple includes/match
      const textLower = text.toLowerCase();
      const hasFarewell = ['пока', 'до свидания', 'всего доброго', 'до встречи', 'спокойной', 'удачи',
        'goodbye', 'bye', 'see you', 'take care', 'good night', 'sweet dreams'].some(w => textLower.includes(w));
      logger.info({ callId: this.config.call.id, text, hasFarewell, pendingHangup: this.pendingHangup }, 'Farewell check');
      if (hasFarewell && !this.pendingHangup) {
        logger.info({ callId: this.config.call.id, text }, 'FAREWELL DETECTED — hanging up in 6s (wait for audio to finish)');
        this.pendingHangup = true;
        setTimeout(() => {
          if (this.isStopped) return;
          logger.info({ callId: this.config.call.id }, 'Executing hangup now');
          this.stop('agent_ended_call');
          try { this.config.twilioWs.close(); } catch { /* ignore */ }
        }, 6000);
      }
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
      // GUARD: before honoring end_call, inspect the last caller utterance for
      // signals that the call is NOT actually ready to end. Common failures:
      // 1) Caller said "дайте подумать / подождите / секундочку" — they want time.
      // 2) Caller proposed a counter-offer (time / price / option) we haven't
      //    confirmed yet — agent jumped to ending instead of acknowledging.
      // In those cases, refuse the function call and tell Grok to continue
      // the conversation instead.
      const lastCaller = [...this.conversationHistory].reverse().find(t => t.speaker === 'caller');
      const lastAgent = [...this.conversationHistory].reverse().find(t => t.speaker === 'agent');
      if (lastCaller) {
        const callerText = lastCaller.text.toLowerCase();
        const isWaitSignal = /(дайте\s*подумать|подождите|секунд|секундоч|минутк|сейчас\s*(уточн|гляну|посмотр|проверю)|let me think|hold on|one moment|give me a sec|let me check)/.test(callerText);

        // Numeric proposal — has a time/price/number that wasn't yet echoed by agent
        const numMatch = callerText.match(/\b(\d{1,2}[:.]\d{2}|\d{1,2}\s*(?:часов|час|часу|утра|дня|вечера|ночи|pm|am)?)\b/);
        const proposalUnconfirmed = numMatch && !(lastAgent?.text.toLowerCase().includes(numMatch[1]) ?? false);

        // Caller explicit farewell still wins — only refuse end_call when NO farewell signal
        const isExplicitFarewell = /(пока|до\s*свидан|до\s*встреч|всего\s*добр|удачи|\bbye\b|see you|take care|good night)/.test(callerText);

        if (!isExplicitFarewell && (isWaitSignal || proposalUnconfirmed)) {
          const reason = isWaitSignal
            ? `The caller is thinking or asked to wait ("${lastCaller.text}"). Do NOT end the call. Respond with a brief 2-3 word acknowledgment ("Конечно, жду." / "Без проблем."), then stay silent and wait for them to continue.`
            : `The caller just proposed "${numMatch?.[1]}" but you have not acknowledged it yet ("${lastCaller.text}"). Do NOT end the call. Acknowledge their offer and either confirm it ("Отлично, тогда на ${numMatch?.[1]} записываем!") or briefly clarify if needed.`;

          logger.warn({ callId: this.config.call.id, callerText, isWaitSignal, proposalUnconfirmed }, 'end_call refused by orchestrator guard');

          this.sendGrok({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify({ status: 'refused', reason }),
            },
          });
          this.sendGrok({ type: 'response.create' });
          return; // don't trigger hangup
        }
      }

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

      // Wait 3 seconds for Grok to finish saying goodbye, then hang up
      this.pendingHangup = true;
      setTimeout(() => {
        if (!this.pendingHangup || this.isStopped) return;
        logger.info({ callId: this.config.call.id }, 'Hanging up after goodbye');
        this.stop('agent_ended_call');
        try { this.config.twilioWs.close(); } catch { /* ignore */ }
      }, 3000);
    }
  }

  /**
   * Send incoming Twilio audio to Grok Realtime.
   */
  private audioPacketCount = 0;
  private audioChunksDurationMs = 0;
  private sessionReady = false;

  sendAudio(payload: string): void {
    this.audioChunksDurationMs += 20; // Each Twilio media chunk is 20ms
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

  async stop(reason = 'normal'): Promise<void> {
    if (this.isStopped) return;
    this.isStopped = true;

    logger.info({ callId: this.config.call.id, reason }, 'Stopping Grok Realtime orchestration');

    // Clean up any pending tool bridge timers
    for (const t of this.toolBridgeTimers.values()) clearTimeout(t);
    this.toolBridgeTimers.clear();

    if (this.grokWs && this.grokWs.readyState === WebSocket.OPEN) {
      this.grokWs.close();
    }
    this.grokWs = null;

    // Close any open speech windows
    if (this.agentSpeechStartedAt !== null) {
      this.agentSpeechMs += Date.now() - this.agentSpeechStartedAt;
      this.agentSpeechStartedAt = null;
    }
    if (this.callerSpeechStartedAt !== null) {
      this.callerSpeechMs += Date.now() - this.callerSpeechStartedAt;
      this.callerSpeechStartedAt = null;
    }

    // Compute summary metrics
    const totalSpeechMs = this.agentSpeechMs + this.callerSpeechMs;
    const talkListenRatio = totalSpeechMs > 0
      ? Number((this.agentSpeechMs / totalSpeechMs).toFixed(2))
      : null;
    const avgPauseBeforeResponseMs = this.pauseBeforeResponseMs.length > 0
      ? Math.round(this.pauseBeforeResponseMs.reduce((a, b) => a + b, 0) / this.pauseBeforeResponseMs.length)
      : null;

    // Persist as a call_event for post-call analytics (same shape as
    // CallOrchestrator's turn_taking_metrics so dashboard queries work for both).
    try {
      const callService = await import('./call.service.js');
      await callService.addCallEvent({
        callId: this.config.call.id,
        workspaceId: this.config.call.workspace_id,
        eventType: 'turn_taking_metrics',
        eventData: {
          bargeInCount: this.bargeInCount,
          talkListenRatio,
          agentSpeechMs: this.agentSpeechMs,
          callerSpeechMs: this.callerSpeechMs,
          avgPauseBeforeResponseMs,
          longestSilenceMs: this.longestSilenceMs,
          bargeInsByAgentTurn: this.bargeInsByAgentTurn,
          mergedUtterances: this.mergedUtterances,
          totalTurns: this.turnCount,
          pipeline: 'grok_realtime',
        },
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to record Grok turn-taking metrics');
    }

    this.emit('stopped', {
      reason,
      conversationHistory: this.conversationHistory,
      turnCount: this.turnCount,
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalTtsCharacters: 0, // Grok realtime handles TTS internally
      sttAudioDurationMs: this.audioChunksDurationMs,
      avgLatencyMs: null,
      bargeInCount: this.bargeInCount,
      talkListenRatio,
      avgPauseBeforeResponseMs,
      longestSilenceMs: this.longestSilenceMs,
      // Provider info for cost calculation
      llmModel: 'grok-3-mini-fast',
      llmProvider: 'xai',
      voiceProvider: 'xai',
      sttProvider: 'xai',
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
