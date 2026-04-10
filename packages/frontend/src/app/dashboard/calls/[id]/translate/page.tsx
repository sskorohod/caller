'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TranslateEntry {
  speaker: 'caller' | 'agent';
  original: string;
  translated: string;
  timestamp: string;
}

interface Suggestion {
  text: string;
  translation: string;
}

interface CallData {
  id: string;
  direction: string;
  status: string;
  from_number: string;
  to_number: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TARGET_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
];

const MY_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function TranslatePage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const { socket } = useSocket();
  const toast = useToast();
  const callId = params.id as string;

  // Call metadata
  const [callData, setCallData] = useState<CallData | null>(null);
  const [loading, setLoading] = useState(true);

  // Translation state
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [myLanguage, setMyLanguage] = useState('ru');
  const [mode, setMode] = useState<'translate' | 'copilot'>('translate');
  const [context, setContext] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [entries, setEntries] = useState<TranslateEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevEntryCount = useRef(0);

  // ─── Load call data ─────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    api.get<{ call: CallData }>(`/calls/${callId}/detail`)
      .then(r => setCallData(r.call))
      .catch(() => toast.error(t('translate.loadError')))
      .finally(() => setLoading(false));
  }, [callId]);

  // ─── Auto-scroll on new entries ─────────────────────────────────────────

  useEffect(() => {
    if (entries.length > prevEntryCount.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
    prevEntryCount.current = entries.length;
  }, [entries.length]);

  // ─── Socket listeners ──────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !isActive) return;

    const onTranslation = (data: TranslateEntry) => {
      setEntries(prev => [...prev, data]);
    };

    const onSuggestions = (data: { suggestions: Suggestion[] }) => {
      setSuggestions(data.suggestions ?? []);
    };

    socket.on('call:translation', onTranslation);
    socket.on('call:copilot:suggestions', onSuggestions);

    return () => {
      socket.off('call:translation', onTranslation);
      socket.off('call:copilot:suggestions', onSuggestions);
    };
  }, [socket, isActive]);

  // ─── Start / Stop ──────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    try {
      await api.post(`/calls/${callId}/translate/start`, {
        target_language: targetLanguage,
        mode,
        ...(mode === 'copilot' ? { my_language: myLanguage, context: context || undefined } : {}),
      });
      socket?.emit('call:translate:join', { call_id: callId });
      setIsActive(true);
      setEntries([]);
      setSuggestions([]);
      toast.success(t('translate.started'));
    } catch {
      toast.error(t('translate.startError'));
    }
  }, [callId, targetLanguage, mode, myLanguage, context, socket]);

  const handleStop = useCallback(async () => {
    try {
      await api.post(`/calls/${callId}/translate/stop`, {});
      socket?.emit('call:translate:leave', { call_id: callId });
      setIsActive(false);
      toast.success(t('translate.stopped'));
    } catch {
      toast.error(t('translate.stopError'));
    }
  }, [callId, socket]);

  // ─── Copy suggestion ──────────────────────────────────────────────────

  const copySuggestion = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(t('translate.copied'));
    });
  }, []);

  // ─── Display phone ────────────────────────────────────────────────────

  const displayPhone = callData
    ? (callData.direction === 'outbound' ? callData.to_number : callData.from_number)
    : '';

  // ─── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-[var(--th-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectCls = 'text-xs border border-[var(--th-card-border-subtle)] rounded-xl px-3 py-1.5 bg-[var(--th-card)] text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all appearance-none cursor-pointer disabled:opacity-40';

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] text-[var(--th-text)]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 px-4 md:px-6 py-3 md:py-4 border-b border-[var(--th-card-border-subtle)] bg-[var(--th-card)] shadow-[0_1px_3px_var(--th-shadow)] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push(`/dashboard/calls/${callId}/live`)}
            className="flex items-center gap-1 text-sm font-medium text-[var(--th-text-secondary)] hover:text-[var(--th-text)] transition-all shrink-0 min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden md:inline">{t('translate.back')}</span>
          </button>

          <div className="h-5 w-px shrink-0 bg-[var(--th-card-border-subtle)] hidden md:block" />

          <div className="min-w-0">
            <h1 className="text-sm md:text-base font-bold truncate text-[var(--th-text)]">
              {t('translate.title')}
            </h1>
            {displayPhone && (
              <p className="text-xs text-[var(--th-text-muted)] truncate tabular-nums">
                {t('translate.call')}: {displayPhone}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Target language selector */}
          <select
            value={targetLanguage}
            onChange={e => setTargetLanguage(e.target.value)}
            disabled={isActive}
            className={`${selectCls} min-h-[44px] md:min-h-0`}
          >
            {TARGET_LANGUAGES.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>

          {/* Mode toggle */}
          <div className="flex p-0.5 bg-[var(--th-surface)] rounded-xl gap-0.5">
            {(['translate', 'copilot'] as const).map(m => (
              <button
                key={m}
                onClick={() => !isActive && setMode(m)}
                disabled={isActive}
                className={`px-3 py-2 md:py-1.5 min-h-[44px] md:min-h-0 text-[10px] font-semibold rounded-lg transition-all disabled:opacity-40 ${
                  mode === m
                    ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white shadow-[0_2px_8px_var(--th-shadow-primary)]'
                    : 'text-[var(--th-text-secondary)] hover:text-[var(--th-text)]'
                }`}
              >
                {m === 'translate'
                  ? t('translate.modeTranslate')
                  : t('translate.modeCopilot')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Copilot settings (visible only in copilot mode, before start) ── */}
      {mode === 'copilot' && !isActive && (
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 px-4 md:px-6 py-3 border-b border-[var(--th-card-border-subtle)] bg-[var(--th-card)] shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider whitespace-nowrap">
              {t('translate.myLanguage')}
            </label>
            <select
              value={myLanguage}
              onChange={e => setMyLanguage(e.target.value)}
              className={`${selectCls} min-h-[44px] md:min-h-0`}
            >
              {MY_LANGUAGES.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder={t('translate.contextPlaceholder')}
              className="w-full text-sm rounded-xl px-3.5 py-2 min-h-[44px] border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
            />
          </div>
        </div>
      )}

      {/* ── Entries list ─────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-6 py-3 md:py-4 space-y-3">
        {entries.length === 0 && !isActive && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-14 h-14 bg-[var(--th-surface)] rounded-2xl flex items-center justify-center text-[var(--th-text-muted)]">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
              </svg>
            </div>
            <p className="text-sm text-[var(--th-text-muted)] text-center max-w-xs">
              {t('translate.emptyState')}
            </p>
          </div>
        )}

        {entries.length === 0 && isActive && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-10 h-10 border-2 border-[var(--th-primary)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--th-text-muted)]">
              {t('translate.listening')}
            </p>
          </div>
        )}

        {entries.map((entry, i) => (
          <div
            key={i}
            className="rounded-2xl px-4 py-3 border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] shadow-[0_1px_3px_var(--th-shadow)] transition-all"
          >
            {/* Speaker badge */}
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  entry.speaker === 'caller'
                    ? 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]'
                    : 'bg-[var(--th-info-bg)] text-[var(--th-info-text)]'
                }`}
              >
                {entry.speaker === 'caller'
                  ? t('translate.speakerCaller')
                  : t('translate.speakerAgent')}
              </span>
              {entry.timestamp && (
                <span className="text-[10px] text-[var(--th-text-muted)] tabular-nums">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>

            {/* Original text */}
            <p className="text-xs text-[var(--th-text-muted)] leading-relaxed mb-0.5">
              {entry.original}
            </p>

            {/* Translated text */}
            <p className="text-sm leading-relaxed text-[var(--th-text)]">
              {entry.translated}
            </p>
          </div>
        ))}
      </div>

      {/* ── Copilot suggestions ──────────────────────────────────────────── */}
      {mode === 'copilot' && isActive && suggestions.length > 0 && (
        <div className="border-t border-[var(--th-card-border-subtle)] px-4 md:px-6 py-3 md:py-4 bg-[var(--th-card)] shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)] mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-[var(--th-warning-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
            {t('translate.suggestedResponses')}
          </p>

          <div className="flex flex-col gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => copySuggestion(s.text)}
                className="text-left rounded-xl px-4 py-3 min-h-[48px] border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] hover:border-[var(--th-border)] hover:shadow-[0_2px_8px_var(--th-card-glow)] transition-all active:scale-[0.99]"
                title={t('translate.clickToCopy')}
              >
                <p className="text-sm font-medium leading-relaxed text-[var(--th-text)]">
                  &ldquo;{s.text}&rdquo;
                </p>
                <p className="text-xs text-[var(--th-text-muted)] mt-0.5 leading-relaxed">
                  {s.translation}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer: Start / Stop ─────────────────────────────────────────── */}
      <div className="border-t border-[var(--th-card-border-subtle)] px-4 md:px-6 py-3 md:py-4 bg-[var(--th-card)] shrink-0">
        {!isActive ? (
          <button
            onClick={handleStart}
            className="btn-primary w-full py-3 md:py-2.5 min-h-[48px] rounded-xl"
          >
            {t('translate.start')}
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full py-3 md:py-2.5 min-h-[48px] rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)] transition-all active:scale-[0.98]"
          >
            {t('translate.stop')}
          </button>
        )}
      </div>
    </div>
  );
}
