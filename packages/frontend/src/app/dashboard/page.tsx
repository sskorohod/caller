'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useT, useI18n } from '@/lib/i18n';
import { useSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import { LANGUAGES, TTS_VOICES as VOICES } from '@/lib/constants';

interface TranslatorDefaults {
  greeting_text?: string;
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
  { value: 'neutral', label: 'Neutral' },
  { value: 'business', label: 'Business' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'medical', label: 'Medical' },
  { value: 'legal', label: 'Legal' },
  { value: 'intelligent', label: 'Intelligent' },
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get<{ phone_number: string | null }>('/translator/phone').then(r => setPhone(r.phone_number)).catch(() => {});
    api.get<{ balance_usd: number }>('/billing/balance').then(r => setBalance(r.balance_usd)).catch(() => {});
    api.get<UsageResp>('/translator/usage?period=30d').then(setUsage).catch(() => {});
    api.get<TranslatorDefaults>('/translator/defaults').then(d => { setDefaults({ my_language: 'ru', target_language: 'en', ...d }); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

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
  const minutes = balance != null ? Math.floor(balance / PRICE_PER_MIN) : null;

  return (
    <div className="space-y-3 md:space-y-4">
      {/* ── Header: number · balance · 30d stats ──────────────── */}
      <div className={`${card} relative overflow-hidden p-5 md:p-6`}>
        <div className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.3), transparent 70%)' }} />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 lg:gap-6">
          {/* Number (left) */}
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--th-text-muted)] mb-1.5">{tt('Your translator number', 'Ваш номер переводчика')}</div>
            {phone ? (
              <a href={`tel:${phone}`} className="text-2xl md:text-3xl font-extrabold tracking-wide" style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 12px rgba(139,92,246,0.4))' }}>{fmtPhone(phone)}</a>
            ) : <div className="text-2xl font-extrabold text-[var(--th-text-muted)]">—</div>}
            <p className="text-[11px] text-[var(--th-text-muted)] mt-1.5">{tt('Save it · call your contact · tap "Merge" to add the translator', 'Сохрани в контакты · позвони собеседнику · нажми «Объединить»')}</p>
          </div>
          {/* Stats opposite the phone (30d + balance) */}
          <div className="flex flex-wrap items-end gap-x-6 md:gap-x-8 gap-y-4 lg:shrink-0">
            {[
              { icon: 'call', label: tt('Sessions · 30d', 'Сессий · 30д'), value: usage ? String(usage.totals.calls) : '—' },
              { icon: 'schedule', label: tt('Minutes · 30d', 'Минут · 30д'), value: usage ? String(usage.totals.minutes) : '—' },
              { icon: 'payments', label: tt('Spent · 30d', 'Потрачено · 30д'), value: usage ? `$${usage.totals.cost.toFixed(2)}` : '—' },
            ].map(k => (
              <div key={k.label}>
                <div className="flex items-center gap-1.5 mb-1 text-[var(--th-text-muted)]">
                  <span className="material-symbols-outlined text-[16px]">{k.icon}</span>
                  <span className="text-[10px] md:text-[11px] font-medium uppercase tracking-wide whitespace-nowrap">{k.label}</span>
                </div>
                <div className="text-xl md:text-2xl font-extrabold tabular-nums text-[var(--th-text)] leading-none">{k.value}</div>
              </div>
            ))}
            {/* Balance */}
            <div className="lg:pl-6 lg:border-l lg:border-[var(--th-border)]">
              <div className="flex items-center gap-1.5 mb-1 text-[var(--th-text-muted)]">
                <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                <span className="text-[10px] md:text-[11px] font-medium uppercase tracking-wide whitespace-nowrap">{tt('Balance', 'Баланс')}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl md:text-2xl font-extrabold tabular-nums leading-none" style={{ color: balance != null && balance < 5 ? '#f59e0b' : 'var(--th-text)' }}>{balance != null ? `$${balance.toFixed(2)}` : '—'}</span>
                {minutes != null && <span className="text-[11px] text-[var(--th-text-muted)]">≈ {minutes} {tt('min', 'мин')}</span>}
                <button onClick={() => router.push('/dashboard/billing')} className="text-xs font-semibold text-[var(--th-primary)] hover:underline">{tt('Top up →', 'Пополнить →')}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Live | Settings ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
        {/* Live panel */}
        <div className={`${card} lg:col-span-6 flex flex-col min-h-[420px]`}>
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
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[60vh]">
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
        <div className={`${card} lg:col-span-6 p-4 md:p-5 space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--th-text)]">{t('translator.settings') || tt('Settings', 'Настройки')}</h3>
            {savedTick && <span className="text-[11px] font-medium text-[var(--th-success-text)]">✓ {tt('Saved', 'Сохранено')}</span>}
          </div>

          {/* Languages (translation direction) */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-1.5">{tt('Languages', 'Языки перевода')}</label>
            <div className="flex items-center gap-2">
              <select value={defaults.my_language || 'ru'} onChange={e => update({ my_language: e.target.value })} className={selectCls} disabled={!loaded}>
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <span className="material-symbols-outlined text-[var(--th-text-muted)] shrink-0">sync_alt</span>
              <select value={defaults.target_language || 'en'} onChange={e => update({ target_language: e.target.value })} className={selectCls} disabled={!loaded}>
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-1.5">{t('translator.translationMode')}</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: 'bidirectional', l: t('translator.bidirectional') }, { v: 'unidirectional', l: t('translator.unidirectional') }].map(m => {
                const on = (defaults.translation_mode || 'bidirectional') === m.v;
                return (
                  <button key={m.v} onClick={() => update({ translation_mode: m.v })}
                    className="px-2 py-2 rounded-xl border text-xs font-medium transition-all"
                    style={on ? { borderColor: 'var(--th-primary)', background: 'rgba(99,102,241,0.08)', color: 'var(--th-text)' } : { borderColor: 'var(--th-border)', color: 'var(--th-text-muted)' }}>
                    {m.l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-1.5">{t('translator.voice')}</label>
            <select value={defaults.tts_voice_id || 'eve'} onChange={e => update({ tts_voice_id: e.target.value })} className={selectCls}>
              <optgroup label="Female">{VOICES.filter(v => v.gender === 'Female').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</optgroup>
              <optgroup label="Male">{VOICES.filter(v => v.gender === 'Male').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</optgroup>
            </select>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-1.5">{t('translator.tone')}</label>
            <select value={defaults.tone || 'neutral'} onChange={e => update({ tone: e.target.value })} className={selectCls}>
              {TONES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </div>

          {/* Greeting */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-1.5">{t('translator.greetingText')}</label>
            <textarea value={defaults.greeting_text || ''} onChange={e => update({ greeting_text: e.target.value })} rows={2}
              placeholder={t('translator.greetingPlaceholder')} className={selectCls + ' resize-y'} />
          </div>

          {/* Personal context */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-1.5">{t('translator.personalContext')}</label>
            <textarea value={defaults.personal_context || ''} onChange={e => update({ personal_context: e.target.value })} rows={4}
              placeholder={tt('Name, DOB, insurance, address… helps pronounce names & numbers', 'Имя, дата рождения, страховка, адрес… для точных имён и цифр')}
              className={selectCls + ' resize-y font-mono text-xs'} />
          </div>
        </div>
      </div>
    </div>
  );
}
