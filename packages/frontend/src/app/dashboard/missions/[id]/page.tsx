'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Mission {
  id: string;
  workspace_id: string;
  title: string | null;
  status: string;
  agent_profile_id: string | null;
  target_phone: string | null;
  goal: string | null;
  context: Record<string, unknown>;
  fallback_action: string;
  call_id: string | null;
  outcome: Record<string, unknown> | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface MissionMessage {
  id: string;
  mission_id: string;
  sender_type: 'user' | 'ai' | 'system';
  content: string;
  message_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface MissionDetail {
  mission: Mission;
  messages: MissionMessage[];
}

interface PlanAction {
  action: string;
  plan: {
    target_phone?: string;
    goal?: string;
    agent?: string;
    context?: Record<string, unknown>;
    scheduled_at?: string;
    fallback?: string;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft:       'bg-gray-100 text-gray-600',
  ready:       'bg-blue-100 text-blue-700',
  scheduled:   'bg-purple-100 text-purple-700',
  calling:     'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  on_hold:     'bg-orange-100 text-orange-600',
  completed:   'bg-green-100 text-green-700',
  failed:      'bg-red-100 text-red-700',
  cancelled:   'bg-gray-100 text-gray-500',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function tryParsePlan(content: string): PlanAction | null {
  try {
    // Try to extract JSON from the message content
    const jsonMatch = content.match(/\{[\s\S]*"action"\s*:\s*"ready"[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.action === 'ready' && parsed.plan) return parsed as PlanAction;
    return null;
  } catch {
    return null;
  }
}

function stripPlanJson(content: string): string {
  return content.replace(/\{[\s\S]*"action"\s*:\s*"ready"[\s\S]*\}/, '').trim();
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MissionChatPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const { socket } = useSocket();
  const toast = useToast();
  const missionId = params.id as string;

  // State
  const [mission, setMission] = useState<Mission | null>(null);
  const [messages, setMessages] = useState<MissionMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgLen = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Load mission detail ────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    api
      .get<MissionDetail>(`/missions/${missionId}`)
      .then((r) => {
        setMission(r.mission);
        setMessages(r.messages);
      })
      .catch((e) => {
        toast.error(e.message || t('common.error'));
      })
      .finally(() => setLoading(false));
  }, [missionId]);

  // ─── Socket.IO ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !missionId) return;

    socket.emit('mission:join', { mission_id: missionId });

    const handleMessage = (data: MissionMessage) => {
      if (data.mission_id !== missionId) return;
      setMessages((prev) => {
        // Deduplicate by id
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
    };

    const handleStatus = (data: { mission_id: string; status: string }) => {
      if (data.mission_id !== missionId) return;
      setMission((prev) => (prev ? { ...prev, status: data.status } : prev));
    };

    socket.on('mission:message', handleMessage);
    socket.on('mission:status', handleStatus);

    return () => {
      socket.off('mission:message', handleMessage);
      socket.off('mission:status', handleStatus);
    };
  }, [socket, missionId]);

  // ─── Auto-scroll on new messages ────────────────────────────────────────

  useEffect(() => {
    if (messages.length > prevMsgLen.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    prevMsgLen.current = messages.length;
  }, [messages.length]);

  // ─── Send message ──────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');

    try {
      const res = await api.post<{ ai_response: string; mission: Mission }>(`/missions/${missionId}/messages`, {
        content: text,
      });
      // Messages are added via Socket.IO events from mission service
      // Update mission state from response
      if (res.mission) setMission(res.mission);
    } catch (e: any) {
      toast.error(e.message || t('common.error'));
      // Restore the input so user doesn't lose their message
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, missionId, toast, t]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  // ─── Execute mission (start call) ──────────────────────────────────────

  const executeMission = useCallback(async () => {
    if (executing) return;
    setExecuting(true);
    try {
      await api.post(`/missions/${missionId}/execute`, {});
      toast.success(t('mission.callStarted'));
    } catch (e: any) {
      toast.error(e.message || t('common.error'));
    } finally {
      setExecuting(false);
    }
  }, [executing, missionId, toast, t]);

  // ─── Derived state ─────────────────────────────────────────────────────

  const isCallActive = mission?.status === 'calling' || mission?.status === 'in_progress';
  const inputDisabled = isCallActive || sending;

  // ─── Loading ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[var(--th-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="p-8 text-center text-[var(--th-text-secondary)]">
        {t('mission.notFound')}
        <button
          onClick={() => router.push('/dashboard/missions')}
          className="ml-2 text-[var(--th-primary)] hover:underline"
        >
          {t('common.back')}
        </button>
      </div>
    );
  }

  // ─── Render message ────────────────────────────────────────────────────

  function renderMessage(msg: MissionMessage) {
    const plan = msg.sender_type === 'ai' ? tryParsePlan(msg.content) : null;
    const textContent = plan ? stripPlanJson(msg.content) : msg.content;

    // System messages — centered badge
    if (msg.sender_type === 'system') {
      return (
        <div key={msg.id} className="flex justify-center my-2">
          <div className="px-4 py-2 rounded-full text-sm bg-[var(--th-surface)] text-[var(--th-text-muted)] border border-[var(--th-border)]">
            {msg.message_type === 'call_update' && (
              <span className="mr-1">
                {msg.content.toLowerCase().includes('complete') || msg.content.toLowerCase().includes('success')
                  ? '\u2705'
                  : '\uD83D\uDCDE'}
              </span>
            )}
            {msg.content}
          </div>
        </div>
      );
    }

    // User messages — right-aligned primary bubble
    if (msg.sender_type === 'user') {
      return (
        <div key={msg.id} className="flex justify-end my-2">
          <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-br-sm bg-[var(--th-primary)] text-white text-sm leading-relaxed">
            {msg.content}
          </div>
        </div>
      );
    }

    // AI messages — left-aligned surface bubble
    // Report type — special card
    if (msg.message_type === 'report') {
      const isSuccess =
        msg.content.toLowerCase().includes('success') ||
        msg.content.toLowerCase().includes('completed');
      return (
        <div key={msg.id} className="flex justify-start my-2">
          <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-[var(--th-border)] overflow-hidden">
            <div
              className={`px-4 py-2 text-xs font-medium flex items-center gap-2 ${
                isSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              <span>{isSuccess ? '\u2705' : '\u274C'}</span>
              <span>{isSuccess ? t('mission.callCompleted') : t('mission.callFailed')}</span>
            </div>
            <div className="px-4 py-3 bg-[var(--th-card)] text-sm text-[var(--th-text)] leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </div>
          </div>
        </div>
      );
    }

    // Regular AI message
    return (
      <div key={msg.id} className="flex justify-start my-2">
        <div className="max-w-[80%] space-y-2">
          {textContent && (
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-[var(--th-surface)] text-sm text-[var(--th-text)] leading-relaxed border border-[var(--th-border)] whitespace-pre-wrap">
              {textContent}
            </div>
          )}
          {plan && renderPlanCard(plan)}
        </div>
      </div>
    );
  }

  // ─── Render plan card ──────────────────────────────────────────────────

  function renderPlanCard(plan: PlanAction) {
    const p = plan.plan;
    return (
      <div className="rounded-xl border border-[var(--th-border)] bg-[var(--th-card)] overflow-hidden">
        <div className="px-4 py-3 bg-[var(--th-surface)] border-b border-[var(--th-border)]">
          <span className="text-sm font-semibold text-[var(--th-text)]">
            {t('mission.planReady')}
          </span>
        </div>
        <div className="px-4 py-3 space-y-2 text-sm">
          {p.target_phone && (
            <div className="flex items-start gap-2">
              <span className="shrink-0">{'\uD83D\uDCDE'}</span>
              <span className="text-[var(--th-text-muted)]">{t('mission.phone')}:</span>
              <span className="text-[var(--th-text)] font-medium">{p.target_phone}</span>
            </div>
          )}
          {p.goal && (
            <div className="flex items-start gap-2">
              <span className="shrink-0">{'\uD83C\uDFAF'}</span>
              <span className="text-[var(--th-text-muted)]">{t('mission.goal')}:</span>
              <span className="text-[var(--th-text)]">{p.goal}</span>
            </div>
          )}
          {p.agent && (
            <div className="flex items-start gap-2">
              <span className="shrink-0">{'\uD83E\uDD16'}</span>
              <span className="text-[var(--th-text-muted)]">{t('mission.agent')}:</span>
              <span className="text-[var(--th-text)]">{p.agent}</span>
            </div>
          )}
          {p.context && Object.keys(p.context).length > 0 && (
            <div className="flex items-start gap-2">
              <span className="shrink-0">{'\uD83D\uDCCB'}</span>
              <span className="text-[var(--th-text-muted)]">{t('mission.context')}:</span>
              <div className="text-[var(--th-text)]">
                {Object.entries(p.context).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-[var(--th-text-muted)]">{k}:</span>{' '}
                    <span>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {p.scheduled_at && (
            <div className="flex items-start gap-2">
              <span className="shrink-0">{'\u23F0'}</span>
              <span className="text-[var(--th-text-muted)]">{t('mission.scheduled')}:</span>
              <span className="text-[var(--th-text)]">{fmtDate(p.scheduled_at)}</span>
            </div>
          )}
          {p.fallback && (
            <div className="flex items-start gap-2">
              <span className="shrink-0">{'\uD83D\uDD04'}</span>
              <span className="text-[var(--th-text-muted)]">{t('mission.fallback')}:</span>
              <span className="text-[var(--th-text)]">{p.fallback}</span>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-[var(--th-border)] flex gap-2">
          <button
            onClick={executeMission}
            disabled={executing || isCallActive}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--th-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executing ? t('common.loading') : t('mission.confirmAndCall')}
          </button>
          {p.scheduled_at && (
            <button
              onClick={executeMission}
              disabled={executing || isCallActive}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--th-border)] text-[var(--th-text)] hover:bg-[var(--th-surface)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('mission.schedule')}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0 mb-4">
        <button
          onClick={() => router.push('/dashboard/missions')}
          className="p-2 rounded-lg hover:bg-[var(--th-surface)] transition-colors text-[var(--th-text-secondary)]"
          title={t('common.back')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-[var(--th-text)] truncate">
            {mission.title || t('mission.untitled')}
          </h1>
        </div>

        <span
          className={`px-3 py-1 text-xs font-medium rounded-full ${
            STATUS_COLORS[mission.status] || 'bg-gray-100 text-gray-600'
          }`}
        >
          {t(`mission.status.${mission.status}`)}
        </span>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 min-h-0 gap-4 flex-col lg:flex-row">
        {/* Left: Chat area */}
        <div className="flex flex-col flex-1 min-h-0 lg:min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto rounded-xl border border-[var(--th-border)] bg-[var(--th-card)] p-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[var(--th-text-muted)] text-sm">
                {t('mission.startConversation')}
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((msg) => renderMessage(msg))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="mt-3 shrink-0">
            {isCallActive && (
              <div className="mb-2 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs text-center">
                {t('mission.callInProgress')}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={inputDisabled}
                placeholder={
                  isCallActive ? t('mission.chatDisabledDuringCall') : t('mission.typeMessage')
                }
                className="flex-1 px-4 py-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
              />
              <button
                onClick={sendMessage}
                disabled={inputDisabled || !input.trim()}
                className="px-4 py-3 rounded-xl bg-[var(--th-primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Mission Details sidebar */}
        <div className="lg:w-80 shrink-0 overflow-y-auto rounded-xl border border-[var(--th-border)] bg-[var(--th-card)] p-4 space-y-5">
          <h2 className="text-sm font-semibold text-[var(--th-text)] uppercase tracking-wide">
            {t('mission.details')}
          </h2>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-xs text-[var(--th-text-muted)] font-medium">
              {t('mission.statusLabel')}
            </label>
            <div>
              <span
                className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                  STATUS_COLORS[mission.status] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {t(`mission.status.${mission.status}`)}
              </span>
            </div>
          </div>

          {/* Agent */}
          {mission.agent_profile_id && (
            <div className="space-y-1">
              <label className="text-xs text-[var(--th-text-muted)] font-medium">
                {t('mission.agent')}
              </label>
              <p className="text-sm text-[var(--th-text)]">{mission.agent_profile_id}</p>
            </div>
          )}

          {/* Phone */}
          {mission.target_phone && (
            <div className="space-y-1">
              <label className="text-xs text-[var(--th-text-muted)] font-medium">
                {t('mission.phone')}
              </label>
              <p className="text-sm text-[var(--th-text)] font-mono">{mission.target_phone}</p>
            </div>
          )}

          {/* Goal */}
          {mission.goal && (
            <div className="space-y-1">
              <label className="text-xs text-[var(--th-text-muted)] font-medium">
                {t('mission.goal')}
              </label>
              <p className="text-sm text-[var(--th-text)]">{mission.goal}</p>
            </div>
          )}

          {/* Context */}
          {mission.context && Object.keys(mission.context).length > 0 && (
            <div className="space-y-1">
              <label className="text-xs text-[var(--th-text-muted)] font-medium">
                {t('mission.context')}
              </label>
              <div className="space-y-1">
                {Object.entries(mission.context).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-start gap-2 text-sm px-3 py-2 rounded-lg bg-[var(--th-surface)]"
                  >
                    <span className="text-[var(--th-text-muted)] shrink-0">{k}:</span>
                    <span className="text-[var(--th-text)] break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback */}
          {mission.fallback_action && (
            <div className="space-y-1">
              <label className="text-xs text-[var(--th-text-muted)] font-medium">
                {t('mission.fallback')}
              </label>
              <p className="text-sm text-[var(--th-text)]">{mission.fallback_action}</p>
            </div>
          )}

          {/* Scheduled */}
          {mission.scheduled_at && (
            <div className="space-y-1">
              <label className="text-xs text-[var(--th-text-muted)] font-medium">
                {t('mission.scheduled')}
              </label>
              <p className="text-sm text-[var(--th-text)]">{fmtDate(mission.scheduled_at)}</p>
            </div>
          )}

          {/* Live Call link */}
          {mission.call_id && isCallActive && (
            <button
              onClick={() => router.push(`/dashboard/calls/${mission.call_id}/live`)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--th-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <span>{'\uD83D\uDCDE'}</span>
              {t('mission.liveCall')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}

          {/* Outcome */}
          {mission.outcome && Object.keys(mission.outcome).length > 0 && (
            <div className="space-y-1">
              <label className="text-xs text-[var(--th-text-muted)] font-medium">
                {t('mission.outcome')}
              </label>
              <div className="space-y-1">
                {Object.entries(mission.outcome).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-start gap-2 text-sm px-3 py-2 rounded-lg bg-[var(--th-surface)]"
                  >
                    <span className="text-[var(--th-text-muted)] shrink-0">{k}:</span>
                    <span className="text-[var(--th-text)] break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-3 border-t border-[var(--th-border)] space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--th-text-muted)]">{t('mission.created')}</span>
              <span className="text-[var(--th-text-secondary)]">{fmtDate(mission.created_at)}</span>
            </div>
            {mission.started_at && (
              <div className="flex justify-between text-xs">
                <span className="text-[var(--th-text-muted)]">{t('mission.started')}</span>
                <span className="text-[var(--th-text-secondary)]">
                  {fmtDate(mission.started_at)}
                </span>
              </div>
            )}
            {mission.completed_at && (
              <div className="flex justify-between text-xs">
                <span className="text-[var(--th-text-muted)]">{t('mission.completed')}</span>
                <span className="text-[var(--th-text-secondary)]">
                  {fmtDate(mission.completed_at)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
