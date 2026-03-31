import { randomBytes, createHmac } from 'node:crypto';
import { WebSocket } from 'ws';
import { EventEmitter } from 'node:events';
import { db } from '../config/db.js';
import { callEvents } from '../db/schema.js';
import * as callService from './call.service.js';
import pino from 'pino';

const logger = pino({ name: 'external-handoff' });

interface BootstrapWebhookPayload {
  event_type: 'inbound_call_requested';
  call_id: string;
  session_id: string;
  workspace_id: string;
  called_number: string;
  caller_number: string;
  received_at: string;
  routing_context: {
    agent_profile_id: string;
    language_hint: string;
  };
  memory_context?: {
    caller_known: boolean;
    caller_name?: string;
    recent_summary?: string;
  };
  session_token: string;
  ws_url: string;
  reply_deadline: string;
}

/**
 * Send bootstrap webhook to external orchestrator for inbound handoff.
 */
export async function sendBootstrapWebhook(params: {
  callId: string;
  sessionId: string;
  workspaceId: string;
  calledNumber: string;
  callerNumber: string;
  agentProfileId: string;
  language: string;
  webhookUrl: string;
  authSecret: string;
  readyTimeoutMs: number;
  memoryContext?: {
    caller_known: boolean;
    caller_name?: string;
    recent_summary?: string;
  };
  wsBaseUrl: string;
}): Promise<{ accepted: boolean; sessionToken: string }> {
  // Generate one-time session token with strong entropy
  const sessionToken = `est_${randomBytes(32).toString('base64url')}`;

  // Store token for later WebSocket auth (use dynamic salt from call + workspace)
  const salt = `${params.workspaceId}:${params.callId}:${Date.now()}`;
  await db
    .insert(callEvents)
    .values({
      call_id: params.callId,
      workspace_id: params.workspaceId,
      event_type: 'external_session_token_created',
      event_data: {
        session_token_hash: createHmac('sha256', salt).update(sessionToken).digest('hex'),
        salt,
        expires_at: new Date(Date.now() + params.readyTimeoutMs + 5000).toISOString(),
      },
    });

  const payload: BootstrapWebhookPayload = {
    event_type: 'inbound_call_requested',
    call_id: params.callId,
    session_id: params.sessionId,
    workspace_id: params.workspaceId,
    called_number: params.calledNumber,
    caller_number: params.callerNumber,
    received_at: new Date().toISOString(),
    routing_context: {
      agent_profile_id: params.agentProfileId,
      language_hint: params.language,
    },
    memory_context: params.memoryContext,
    session_token: sessionToken,
    ws_url: `${params.wsBaseUrl}/ws/external-call`,
    reply_deadline: new Date(Date.now() + params.readyTimeoutMs).toISOString(),
  };

  // Sign the webhook
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = createHmac('sha256', params.authSecret)
    .update(signaturePayload)
    .digest('hex');

  try {
    const res = await fetch(params.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Platform-Signature': signature,
        'X-Platform-Timestamp': timestamp,
        'X-Platform-Event': 'inbound_call_requested',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      logger.warn({ callId: params.callId, status: res.status }, 'Bootstrap webhook rejected');
      return { accepted: false, sessionToken };
    }

    const body = await res.json() as any;
    return { accepted: body.accepted === true, sessionToken };
  } catch (err) {
    logger.error({ err, callId: params.callId }, 'Bootstrap webhook failed');
    return { accepted: false, sessionToken };
  }
}

/**
 * External agent realtime session over WebSocket.
 * Bridges between Twilio MediaStream and external agent.
 */
export class ExternalAgentSession extends EventEmitter {
  private ws: WebSocket | null = null;
  private callId: string;
  private sessionId: string;
  private isReady = false;
  private readyTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(callId: string, sessionId: string) {
    super();
    this.callId = callId;
    this.sessionId = sessionId;
  }

  attach(ws: WebSocket, readyTimeoutMs: number): void {
    this.ws = ws;

    // Start readiness timeout
    this.readyTimeout = setTimeout(() => {
      if (!this.isReady) {
        logger.warn({ callId: this.callId }, 'External agent did not become ready in time');
        this.emit('timeout');
        ws.close(4001, 'Readiness timeout');
      }
    }, readyTimeoutMs);

    // Send session start
    this.send({
      type: 'session_started',
      call_id: this.callId,
      session_id: this.sessionId,
      conversation_owner_requested: 'external',
    });

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch { /* ignore */ }
    });

    ws.on('close', () => {
      this.cleanup();
      this.emit('disconnected');
    });
  }

  private handleMessage(msg: any): void {
    switch (msg.type) {
      case 'agent_ready':
        this.isReady = true;
        if (this.readyTimeout) {
          clearTimeout(this.readyTimeout);
          this.readyTimeout = null;
        }
        this.emit('ready', msg);
        break;

      case 'reply_text':
        if (msg.text) {
          this.emit('reply', { text: msg.text, endOfTurn: msg.end_of_turn ?? true });
        }
        break;

      case 'action':
        this.emit('action', { name: msg.name, payload: msg.payload });
        break;

      case 'control':
        if (['hangup', 'transfer_to_human', 'mark_goal_complete'].includes(msg.name)) {
          this.emit('control', msg.name);
        }
        break;

      case 'heartbeat':
        // Keep-alive, no action needed
        break;
    }
  }

  /** Send transcript delta to external agent */
  sendTranscriptDelta(turnId: string, speaker: string, text: string, isFinal: boolean): void {
    this.send({
      type: isFinal ? 'transcript_final' : 'transcript_delta',
      turn_id: turnId,
      speaker,
      text,
      is_final: isFinal,
      timestamp: new Date().toISOString(),
    });
  }

  /** Send memory context to external agent */
  sendMemoryContext(context: Record<string, unknown>): void {
    this.send({ type: 'memory_context', ...context });
  }

  /** Notify call ended */
  sendCallEnded(status: string): void {
    this.send({
      type: 'call_ended',
      call_id: this.callId,
      session_id: this.sessionId,
      ended_at: new Date().toISOString(),
      status,
    });
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private cleanup(): void {
    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout);
      this.readyTimeout = null;
    }
  }
}
