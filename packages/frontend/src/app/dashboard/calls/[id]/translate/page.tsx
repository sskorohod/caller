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
        <div className="animate-spin h-8 w-8 border-4 rounded-full"
             style={{ borderColor: 'var(--th-border)', borderTopColor: 'var(--th-primary)' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]" style={{ color: 'var(--th-text)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-4 px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--th-border)', background: 'var(--th-card)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push(`/dashboard/calls/${callId}/live`)}
            className="flex items-center gap-1 text-sm font-medium opacity-70 hover:opacity-100 transition-opacity shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('translate.back')}
          </button>

          <div className="h-5 w-px shrink-0" style={{ background: 'var(--th-border)' }} />

          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">
              {t('translate.title')}
            </h1>
            {displayPhone && (
              <p className="text-xs opacity-60 truncate">
                {t('translate.call')}: {displayPhone}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Target language selector */}
          <select
            value={targetLanguage}
            onChange={e => setTargetLanguage(e.target.value)}
            disabled={isActive}
            className="text-sm rounded-lg px-3 py-1.5 border outline-none transition-colors disabled:opacity-50"
            style={{
              background: 'var(--th-card)',
              borderColor: 'var(--th-border)',
              color: 'var(--th-text)',
            }}
          >
            {TARGET_LANGUAGES.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>

          {/* Mode toggle */}
          <div
            className="flex rounded-lg overflow-hidden border"
            style={{ borderColor: 'var(--th-border)' }}
          >
            {(['translate', 'copilot'] as const).map(m => (
              <button
                key={m}
                onClick={() => !isActive && setMode(m)}
                disabled={isActive}
                className="px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  background: mode === m ? 'var(--th-primary)' : 'var(--th-card)',
                  color: mode === m ? '#fff' : 'var(--th-text)',
                }}
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
        <div
          className="flex items-center gap-4 px-6 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--th-border)', background: 'var(--th-card)' }}
        >
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium opacity-70">
              {t('translate.myLanguage')}
            </label>
            <select
              value={myLanguage}
              onChange={e => setMyLanguage(e.target.value)}
              className="text-sm rounded-lg px-3 py-1.5 border outline-none"
              style={{
                background: 'var(--th-card)',
                borderColor: 'var(--th-border)',
                color: 'var(--th-text)',
              }}
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
              className="w-full text-sm rounded-lg px-3 py-1.5 border outline-none transition-colors"
              style={{
                background: 'var(--th-card)',
                borderColor: 'var(--th-border)',
                color: 'var(--th-text)',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Entries list ─────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {entries.length === 0 && !isActive && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M8 10h14l4 4h14v24H8V10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18 26l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm text-center max-w-xs">
              {t('translate.emptyState')}
            </p>
          </div>
        )}

        {entries.length === 0 && isActive && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
            <div className="animate-pulse flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--th-primary)' }} />
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--th-primary)', animationDelay: '150ms' }} />
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--th-primary)', animationDelay: '300ms' }} />
            </div>
            <p className="text-sm">
              {t('translate.listening')}
            </p>
          </div>
        )}

        {entries.map((entry, i) => (
          <div
            key={i}
            className="rounded-xl px-4 py-3 border transition-colors"
            style={{
              borderColor: 'var(--th-border)',
              background: 'var(--th-card)',
            }}
          >
            {/* Speaker badge */}
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{
                  background: entry.speaker === 'caller'
                    ? 'rgba(34,197,94,0.15)'
                    : 'rgba(59,130,246,0.15)',
                  color: entry.speaker === 'caller'
                    ? 'rgb(34,197,94)'
                    : 'rgb(59,130,246)',
                }}
              >
                {entry.speaker === 'caller'
                  ? t('translate.speakerCaller')
                  : t('translate.speakerAgent')}
              </span>
              {entry.timestamp && (
                <span className="text-[11px] opacity-40">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>

            {/* Original text */}
            <p className="text-xs opacity-50 leading-relaxed mb-0.5">
              {entry.original}
            </p>

            {/* Translated text */}
            <p className="text-sm leading-relaxed" style={{ color: 'var(--th-text)' }}>
              <span className="mr-1 opacity-60">&#128172;</span>
              {entry.translated}
            </p>
          </div>
        ))}
      </div>

      {/* ── Copilot suggestions ──────────────────────────────────────────── */}
      {mode === 'copilot' && isActive && suggestions.length > 0 && (
        <div
          className="border-t px-6 py-4 shrink-0"
          style={{ borderColor: 'var(--th-border)', background: 'var(--th-card)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide mb-3 opacity-60">
            &#128161; {t('translate.suggestedResponses')}
          </p>

          <div className="flex flex-col gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => copySuggestion(s.text)}
                className="text-left rounded-lg px-4 py-3 border transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  borderColor: 'var(--th-border)',
                  background: 'var(--th-card)',
                }}
                title={t('translate.clickToCopy')}
              >
                <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--th-text)' }}>
                  &ldquo;{s.text}&rdquo;
                </p>
                <p className="text-xs opacity-50 mt-0.5 leading-relaxed">
                  {s.translation}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer: Start / Stop ─────────────────────────────────────────── */}
      <div
        className="border-t px-6 py-4 shrink-0"
        style={{ borderColor: 'var(--th-border)', background: 'var(--th-card)' }}
      >
        {!isActive ? (
          <button
            onClick={handleStart}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'var(--th-primary)' }}
          >
            {t('translate.start')}
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'rgb(239,68,68)' }}
          >
            {t('translate.stop')}
          </button>
        )}
      </div>
    </div>
  );
}
