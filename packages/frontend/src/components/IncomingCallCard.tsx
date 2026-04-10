'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/lib/socket';
import { useT } from '@/lib/i18n';
import { api } from '@/lib/api';

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

const ANIMATION_MS = 300;
const DEFAULT_AUTO_ANSWER = 30;

// ─── Component ──────────────────────────────────────────────────────────────

export default function IncomingCallCard() {
  const { socket } = useSocket();
  const t = useT();
  const router = useRouter();
  const [call, setCall] = useState<IncomingCallData | null>(null);
  const [removing, setRemoving] = useState(false);
  const [countdown, setCountdown] = useState(DEFAULT_AUTO_ANSWER);
  const [answering, setAnswering] = useState(false);
  const callRef = useRef<IncomingCallData | null>(null);
  const autoAnswerRef = useRef(DEFAULT_AUTO_ANSWER);

  callRef.current = call;

  const dismiss = useCallback(() => {
    setRemoving(true);
    setTimeout(() => { setCall(null); setRemoving(false); }, ANIMATION_MS);
  }, []);

  const answerCall = useCallback(async (mode: 'manual' | 'internal' | 'reject') => {
    if (!call || answering) return;
    setAnswering(true);
    try {
      await api.post(`/calls/${call.call_id}/answer`, { mode });
      if (mode === 'manual') {
        dismiss();
        router.push(`/dashboard/dialer?callId=${call.call_id}`);
      } else if (mode === 'internal') {
        dismiss();
        router.push(`/dashboard/calls/${call.call_id}/live`);
      } else {
        dismiss();
      }
    } catch {
      setAnswering(false);
    }
  }, [call, answering, dismiss, router]);

  // Listen for incoming calls
  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (data: IncomingCallData) => {
      setRemoving(false);
      setAnswering(false);
      setCall(data);
      setCountdown(autoAnswerRef.current);
    };

    const handleConfig = (data: { call_id: string; auto_answer_delay_seconds: number }) => {
      autoAnswerRef.current = data.auto_answer_delay_seconds;
      setCountdown(data.auto_answer_delay_seconds);
    };

    const handleStatus = (data: CallStatusData) => {
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'no-answer' || data.status === 'in_progress') {
        const current = callRef.current;
        if (current && data.call_id === current.call_id) dismiss();
      }
    };

    const handleAnswered = (data: { call_id: string }) => {
      const current = callRef.current;
      if (current && data.call_id === current.call_id) dismiss();
    };

    socket.on('call:incoming', handleIncoming);
    socket.on('call:incoming:config', handleConfig);
    socket.on('call:status', handleStatus);
    socket.on('call:answered', handleAnswered);

    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:incoming:config', handleConfig);
      socket.off('call:status', handleStatus);
      socket.off('call:answered', handleAnswered);
    };
  }, [socket, dismiss]);

  // Countdown timer
  useEffect(() => {
    if (!call) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [call]);

  if (!call) return null;

  const callerName = call.caller?.name ?? t('realtime.unknownCaller');
  const facts = call.caller?.recent_facts?.slice(0, 3) ?? [];

  return (
    <>
      <div
        className={`fixed top-4 right-4 z-50 w-[340px] md:w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border border-green-500/30 bg-gray-900/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-[opacity,transform] ${
          removing ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-[slideInCall_0.3s_ease-out]'
        }`}
        style={{ transitionDuration: `${ANIMATION_MS}ms` }}
      >
        {/* Pulsing top bar */}
        <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500 rounded-t-2xl animate-pulse" />

        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 animate-pulse">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-green-400 uppercase tracking-wider">
              {t('realtime.incomingCall')}
            </div>
            <div className="text-lg font-bold text-white leading-tight truncate font-mono">
              {call.from_number}
            </div>
          </div>
          {/* Countdown */}
          <div className="shrink-0 w-10 h-10 rounded-full border-2 border-amber-500/50 flex items-center justify-center">
            <span className="text-sm font-bold text-amber-400 tabular-nums">{countdown}</span>
          </div>
        </div>

        {/* Caller info */}
        <div className="px-4 pb-2 space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="font-medium truncate">{callerName}</span>
            {call.caller?.company && (
              <span className="text-gray-500 truncate">({call.caller.company})</span>
            )}
            {call.caller && call.caller.total_calls > 1 && (
              <span className="text-gray-500 text-xs">{call.caller.total_calls} calls</span>
            )}
          </div>

          {facts.length > 0 && (
            <div className="space-y-0.5">
              {facts.map((fact, i) => (
                <div key={i} className="text-[11px] text-gray-400 flex items-start gap-1.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-500 shrink-0" />
                  <span className="line-clamp-1">{fact}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-[10px] text-gray-500">
            {t('realtime.agent')}: <span className="text-purple-400 font-medium">{call.agent_name}</span>
            {countdown > 0 && <span className="ml-2">Auto-agent in {countdown}s</span>}
          </div>
        </div>

        {/* 3 Action Buttons */}
        <div className="flex items-center gap-2 px-4 pb-4 pt-1">
          {/* Answer with Voice */}
          <button
            onClick={() => answerCall('manual')}
            disabled={answering}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-[background,transform] disabled:opacity-50 active:scale-[0.97]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
            Voice
          </button>

          {/* Answer with AI Agent */}
          <button
            onClick={() => answerCall('internal')}
            disabled={answering}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-[background,transform] disabled:opacity-50 active:scale-[0.97]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            Agent
          </button>

          {/* Reject */}
          <button
            onClick={() => answerCall('reject')}
            disabled={answering}
            className="px-3 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-sm font-semibold transition-[background,transform] disabled:opacity-50 active:scale-[0.97]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
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
