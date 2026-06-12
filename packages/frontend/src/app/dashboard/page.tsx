'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useT, useI18n } from '@/lib/i18n';
import { useSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import { LANGUAGES, TTS_VOICES as VOICES } from '@/lib/constants';

interface TranslatorDefaults {
  greeting_text?: string;
  greeting_delay_seconds?: number;
  tts_voice_id?: string;
  tone?: string;
  personal_context?: string;
  my_language?: string;
  target_language?: string;
  translation_mode?: string;
}
interface TranslationEntry { speaker: string; original: string; translated: string; timestamp: string }
interface UsageResp {
  totals: { calls: number; minutes: number; cost: number; avgCost: number; words: number };
  sessions: { id: string; call_id: string | null; created_at: string; duration_seconds: number; cost_usd: number; words: number }[];
}

const TONES = [
  { value: 'neutral',     label: { en: 'Neutral',     ru: 'Нейтральный' },      desc: { en: 'Natural translation, preserves original tone.',           ru: 'Естественный перевод, сохраняет исходный тон.' } },
  { value: 'business',    label: { en: 'Business',    ru: 'Деловой' },          desc: { en: 'Formal, professional. Removes filler words (um, uh).',     ru: 'Формально и профессионально. Убирает слова-паразиты.' } },
  { value: 'friendly',    label: { en: 'Friendly',    ru: 'Дружеский' },        desc: { en: 'Warm, casual, conversational.',                            ru: 'Тёплый, непринуждённый, разговорный.' } },
  { value: 'medical',     label: { en: 'Medical',     ru: 'Медицинский' },      desc: { en: 'Precise medical terminology.',                             ru: 'Точная медицинская терминология.' } },
  { value: 'legal',       label: { en: 'Legal',       ru: 'Юридический' },       desc: { en: 'Precise legal terminology, formal tone.',                  ru: 'Точная юридическая терминология, формальный тон.' } },
  { value: 'intelligent', label: { en: 'Intelligent', ru: 'Интеллектуальный' }, desc: { en: 'Rephrases speech to sound eloquent, polite, and well-spoken.', ru: 'Перефразирует речь, чтобы звучала красноречиво и вежливо.' } },
];

const card = 'rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]';
const selectCls = 'w-full px-3 py-2 rounded-xl border border-[var(--th-border)] bg-[var(--th-input)] text-[var(--th-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/30 focus:border-[var(--th-primary)] transition-all appearance-none';
const PRICE_PER_MIN = 0.2;

export default function DashboardHub() {
  const t = useT();
  const { lang } = useI18n();
  const tt = (en: string, ru: string) => (lang === 'ru' ? ru : en);
  const { socket } = useSocket();
  const router = useRouter();

  // ── Data ──────────────────────────────────────────────
  const [phone, setPhone] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [usage, setUsage] = useState<UsageResp | null>(null);
  const [defaults, setDefaults] = useState<TranslatorDefaults>({});
  const [loaded, setLoaded] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [lineBusy, setLineBusy] = useState<boolean | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get<{ phone_number: string | null }>('/translator/phone').then(r => setPhone(r.phone_number)).catch(() => {});
    api.get<{ balance_usd: number }>('/billing/balance').then(r => setBalance(r.balance_usd)).catch(() => {});
    api.get<UsageResp>('/translator/usage?period=30d').then(setUsage).catch(() => {});
    api.get<TranslatorDefaults>('/translator/defaults').then(d => { setDefaults({ my_language: 'ru', target_language: 'en', ...d }); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  // Shared translator line status (free / busy). `/translator/line-status`
  // counts active sessions platform-wide (incl. our own), so it is the single
  // source of truth for the badge.
  const refreshLineStatus = useCallback(() => {
    return api.get<{ busy: boolean }>('/translator/line-status')
      .then(r => setLineBusy(r.busy)).catch(() => {});
  }, []);

  // Fallback poll (covers other accounts + any missed socket event).
  useEffect(() => {
    refreshLineStatus();
    const iv = setInterval(refreshLineStatus, 8000);
    return () => clearInterval(iv);
  }, [refreshLineStatus]);

  // Debounced autosave on any setting change.
  const update = useCallback((patch: Partial<TranslatorDefaults>) => {
    setDefaults(prev => {
      const next = { ...prev, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        api.put('/translator/defaults', next).then(() => { setSavedTick(true); setTimeout(() => setSavedTick(false), 1500); }).catch(() => {});
      }, 700);
      return next;
    });
  }, []);

  // ── Live transcript ───────────────────────────────────
  const [liveCallId, setLiveCallId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<TranslationEntry[]>([]);
  const [liveInterim, setLiveInterim] = useState<{ original: string; translated: string } | null>(null);
  const [callEnded, setCallEnded] = useState(false);
  const liveEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ sessions: { id: string; call_id: string | null }[] }>('/translator/sessions/active').then(r => {
      if (r.sessions.length > 0 && r.sessions[0].call_id) { setLiveCallId(r.sessions[0].call_id); setCallEnded(false); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onNewCall = (d: { call_id: string; status: string }) => {
      if (d.status === 'in_progress' && d.call_id) { setLiveCallId(d.call_id); setLiveTranscript([]); setLiveInterim(null); setCallEnded(false); }
    };
    socket.on('call:status', onNewCall);
    return () => { socket.off('call:status', onNewCall); };
  }, [socket]);

  // Real-time line-status: refresh the badge the moment any call starts/ends.
  // (1.5s second pass guards against the DB finalize lagging the socket event.)
  useEffect(() => {
    if (!socket) return;
    const onStatus = () => { refreshLineStatus(); setTimeout(refreshLineStatus, 1500); };
    socket.on('call:status', onStatus);
    return () => { socket.off('call:status', onStatus); };
  }, [socket, refreshLineStatus]);

  useEffect(() => {
    if (!socket || !liveCallId) return;
    if (!callEnded) { setLiveTranscript([]); setLiveInterim(null); }
    socket.emit('call:translate:join', { call_id: liveCallId });
    const onTr = (d: { call_id: string; speaker: string; original: string; translated: string; timestamp: string }) => {
      if (d.call_id !== liveCallId) return;
      setLiveTranscript(prev => [...prev, { speaker: d.speaker, original: d.original, translated: d.translated, timestamp: d.timestamp }]);
      setLiveInterim(null);
    };
    const onInt = (d: { call_id: string; original: string; translated: string }) => {
      if (d.call_id !== liveCallId) return;
      setLiveInterim({ original: d.original || '', translated: d.translated || '' });
    };
    const onEnd = (d: { call_id: string; status: string }) => {
      if (d.call_id === liveCallId && (d.status === 'completed' || d.status === 'failed')) { setCallEnded(true); setLiveInterim(null); }
    };
    socket.on('call:translation', onTr);
    socket.on('call:translation:interim', onInt);
    socket.on('call:status', onEnd);
    return () => {
      socket.emit('call:translate:leave', { call_id: liveCallId });
      socket.off('call:translation', onTr);
      socket.off('call:translation:interim', onInt);
      socket.off('call:status', onEnd);
    };
  }, [socket, liveCallId, callEnded]);

  useEffect(() => { liveEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [liveTranscript, liveInterim]);

  const live = liveCallId && !callEnded;
  const fmtPhone = (p: string) => p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 ($1) $2-$3');
  const unlimited = balance != null && balance > 1000;
  const minutes = balance != null ? Math.floor(balance / PRICE_PER_MIN) : null;

  return (
    <div className="flex flex-col gap-3 md:gap-4 lg:h-[calc(100vh-2.5rem)]">
      {/* ── Header: number · balance · 30d stats ──────────────── */}
      <div className={`${card} relative overflow-hidden p-5 md:p-6 shrink-0`}>
        <div className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.3), transparent 70%)' }} />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 lg:gap-6">
          {/* Number (left) */}
          <div className="min-w-0">
            <div className="text-sm font-semibold uppercase tracking-wide text-[var(--th-text-muted)] mb-1">{tt("Your translator's phone number", 'Номер телефона вашего переводчика')}</div>
            <div className="flex items-center gap-3 flex-wrap">
              {phone ? (
                <a href={`tel:${phone}`} className="text-xl md:text-2xl font-extrabold tracking-wide text-[var(--th-text)]" style={{ filter: 'drop-shadow(0 1px 3px rgba(139,92,246,0.25))' }}>{fmtPhone(phone)}</a>
              ) : <div className="text-xl md:text-2xl font-extrabold text-[var(--th-text-muted)]">—</div>}
              {(() => {
                const busy = lineBusy === true;
                const loading = lineBusy === null;
                const color = loading ? 'var(--th-text-muted)' : busy ? '#ef4444' : '#22c55e';
                const bg = loading ? 'var(--th-surface)' : busy ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)';
                const label = loading ? tt('Checking…', 'Проверка…') : busy ? tt('Line busy', 'Линия занята') : tt('Line free', 'Линия свободна');
                return (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
                    style={{ background: bg, color }} title={busy ? tt('The translator line is in use right now', 'Линия переводчика сейчас занята') : tt('You can use the translator now', 'Можно пользоваться переводчиком')}>
                    <span className={`w-2 h-2 rounded-full ${busy ? 'animate-pulse' : ''}`} style={{ background: color, boxShadow: loading ? 'none' : `0 0 6px ${color}` }} />
                    {label}
                  </span>
                );
              })()}
            </div>
            <p className="text-xs md:text-[13px] text-[var(--th-text-muted)] mt-1.5 leading-snug">{tt('During a call, add this number and tap "Merge" to bring in the translator.', 'Во время разговора добавьте этот номер и нажмите «Объединить», чтобы подключить переводчика.')}</p>
          </div>
          {/* Stats opposite the phone (30d KPI cards + balance card) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-stretch gap-2.5 md:gap-3 lg:shrink-0">
            {[
              { icon: 'call', accent: '99,102,241', label: tt('Sessions · 30d', 'Сессий · 30д'), value: usage ? String(usage.totals.calls) : '—' },
              { icon: 'schedule', accent: '14,165,233', label: tt('Minutes · 30d', 'Минут · 30д'), value: usage ? String(usage.totals.minutes) : '—' },
              { icon: 'payments', accent: '139,92,246', label: tt('Spent · 30d', 'Потрачено · 30д'), value: usage ? `$${usage.totals.cost.toFixed(2)}` : '—' },
            ].map(k => (
              <div key={k.label}
                className="group relative flex flex-col gap-2.5 rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface)]/60 px-3.5 py-3 lg:min-w-[112px] transition-all hover:-translate-y-0.5 hover:border-[var(--th-border)] hover:shadow-[0_6px_20px_var(--th-shadow)]"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-60" style={{ background: `linear-gradient(90deg, transparent, rgba(${k.accent},0.5), transparent)` }} />
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: `rgba(${k.accent},0.12)`, color: `rgb(${k.accent})` }}>
                    <span className="material-symbols-outlined text-[16px]">{k.icon}</span>
                  </span>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-extrabold tabular-nums text-[var(--th-text)] leading-none">{k.value}</div>
                  <div className="text-[10px] md:text-[11px] font-medium uppercase tracking-wide text-[var(--th-text-muted)] mt-1.5 whitespace-nowrap">{k.label}</div>
                </div>
              </div>
            ))}
            {/* Balance — emphasized card */}
            <div className="group relative col-span-2 sm:col-span-3 lg:col-span-1 flex flex-col gap-2.5 rounded-2xl border px-3.5 py-3 lg:min-w-[200px] transition-all hover:-translate-y-0.5"
              style={{ borderColor: 'rgba(16,185,129,0.30)', background: 'linear-gradient(160deg, rgba(16,185,129,0.10), rgba(16,185,129,0.02))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
              <span aria-hidden className="absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-70" style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.6), transparent)' }} />
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                  <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                </span>
                <span className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#10b981' }}>{tt('Balance', 'Баланс')}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                {unlimited ? (
                  <span className="text-xl md:text-2xl font-extrabold leading-none text-[var(--th-text)]">{tt('Unlimited', 'Безлимит')}</span>
                ) : (
                  <>
                    <span className="text-xl md:text-2xl font-extrabold tabular-nums leading-none" style={{ color: balance != null && balance < 5 ? '#f59e0b' : 'var(--th-text)' }}>{balance != null ? `$${balance.toFixed(2)}` : '—'}</span>
                    {minutes != null && (
                      <span className="text-sm md:text-base font-bold tabular-nums leading-none text-[var(--th-text-muted)]">≈{minutes}<span className="text-[11px] font-medium ml-0.5">{tt('min', 'мин')}</span></span>
                    )}
                  </>
                )}
              </div>
              <button onClick={() => router.push('/dashboard/billing')}
                className="mt-0.5 inline-flex items-center justify-center gap-1 w-full px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                style={{ background: 'var(--th-primary)' }}>
                {tt('Top up balance', 'Пополнить баланс')} <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Live | Settings ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 lg:flex-1 lg:min-h-0">
        {/* Live panel */}
        <div className={`${card} lg:col-span-6 flex flex-col min-h-[420px] lg:min-h-0`}>
          <div className="px-4 py-3 border-b border-[var(--th-border)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${live ? 'bg-emerald-400 animate-pulse' : 'bg-[var(--th-text-muted)]'}`} />
              <span className="text-sm font-bold text-[var(--th-text)]">{live ? t('translator.liveTranslation') : t('translator.translation')}</span>
            </div>
            {live && (
              <button onClick={() => api.post(`/calls/${liveCallId}/hangup`, {}).catch(() => {})}
                className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-400 transition-all" title={tt('End call', 'Завершить')}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414M2.757 18.364a9 9 0 001.414 1.414M3.69 3.69L20.31 20.31" /></svg>
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {!liveCallId ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-8">
                <div className="w-14 h-14 rounded-2xl bg-[var(--th-surface)] flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-3xl text-[var(--th-text-muted)]">graphic_eq</span>
                </div>
                <p className="text-sm font-semibold text-[var(--th-text)]">{tt('Ready to translate', 'Готов к переводу')}</p>
                <p className="text-[12px] text-[var(--th-text-muted)] mt-1 max-w-xs leading-relaxed">
                  {tt('Call your contact, ask them to hold, add a call to the number above, then tap "Merge". The live transcript appears here.',
                      'Позвони собеседнику, попроси подождать, добавь звонок на номер выше и нажми «Объединить». Перевод появится здесь.')}
                </p>
              </div>
            ) : (
              <>
                {liveTranscript.map((e, i) => {
                  const you = e.speaker === 'subscriber';
                  return (
                    <div key={i} className={`flex ${you ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${you ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/20' : 'bg-[var(--th-surface)] border border-[var(--th-border)]'}`}>
                        <p className="text-[15px] font-semibold leading-relaxed text-[var(--th-text)]">{e.translated}</p>
                        <p className="text-[12px] mt-1.5 text-[var(--th-text-muted)] leading-snug">{e.original}</p>
                      </div>
                    </div>
                  );
                })}
                {liveInterim && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[var(--th-surface)] border border-amber-500/20">
                      {liveInterim.translated
                        ? <p className="text-[15px] font-semibold text-[var(--th-text)]">{liveInterim.translated}<span className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 animate-pulse" /></p>
                        : <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse [animation-delay:150ms]" /><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse [animation-delay:300ms]" /></div>}
                    </div>
                  </div>
                )}
                <div ref={liveEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Settings panel (compact, all visible, autosave) */}
        <div className={`${card} lg:col-span-6 p-4 md:p-5 space-y-4 lg:overflow-y-auto lg:min-h-0`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--th-text)]">{t('translator.settings') || tt('Settings', 'Настройки')}</h3>
            {savedTick && <span className="text-[11px] font-medium text-[var(--th-success-text)]">✓ {tt('Saved', 'Сохранено')}</span>}
          </div>

          {/* How-to instruction */}
          <div className="rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[16px] text-[var(--th-primary)]">info</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--th-text-muted)]">{tt('How to use', 'Как пользоваться')}</span>
            </div>
            <ol className="space-y-1.5">
              {[
                tt('Save the translator number to your phone contacts.',
                   'Сохраните номер переводчика в контакты телефона.'),
                tt('During a call, say: "Hold on, I’ll connect my interpreter" — and add a call to the translator number.',
                   'Во время разговора скажите: «Подождите, я подключу переводчика» — и добавьте звонок на номер переводчика.'),
                tt('Tap "Merge calls" on your phone screen — the calls will join.',
                   'Нажмите «Объединить» на экране телефона — звонки соединятся.'),
                tt('A moment later the AI interpreter introduces itself and starts translating. When you finish, just hang up.',
                   'Через секунду AI-переводчик представится и начнёт переводить. По окончании просто завершите звонок.'),
              ].map((step, i) => (
                <li key={i} className="flex gap-2 text-[12px] leading-snug text-[var(--th-text-secondary)]">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-[var(--th-primary-bg)] text-[var(--th-primary)] text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Languages (translation direction) */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-1.5">{tt('Languages', 'Языки перевода')}</label>
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-[var(--th-text-muted)] mb-1">{t('translator.myLanguage')}</div>
                <select value={defaults.my_language || 'ru'} onChange={e => update({ my_language: e.target.value })} className={selectCls} disabled={!loaded}>
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <span className="material-symbols-outlined text-[var(--th-text-muted)] shrink-0 pb-2.5">sync_alt</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-[var(--th-text-muted)] mb-1">{t('translator.targetLanguage')}</div>
                <select value={defaults.target_language || 'en'} onChange={e => update({ target_language: e.target.value })} className={selectCls} disabled={!loaded}>
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-1.5">{t('translator.translationMode')}</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 'bidirectional', l: t('translator.bidirectional'), d: t('translator.bidirectionalDesc') },
                { v: 'unidirectional', l: t('translator.unidirectional'), d: t('translator.unidirectionalDesc') },
              ].map(m => {
                const on = (defaults.translation_mode || 'bidirectional') === m.v;
                return (
                  <button key={m.v} onClick={() => update({ translation_mode: m.v })}
                    className="p-2.5 rounded-xl border text-left transition-all"
                    style={on ? { borderColor: 'var(--th-primary)', background: 'rgba(99,102,241,0.08)' } : { borderColor: 'var(--th-border)' }}>
                    <div className="text-xs font-medium" style={{ color: on ? 'var(--th-text)' : 'var(--th-text-muted)' }}>{m.l}</div>
                    <div className="text-[10px] mt-1 leading-snug text-[var(--th-text-muted)]">{m.d}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice — female voices outlined pink, male voices blue */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-1.5">{t('translator.voice')}</label>
            <div className="grid grid-cols-3 gap-2">
              {VOICES.map(v => {
                const on = (defaults.tts_voice_id || 'eve') === v.value;
                const accent = v.gender === 'Female' ? '244,114,182' : '96,165,250'; // pink-400 / blue-400
                return (
                  <button key={v.value} onClick={() => update({ tts_voice_id: v.value })}
                    className="px-2 py-2 rounded-xl border text-xs font-medium transition-all"
                    style={on
                      ? { borderColor: `rgb(${accent})`, background: `rgba(${accent},0.12)`, color: 'var(--th-text)', boxShadow: `0 0 0 1px rgb(${accent})` }
                      : { borderColor: `rgba(${accent},0.4)`, color: 'var(--th-text-muted)' }}>
                    {v.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-[10px] text-[var(--th-text-muted)]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'rgb(96,165,250)' }} />
                {tt('Male voices', 'Мужские голоса')}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-[var(--th-text-muted)]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'rgb(244,114,182)' }} />
                {tt('Female voices', 'Женские голоса')}
              </span>
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-1.5">{t('translator.tone')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TONES.map(x => {
                const on = (defaults.tone || 'neutral') === x.value;
                return (
                  <button key={x.value} onClick={() => update({ tone: x.value })}
                    className="p-2.5 rounded-xl border text-left transition-all"
                    style={on
                      ? { borderColor: 'var(--th-primary)', background: 'rgba(99,102,241,0.08)' }
                      : { borderColor: 'var(--th-border)' }}>
                    <div className="text-sm font-medium text-[var(--th-text)]">{tt(x.label.en, x.label.ru)}</div>
                    <div className="text-[10px] mt-0.5 leading-snug text-[var(--th-text-muted)]">{tt(x.desc.en, x.desc.ru)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Greeting */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">{t('translator.greetingText')}</label>
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--th-text-muted)]">
                {tt('Speak after', 'Прозвучит через')}
                <input type="number" min={0} max={30} disabled={!loaded}
                  value={defaults.greeting_delay_seconds ?? 3}
                  onChange={e => update({ greeting_delay_seconds: Math.min(30, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                  className="w-14 px-2 py-1 rounded-lg border border-[var(--th-border)] bg-[var(--th-input)] text-[var(--th-text)] text-xs text-center focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/30 focus:border-[var(--th-primary)]" />
                {tt('sec', 'сек')}
              </span>
            </div>
            <textarea value={defaults.greeting_text || ''} onChange={e => update({ greeting_text: e.target.value })} rows={2}
              placeholder={t('translator.greetingPlaceholder')} className={selectCls + ' resize-y'} />
            <p className="text-[10px] mt-1 leading-snug text-[var(--th-text-muted)]">
              {tt('Write it in any language — it is automatically translated into the other party’s language and spoken after the chosen delay. Translation starts right after.',
                  'Пишите на любом языке — приветствие автоматически переведётся на язык собеседника и прозвучит через указанное время после подключения. Сразу после него начнётся перевод.')}
            </p>
          </div>

          {/* Personal context — temporarily hidden (owner request 2026-06-10);
              the backend field and autosave still work, restore by uncommenting. */}
          {false && (
          <div>
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-1.5">{t('translator.personalContext')}</label>
            <textarea value={defaults.personal_context || ''} onChange={e => update({ personal_context: e.target.value })} rows={4}
              placeholder={tt('Name, DOB, insurance, address… helps pronounce names & numbers', 'Имя, дата рождения, страховка, адрес… для точных имён и цифр')}
              className={selectCls + ' resize-y font-mono text-xs'} />
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
