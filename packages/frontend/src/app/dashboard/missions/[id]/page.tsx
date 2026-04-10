'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { useIsMobile } from '@/lib/useBreakpoint';
import CollapsibleSection from '@/components/CollapsibleSection';

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
  draft:       'bg-[var(--th-surface)] text-[var(--th-text-muted)]',
  ready:       'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]',
  scheduled:   'bg-[var(--th-info-bg)] text-[var(--th-info-text)]',
  calling:     'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]',
  in_progress: 'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]',
  on_hold:     'bg-[var(--th-error-bg)] text-[var(--th-error-text)]',
  completed:   'bg-[var(--th-success-bg)] text-[var(--th-success-text)]',
  failed:      'bg-[var(--th-error-bg)] text-[var(--th-error-text)]',
  cancelled:   'bg-[var(--th-surface)] text-[var(--th-text-muted)]',
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
  const isMobile = useIsMobile();
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
      // Refetch mission to get call_id for redirect
      const updated = await api.get<{ mission: Mission }>(`/missions/${missionId}`);
      if (updated.mission) {
        setMission(updated.mission);
        // Redirect to live page immediately
        if (updated.mission.call_id) {
          router.push(`/dashboard/calls/${updated.mission.call_id}/live`);
          return;
        }
      }
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

  // Auto-redirect to live page only when status TRANSITIONS to calling (not on initial load)
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = mission?.status;
    prevStatusRef.current = curr ?? null;
    // Only redirect if status just changed to calling/in_progress (not on first load)
    if (prev && prev !== curr && isCallActive && mission?.call_id) {
      router.push(`/dashboard/calls/${mission.call_id}/live`);
    }
  }, [mission?.status, mission?.call_id, isCallActive, router]);

  // ─── Loading ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-[var(--th-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-14 h-14 bg-[var(--th-surface)] rounded-2xl flex items-center justify-center text-[var(--th-text-muted)]">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /></svg>
        </div>
        <p className="text-sm font-medium text-[var(--th-text-secondary)]">{t('mission.notFound')}</p>
        <button
          onClick={() => router.push('/dashboard/missions')}
          className="text-xs text-[var(--th-primary-text)] hover:underline font-medium"
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
          <div className="px-4 py-1.5 rounded-full text-[10px] font-semibold bg-[var(--th-surface)] text-[var(--th-text-muted)] border border-[var(--th-card-border-subtle)] flex items-center gap-1.5">
            {msg.message_type === 'call_update' && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
            )}
            {msg.content}
          </div>
        </div>
      );
    }

    // User messages — right-aligned gradient bubble
    if (msg.sender_type === 'user') {
      return (
        <div key={msg.id} className="flex justify-end my-2">
          <div className="max-w-[85%] md:max-w-[75%] px-3 md:px-4 py-3 rounded-2xl rounded-br-sm bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 text-white text-sm leading-relaxed shadow-[0_1px_3px_var(--th-shadow)]">
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
          <div className="max-w-[90%] md:max-w-[80%] rounded-2xl rounded-bl-sm border border-[var(--th-card-border-subtle)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow)]">
            <div
              className={`px-4 py-2 text-[10px] font-semibold flex items-center gap-2 ${
                isSuccess ? 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]' : 'bg-[var(--th-error-bg)] text-[var(--th-error-text)]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {isSuccess
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
              </svg>
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
        <div className="max-w-[90%] md:max-w-[80%] space-y-2">
          {textContent && (
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-[var(--th-surface)] text-sm text-[var(--th-text)] leading-relaxed border border-[var(--th-card-border-subtle)] whitespace-pre-wrap shadow-[0_1px_3px_var(--th-shadow)]">
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
      <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
        <div className="px-4 py-3 bg-[var(--th-surface)] border-b border-[var(--th-card-border-subtle)] flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="text-sm font-semibold text-[var(--th-text)]">
            {t('mission.planReady')}
          </span>
        </div>
        <div className="px-4 py-3 space-y-2.5 text-sm">
          {p.target_phone && (
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-[var(--th-text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
              <span className="text-[var(--th-text-muted)]">{t('mission.phone')}:</span>
              <span className="text-[var(--th-text)] font-medium tabular-nums">{p.target_phone}</span>
            </div>
          )}
          {p.goal && (
            <div className="flex items-start gap-2.5">
              <svg className="w-4 h-4 text-[var(--th-text-muted)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /></svg>
              <span className="text-[var(--th-text-muted)]">{t('mission.goal')}:</span>
              <span className="text-[var(--th-text)]">{p.goal}</span>
            </div>
          )}
          {p.agent && (
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-[var(--th-text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
              <span className="text-[var(--th-text-muted)]">{t('mission.agent')}:</span>
              <span className="text-[var(--th-text)]">{p.agent}</span>
            </div>
          )}
          {p.context && Object.keys(p.context).length > 0 && (
            <div className="flex items-start gap-2.5">
              <svg className="w-4 h-4 text-[var(--th-text-muted)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
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
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-[var(--th-text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-[var(--th-text-muted)]">{t('mission.scheduled')}:</span>
              <span className="text-[var(--th-text)]">{fmtDate(p.scheduled_at)}</span>
            </div>
          )}
          {p.fallback && (
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-[var(--th-text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
              <span className="text-[var(--th-text-muted)]">{t('mission.fallback')}:</span>
              <span className="text-[var(--th-text)]">{p.fallback}</span>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-[var(--th-card-border-subtle)] flex gap-2">
          <button
            onClick={executeMission}
            disabled={executing || isCallActive}
            className="px-4 py-2 min-h-[44px] text-sm font-semibold rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-[0_4px_16px_rgba(34,197,94,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {executing ? t('common.loading') : t('mission.confirmAndCall')}
          </button>
          {p.scheduled_at && (
            <button
              onClick={executeMission}
              disabled={executing || isCallActive}
              className="px-4 py-2 min-h-[44px] text-sm font-semibold rounded-xl border border-[var(--th-card-border-subtle)] text-[var(--th-text)] hover:bg-[var(--th-surface)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
    <div className="flex flex-col h-[calc(100vh-120px)] px-0 md:px-0">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0 mb-3 md:mb-4">
        <button
          onClick={() => router.push('/dashboard/missions')}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-[var(--th-surface)] transition-all text-[var(--th-text-secondary)]"
          title={t('common.back')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-base md:text-lg font-bold text-[var(--th-text)] truncate">
            {mission.title || t('mission.untitled')}
          </h1>
        </div>

        <span
          className={`px-2.5 py-1 text-[10px] font-semibold rounded-full shrink-0 ${
            STATUS_COLORS[mission.status] || 'bg-[var(--th-surface)] text-[var(--th-text-muted)]'
          }`}
        >
          {t(`mission.status.${mission.status}`)}
        </span>

        {isCallActive && (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
        )}

        {/* Retry button for completed/failed/on_hold missions */}
        {(mission.status === 'completed' || mission.status === 'failed' || mission.status === 'on_hold') && (
          <button
            onClick={async () => {
              try {
                await api.post(`/missions/${missionId}/retry`, {});
                const updated = await api.get<{ mission: Mission }>(`/missions/${missionId}`);
                if (updated.mission) {
                  setMission(updated.mission);
                  if (updated.mission.call_id) {
                    router.push(`/dashboard/calls/${updated.mission.call_id}/live`);
                  }
                }
              } catch (e: any) {
                toast.error(e.message || t('common.error'));
              }
            }}
            className="btn-primary px-3 py-1.5 min-h-[44px] text-[10px] md:text-xs rounded-lg flex items-center gap-1.5 shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            {t('missions.retry')}
          </button>
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 min-h-0 gap-4 flex-col lg:flex-row">
        {/* Left: Chat area */}
        <div className="flex flex-col flex-1 min-h-0 lg:min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-4 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-12 h-12 bg-[var(--th-surface)] rounded-2xl flex items-center justify-center text-[var(--th-text-muted)]">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                </div>
                <p className="text-sm text-[var(--th-text-muted)]">{t('mission.startConversation')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((msg) => renderMessage(msg))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="mt-2 md:mt-3 shrink-0">
            {isCallActive && (
              <div className="mb-2 px-3.5 py-2 rounded-xl bg-[var(--th-warning-bg)] border border-[var(--th-card-border-subtle)] text-[var(--th-warning-text)] text-[10px] font-semibold text-center flex items-center justify-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
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
                className="flex-1 px-3 md:px-4 py-3 min-h-[44px] rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              />
              <button
                onClick={sendMessage}
                disabled={inputDisabled || !input.trim()}
                className="btn-primary px-4 py-3 min-h-[44px] min-w-[44px] rounded-xl disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none shrink-0 flex items-center justify-center"
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
        {isMobile ? (
          <div className="shrink-0">
            <CollapsibleSection title={t('mission.details')} defaultOpen={false}>
              <div className="space-y-4">
                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                    {t('mission.statusLabel')}
                  </label>
                  <div>
                    <span
                      className={`inline-block px-2.5 py-1 text-[10px] font-semibold rounded-full ${
                        STATUS_COLORS[mission.status] || 'bg-[var(--th-surface)] text-[var(--th-text-muted)]'
                      }`}
                    >
                      {t(`mission.status.${mission.status}`)}
                    </span>
                  </div>
                </div>

                {mission.agent_profile_id && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                      {t('mission.agent')}
                    </label>
                    <p className="text-sm text-[var(--th-text)]">{mission.agent_profile_id}</p>
                  </div>
                )}

                {mission.target_phone && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                      {t('mission.phone')}
                    </label>
                    <p className="text-sm text-[var(--th-text)] tabular-nums font-medium">{mission.target_phone}</p>
                  </div>
                )}

                {mission.goal && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                      {t('mission.goal')}
                    </label>
                    <p className="text-sm text-[var(--th-text)] leading-relaxed">{mission.goal}</p>
                  </div>
                )}

                {mission.context && Object.keys(mission.context).length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                      {t('mission.context')}
                    </label>
                    <div className="space-y-1.5">
                      {Object.entries(mission.context).map(([k, v]) => (
                        <div key={k} className="flex items-start gap-2 text-sm px-3 py-2 rounded-xl bg-[var(--th-surface)] border border-[var(--th-card-border-subtle)]">
                          <span className="text-[var(--th-text-muted)] shrink-0 text-xs">{k}:</span>
                          <span className="text-[var(--th-text)] break-all">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mission.fallback_action && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                      {t('mission.fallback')}
                    </label>
                    <p className="text-sm text-[var(--th-text)]">{mission.fallback_action}</p>
                  </div>
                )}

                {mission.scheduled_at && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                      {t('mission.scheduled')}
                    </label>
                    <p className="text-sm text-[var(--th-text)]">{fmtDate(mission.scheduled_at)}</p>
                  </div>
                )}

                {mission.call_id && isCallActive && (
                  <button
                    onClick={() => router.push(`/dashboard/calls/${mission.call_id}/live`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold hover:shadow-[0_4px_16px_rgba(34,197,94,0.3)] transition-all"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                    </span>
                    {t('mission.liveCall')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {mission.outcome && Object.keys(mission.outcome).length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                      {t('mission.outcome')}
                    </label>
                    <div className="space-y-1.5">
                      {Object.entries(mission.outcome).map(([k, v]) => (
                        <div key={k} className="flex items-start gap-2 text-sm px-3 py-2 rounded-xl bg-[var(--th-surface)] border border-[var(--th-card-border-subtle)]">
                          <span className="text-[var(--th-text-muted)] shrink-0 text-xs">{k}:</span>
                          <span className="text-[var(--th-text)] break-all">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="pt-3 border-t border-[var(--th-card-border-subtle)] space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--th-text-muted)]">{t('mission.created')}</span>
                    <span className="text-[var(--th-text-secondary)]">{fmtDate(mission.created_at)}</span>
                  </div>
                  {mission.started_at && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--th-text-muted)]">{t('mission.started')}</span>
                      <span className="text-[var(--th-text-secondary)]">{fmtDate(mission.started_at)}</span>
                    </div>
                  )}
                  {mission.completed_at && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--th-text-muted)]">{t('mission.completed')}</span>
                      <span className="text-[var(--th-text-secondary)]">{fmtDate(mission.completed_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleSection>
          </div>
        ) : (
          <div className="lg:w-80 shrink-0 overflow-y-auto rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-4 md:p-5 space-y-3 md:space-y-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
            <h2 className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">
              {t('mission.details')}
            </h2>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                {t('mission.statusLabel')}
              </label>
              <div>
                <span
                  className={`inline-block px-2.5 py-1 text-[10px] font-semibold rounded-full ${
                    STATUS_COLORS[mission.status] || 'bg-[var(--th-surface)] text-[var(--th-text-muted)]'
                  }`}
                >
                  {t(`mission.status.${mission.status}`)}
                </span>
              </div>
            </div>

            {/* Agent */}
            {mission.agent_profile_id && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                  {t('mission.agent')}
                </label>
                <p className="text-sm text-[var(--th-text)]">{mission.agent_profile_id}</p>
              </div>
            )}

            {/* Phone */}
            {mission.target_phone && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                  {t('mission.phone')}
                </label>
                <p className="text-sm text-[var(--th-text)] tabular-nums font-medium">{mission.target_phone}</p>
              </div>
            )}

            {/* Goal */}
            {mission.goal && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                  {t('mission.goal')}
                </label>
                <p className="text-sm text-[var(--th-text)] leading-relaxed">{mission.goal}</p>
              </div>
            )}

            {/* Context */}
            {mission.context && Object.keys(mission.context).length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                  {t('mission.context')}
                </label>
                <div className="space-y-1.5">
                  {Object.entries(mission.context).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-start gap-2 text-sm px-3 py-2 rounded-xl bg-[var(--th-surface)] border border-[var(--th-card-border-subtle)]"
                    >
                      <span className="text-[var(--th-text-muted)] shrink-0 text-xs">{k}:</span>
                      <span className="text-[var(--th-text)] break-all">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fallback */}
            {mission.fallback_action && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                  {t('mission.fallback')}
                </label>
                <p className="text-sm text-[var(--th-text)]">{mission.fallback_action}</p>
              </div>
            )}

            {/* Scheduled */}
            {mission.scheduled_at && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                  {t('mission.scheduled')}
                </label>
                <p className="text-sm text-[var(--th-text)]">{fmtDate(mission.scheduled_at)}</p>
              </div>
            )}

            {/* Live Call link */}
            {mission.call_id && isCallActive && (
              <button
                onClick={() => router.push(`/dashboard/calls/${mission.call_id}/live`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold hover:shadow-[0_4px_16px_rgba(34,197,94,0.3)] transition-all"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                {t('mission.liveCall')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Outcome */}
            {mission.outcome && Object.keys(mission.outcome).length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-[var(--th-text-muted)] font-semibold uppercase tracking-wider">
                  {t('mission.outcome')}
                </label>
                <div className="space-y-1.5">
                  {Object.entries(mission.outcome).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-start gap-2 text-sm px-3 py-2 rounded-xl bg-[var(--th-surface)] border border-[var(--th-card-border-subtle)]"
                    >
                      <span className="text-[var(--th-text-muted)] shrink-0 text-xs">{k}:</span>
                      <span className="text-[var(--th-text)] break-all">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="pt-3 border-t border-[var(--th-card-border-subtle)] space-y-2">
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
        )}
      </div>
    </div>
  );
}
