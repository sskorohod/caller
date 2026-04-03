'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/lib/socket';
import { useT } from '@/lib/i18n';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface IncomingCallData {
  call_id: string;
  from_number: string;
  to_number: string;
  direction: string;
  agent_name: string;
  caller: {
    name: string | null;
    company: string | null;
    total_calls: number;
    last_call_at: string | null;
    recent_facts: string[];
  } | null;
}

interface CallStatusData {
  call_id: string;
  status: string;
}

const AUTO_DISMISS_MS = 30_000;
const ANIMATION_MS = 300;

// ─── Component ──────────────────────────────────────────────────────────────

export default function IncomingCallCard() {
  const { socket } = useSocket();
  const t = useT();
  const router = useRouter();
  const [call, setCall] = useState<IncomingCallData | null>(null);
  const [removing, setRemoving] = useState(false);

  const dismiss = useCallback(() => {
    setRemoving(true);
    setTimeout(() => {
      setCall(null);
      setRemoving(false);
    }, ANIMATION_MS);
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (data: IncomingCallData) => {
      setRemoving(false);
      setCall(data);
    };

    const handleStatus = (data: CallStatusData) => {
      // Dismiss when call ends
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'no-answer') {
        if (call && data.call_id === call.call_id) {
          dismiss();
        }
      }
    };

    socket.on('call:incoming', handleIncoming);
    socket.on('call:status', handleStatus);

    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:status', handleStatus);
    };
  }, [socket, call, dismiss]);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    if (!call) return;
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [call, dismiss]);

  if (!call) return null;

  const callerName = call.caller?.name ?? t('realtime.unknownCaller');
  const facts = call.caller?.recent_facts?.slice(0, 3) ?? [];

  return (
    <>
      <div
        className={`fixed top-4 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--th-success-border)] bg-[var(--th-call-card-bg)] backdrop-blur-xl backdrop-saturate-150 shadow-lg transition-all ${
          removing
            ? 'opacity-0 translate-x-4'
            : 'opacity-100 translate-x-0 animate-[slideInCall_0.3s_ease-out]'
        }`}
        style={{ transitionDuration: `${ANIMATION_MS}ms` }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-9 h-9 rounded-full bg-[var(--th-success-bg)] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-[var(--th-success-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-[var(--th-success-text)] uppercase tracking-wide">
              {t('realtime.incomingCall')}
            </div>
            <div className="text-lg font-bold text-[var(--th-text)] leading-tight truncate">
              {call.from_number}
            </div>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 p-1 rounded-lg hover:bg-black/5 text-[var(--th-text-muted)] hover:text-[var(--th-text)] transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Caller info */}
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-[var(--th-text-dark)]">
            <span className="font-medium">{t('realtime.caller')}:</span>
            <span className="truncate">{callerName}</span>
            {call.caller?.company && (
              <span className="text-[var(--th-text-muted)] truncate">({call.caller.company})</span>
            )}
          </div>

          {call.caller && call.caller.total_calls > 0 && (
            <div className="text-xs text-[var(--th-text-muted)]">
              {call.caller.total_calls} {t('realtime.previousCalls')}
            </div>
          )}

          {facts.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-[var(--th-text-secondary)]">{t('realtime.recentNotes')}</div>
              <ul className="space-y-0.5">
                {facts.map((fact, i) => (
                  <li key={i} className="text-xs text-[var(--th-text-muted)] flex items-start gap-1.5">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-[var(--th-text-muted)] shrink-0" />
                    <span className="line-clamp-1">{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Agent badge */}
          <div className="flex items-center gap-1.5 text-xs text-[var(--th-text-muted)]">
            <span>{t('realtime.agent')}:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--th-primary)]/10 text-[var(--th-primary-text)] text-[11px] font-medium">
              {call.agent_name}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 pb-4">
          <button
            onClick={() => { dismiss(); router.push(`/dashboard/calls/${call.call_id}/live`); }}
            className="flex-1 text-center px-3 py-2 rounded-lg bg-[var(--th-primary)] text-white text-sm font-medium hover:bg-[var(--th-primary-hover)] transition-colors"
          >
            {t('realtime.view')}
          </button>
          <button
            onClick={dismiss}
            className="flex-1 text-center px-3 py-2 rounded-lg border border-[var(--th-border)] text-[var(--th-text-secondary)] text-sm font-medium hover:bg-[var(--th-surface)] transition-colors"
          >
            {t('realtime.dismiss')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInCall {
          from { opacity: 0; transform: translateX(1.5rem); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
