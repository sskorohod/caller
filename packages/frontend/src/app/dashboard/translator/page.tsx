'use client';

import { useState, useEffect, useRef } from 'react';
import { useT } from '@/lib/i18n';
import { useSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import { useIsMobile } from '@/lib/useBreakpoint';
import CollapsibleSection from '@/components/CollapsibleSection';

interface TranslatorDefaults {
  greeting_text?: string;
  tts_voice_id?: string;
  tone?: string;
  personal_context?: string;
  my_language?: string;
  target_language?: string;
  translation_mode?: string;
}

interface ActiveSession {
  id: string;
  call_id: string | null;
}

interface TranslationEntry {
  speaker: string;
  original: string;
  translated: string;
  timestamp: string;
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
];

const VOICES = [
  { value: 'ara', label: 'Ara', gender: 'Female' },
  { value: 'eve', label: 'Eve', gender: 'Female' },
  { value: 'rex', label: 'Rex', gender: 'Male' },
  { value: 'sal', label: 'Sal', gender: 'Male' },
  { value: 'leo', label: 'Leo', gender: 'Male' },
];

const TONES = [
  { value: 'neutral', label: 'Neutral', desc: 'Natural translation, preserves original tone.' },
  { value: 'business', label: 'Business', desc: 'Formal, professional. Removes filler words (um, uh).' },
  { value: 'friendly', label: 'Friendly', desc: 'Warm, casual, conversational.' },
  { value: 'medical', label: 'Medical', desc: 'Precise medical terminology.' },
  { value: 'legal', label: 'Legal', desc: 'Precise legal terminology, formal tone.' },
  { value: 'intelligent', label: 'Intelligent', desc: 'Rephrases speech to sound eloquent, polite, and well-spoken before translating.' },
];

const selectCls = "w-full px-3 py-2 rounded-xl border border-[var(--th-border)] bg-[var(--th-input)] text-[var(--th-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/30 focus:border-[var(--th-primary)] transition-all appearance-none";

export default function TranslatorPage() {
  const t = useT();
  const { socket } = useSocket();
  const isMobile = useIsMobile();

  // ─── Translator Phone Number ────────────────────────────────────
  const [translatorPhone, setTranslatorPhone] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ phone_number: string | null }>('/translator/phone')
      .then(r => { if (r.phone_number) setTranslatorPhone(r.phone_number); })
      .catch(() => {});
  }, []);

  // ─── Settings ──────────────────────────────────────────────────
  const [defaults, setDefaults] = useState<TranslatorDefaults>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<TranslatorDefaults>('/translator/defaults').then(setDefaults).catch(() => {});
  }, []);

  const saveDefaults = async () => {
    setSaving(true);
    try {
      const updated = await api.put<TranslatorDefaults>('/translator/defaults', defaults);
      setDefaults(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  // ─── Live Monitor ──────────────────────────────────────────────
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [liveCallId, setLiveCallId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<TranslationEntry[]>([]);
  const [liveInterim, setLiveInterim] = useState<{ original: string; translated: string } | null>(null);
  const [callEnded, setCallEnded] = useState(false);
  const liveEndRef = useRef<HTMLDivElement>(null);

  // Auto-detect active session for sidebar
  useEffect(() => {
    api.get<{ sessions: ActiveSession[] }>('/translator/sessions/active')
      .then(r => {
        setActiveSessions(r.sessions);
        if (r.sessions.length > 0 && r.sessions[0].call_id && !liveCallId) {
          setLiveCallId(r.sessions[0].call_id);
          setCallEnded(false);
        }
      })
      .catch(() => {});
  }, []);

  // Listen for NEW calls — always active, even without liveCallId
  useEffect(() => {
    if (!socket) return;

    const onNewCall = (data: { call_id: string; status: string }) => {
      if (data.status === 'in_progress' && data.call_id) {
        setLiveCallId(prev => {
          if (prev === data.call_id) return prev; // already tracking
          return data.call_id;
        });
        setLiveTranscript([]);
        setLiveInterim(null);
        setCallEnded(false);
      }
    };

    socket.on('call:status', onNewCall);
    return () => { socket.off('call:status', onNewCall); };
  }, [socket]);

  // Live transcript for active call
  useEffect(() => {
    if (!socket || !liveCallId) return;

    // Only clear transcript when connecting to a NEW call (not when ended)
    if (!callEnded) {
      setLiveTranscript([]);
      setLiveInterim(null);
    }

    socket.emit('call:translate:join', { call_id: liveCallId });

    const onTranslation = (data: { call_id: string; speaker: string; original: string; translated: string; timestamp: string }) => {
      if (data.call_id !== liveCallId) return;
      setLiveTranscript(prev => [...prev, { speaker: data.speaker, original: data.original, translated: data.translated, timestamp: data.timestamp }]);
      setLiveInterim(null);
    };

    const onInterim = (data: { call_id: string; original: string; translated: string }) => {
      if (data.call_id !== liveCallId) return;
      setLiveInterim({ original: data.original || '', translated: data.translated || '' });
    };

    const onCallEnd = (data: { call_id: string; status: string }) => {
      if (data.call_id !== liveCallId) return;
      if (data.status === 'completed' || data.status === 'failed') {
        setCallEnded(true);
        setLiveInterim(null);
      }
    };

    socket.on('call:translation', onTranslation);
    socket.on('call:translation:interim', onInterim);
    socket.on('call:status', onCallEnd);

    return () => {
      socket.emit('call:translate:leave', { call_id: liveCallId });
      socket.off('call:translation', onTranslation);
      socket.off('call:translation:interim', onInterim);
      socket.off('call:status', onCallEnd);
    };
  }, [socket, liveCallId, callEnded]);

  useEffect(() => {
    liveEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTranscript, liveInterim]);

  // ─── Live Translation Sidebar ──────────────────────────────────
  const LiveSidebar = () => {
    const hasLive = liveCallId && liveTranscript.length > 0;
    const hasInterim = liveCallId && liveInterim;

    return (
      <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] flex flex-col h-full min-h-[500px]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--th-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {liveCallId && !callEnded ? (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            ) : callEnded ? (
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
            )}
            <span className="text-sm font-bold text-[var(--th-text)]">
              {liveCallId && !callEnded ? t('translator.liveTranslation') : callEnded ? t('translator.translation') : t('translator.translation')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Column labels */}
            <div className="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">
              <span>{t('translator.other')}</span>
              <span>{t('translator.you')}</span>
            </div>
            {/* Hangup button — only during active call */}
            {liveCallId && !callEnded && (
              <button
                onClick={async () => {
                  try {
                    await api.post(`/calls/${liveCallId}/hangup`, {});
                  } catch { /* ignore */ }
                }}
                className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-400 transition-all"
                title="End call"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414M2.757 18.364a9 9 0 001.414 1.414M3.69 3.69L20.31 20.31" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {!liveCallId && !hasLive && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--th-surface)] flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[var(--th-text-muted)]">{t('translator.noActiveCall')}</p>
              <p className="text-[11px] text-[var(--th-text-muted)] mt-1 opacity-60">{t('translator.waitingHint')}</p>
            </div>
          )}

          {liveTranscript.map((entry, i) => {
            const isYou = entry.speaker === 'subscriber';
            return (
              <div key={i} className={`flex ${isYou ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  isYou
                    ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/20'
                    : 'bg-[var(--th-surface)] border border-[var(--th-border)]'
                }`}>
                  <p className="text-[15px] font-semibold leading-relaxed text-[var(--th-text)]">
                    {entry.translated}
                  </p>
                  <p className="text-[12px] mt-1.5 text-[var(--th-text-muted)] leading-snug">
                    {entry.original}
                  </p>
                  <span className="text-[10px] text-[var(--th-text-muted)] mt-1 block opacity-50">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Interim (typing indicator) */}
          {hasInterim && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[var(--th-surface)] border border-amber-500/20">
                {liveInterim!.translated ? (
                  <p className="text-[15px] font-semibold leading-relaxed text-[var(--th-text)]">
                    {liveInterim!.translated}<span className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 animate-pulse" />
                  </p>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse [animation-delay:300ms]" />
                  </div>
                )}
                {liveInterim!.original && (
                  <p className="text-[12px] mt-1.5 text-[var(--th-text-muted)] leading-snug">
                    {liveInterim!.original}
                  </p>
                )}
              </div>
            </div>
          )}

          <div ref={liveEndRef} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 md:space-y-5">
      {/* Header + Phone + Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <h2 className="text-lg md:text-xl font-bold text-[var(--th-text)]">{t('translator.title')}</h2>
        <div className="flex items-center gap-4">
          {translatorPhone && (
            <div className="text-left md:text-right w-full md:w-auto">
              <a href={`tel:${translatorPhone}`}
                className="text-xl md:text-2xl font-extrabold tracking-wide"
                style={{
                  background: 'linear-gradient(135deg, #a855f7, #7c3aed, #6d28d9)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 12px rgba(139,92,246,0.5)) drop-shadow(0 0 24px rgba(139,92,246,0.25))',
                }}>
                {translatorPhone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 ($1) $2-$3')}
              </a>
              <p className="text-[11px] text-[var(--th-text-muted)] mt-0.5">{t('translator.callHint')}</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Live Translation — mobile (above settings) ────────────── */}
      {isMobile && liveCallId && (
        <div className="lg:hidden">
          <LiveSidebar />
        </div>
      )}

      {/* ─── Settings + Live Sidebar ──────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-3 md:gap-5">
        {isMobile && liveCallId ? (
          <CollapsibleSection title={t('translator.settings') || 'Settings'} defaultOpen={false}>
            <SettingsContent
              defaults={defaults} setDefaults={setDefaults} saving={saving} saved={saved}
              saveDefaults={saveDefaults} t={t} selectCls={selectCls}
            />
          </CollapsibleSection>
        ) : (
          <div className="flex-1 min-w-0 rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-4 md:p-6 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
            <SettingsContent
              defaults={defaults} setDefaults={setDefaults} saving={saving} saved={saved}
              saveDefaults={saveDefaults} t={t} selectCls={selectCls}
            />
          </div>
        )}
        {/* Live Translation — equal half */}
        <div className="flex-1 min-w-0 hidden lg:block">
          <LiveSidebar />
        </div>
      </div>
    </div>
  );
}

function SettingsContent({ defaults, setDefaults, saving, saved, saveDefaults, t, selectCls }: {
  defaults: TranslatorDefaults;
  setDefaults: (d: TranslatorDefaults) => void;
  saving: boolean;
  saved: boolean;
  saveDefaults: () => void;
  t: (key: string) => string;
  selectCls: string;
}) {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h3 className="text-sm font-bold text-[var(--th-text)] mb-1">{t('translator.translationMode')}</h3>
        <p className="text-xs text-[var(--th-text-muted)] mb-3">{t('translator.modeDesc')}</p>
        <div className="flex flex-col md:flex-row gap-3">
          {[
            { value: 'bidirectional', label: t('translator.bidirectional'), desc: t('translator.bidirectionalDesc') },
            { value: 'unidirectional', label: t('translator.unidirectional'), desc: t('translator.unidirectionalDesc') },
          ].map(m => (
            <button key={m.value}
              onClick={() => setDefaults({ ...defaults, translation_mode: m.value })}
              className="flex-1 p-3 min-h-[44px] rounded-xl border text-left transition-all"
              style={defaults.translation_mode === m.value || (!defaults.translation_mode && m.value === 'bidirectional')
                ? { borderColor: 'var(--th-primary)', background: 'rgba(99,102,241,0.06)' }
                : { borderColor: 'var(--th-border)' }
              }>
              <div className="text-sm font-medium text-[var(--th-text)]">{m.label}</div>
              <div className="text-[11px] mt-1 text-[var(--th-text-muted)]">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('translator.myLanguage')}</label>
          <select value={defaults.my_language || 'ru'} onChange={e => setDefaults({ ...defaults, my_language: e.target.value })} className={selectCls + ' min-h-[44px]'}>
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('translator.targetLanguage')}</label>
          <select value={defaults.target_language || 'en'} onChange={e => setDefaults({ ...defaults, target_language: e.target.value })} className={selectCls + ' min-h-[44px]'}>
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('translator.greetingText')}</label>
        <textarea value={defaults.greeting_text || ''} onChange={e => setDefaults({ ...defaults, greeting_text: e.target.value })}
          placeholder={t('translator.greetingPlaceholder')}
          className={selectCls + ' min-h-[80px] resize-y'} rows={3} />
      </div>

      <div>
        <h3 className="text-sm font-bold text-[var(--th-text)] mb-1">{t('translator.tone')}</h3>
        <p className="text-xs text-[var(--th-text-muted)] mb-3">{t('translator.toneDesc')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {TONES.map(tone => (
            <button key={tone.value}
              onClick={() => setDefaults({ ...defaults, tone: tone.value })}
              className="p-3 min-h-[44px] rounded-xl border text-left transition-all"
              style={(defaults.tone || 'neutral') === tone.value
                ? { borderColor: 'var(--th-primary)', background: 'rgba(99,102,241,0.06)' }
                : { borderColor: 'var(--th-border)' }
              }>
              <div className="text-sm font-medium text-[var(--th-text)]">{tone.label}</div>
              <div className="text-[10px] mt-0.5 text-[var(--th-text-muted)]">{tone.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('translator.voice')}</label>
        <select value={defaults.tts_voice_id || 'eve'} onChange={e => setDefaults({ ...defaults, tts_voice_id: e.target.value })} className={selectCls + ' min-h-[44px]'}>
          <optgroup label="Female">
            {VOICES.filter(v => v.gender === 'Female').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </optgroup>
          <optgroup label="Male">
            {VOICES.filter(v => v.gender === 'Male').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </optgroup>
        </select>
      </div>

      <div>
        <h3 className="text-sm font-bold text-[var(--th-text)] mb-1">{t('translator.personalContext')}</h3>
        <p className="text-xs text-[var(--th-text-muted)] mb-3">{t('translator.personalContextDesc')}</p>
        <textarea value={defaults.personal_context || ''} onChange={e => setDefaults({ ...defaults, personal_context: e.target.value })}
          placeholder={"Name: John Smith (spell as \"John Smith\")\nDOB: March 15, 1990\nInsurance: Blue Cross, ID: XYZ123456\nPharmacy: CVS, 123 Main St, Austin TX\nAddress: 456 Oak Ave, Apt 2B, Austin TX 78701"}
          className={selectCls + ' min-h-[120px] resize-y font-mono text-xs'} rows={5} />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button onClick={saveDefaults} disabled={saving}
          className="px-6 py-3 md:py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 w-full md:w-auto min-h-[44px]"
          style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-primary-hover))' }}>
          {saving ? t('translator.saving') : t('translator.saveSettings')}
        </button>
        {saved && <span className="text-sm text-[var(--th-success-text)]">{t('translator.saved')}</span>}
      </div>
    </div>
  );
}
