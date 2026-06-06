'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { useSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import CollapsibleSection from '@/components/CollapsibleSection';
import TopUpModal from './_components/TopUpModal';
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
interface SessionRow { id: string; duration_seconds?: number; cost_usd?: string; status?: string; created_at?: string; is_training?: boolean }

const selectCls = "w-full px-3 py-2.5 rounded-xl border border-[var(--th-border)] bg-[var(--th-input)] text-[var(--th-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/30 focus:border-[var(--th-primary)] transition-all appearance-none min-h-[44px]";

export default function HomePage() {
  const { lang } = useI18n();
  const tt = (en: string, ru: string) => (lang === 'ru' ? ru : en);
  const { socket } = useSocket();

  // ── Phone, balance, defaults ──────────────────────────────────────
  const [phone, setPhone] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [topUp, setTopUp] = useState(false);
  const [defaults, setDefaults] = useState<TranslatorDefaults>({ my_language: 'ru', target_language: 'en' });
  const [saved, setSaved] = useState(false);
  const [savingAdv, setSavingAdv] = useState(false);

  useEffect(() => {
    api.get<{ phone_number: string | null }>('/translator/phone').then(r => setPhone(r.phone_number)).catch(() => {});
    api.get<{ balance_usd?: string | number }>('/billing/balance').then(r => { const b = Number(r?.balance_usd); if (!isNaN(b)) setBalance(b); }).catch(() => {});
    api.get<TranslatorDefaults>('/translator/defaults').then(d => setDefaults(prev => ({ ...prev, ...d }))).catch(() => {});
  }, []);

  const persist = useCallback(async (next: TranslatorDefaults) => {
    try {
      const updated = await api.put<TranslatorDefaults>('/translator/defaults', next);
      setDefaults(prev => ({ ...prev, ...updated }));
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch { /* ignore */ }
  }, []);

  // Languages: save immediately on change (the one essential setting)
  const setLang = (key: 'my_language' | 'target_language', value: string) => {
    const next = { ...defaults, [key]: value };
    setDefaults(next);
    persist(next);
  };

  const saveAdvanced = async () => { setSavingAdv(true); await persist(defaults); setSavingAdv(false); };

  // ── Live session ──────────────────────────────────────────────────
  const [liveCallId, setLiveCallId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<TranslationEntry[]>([]);
  const [liveInterim, setLiveInterim] = useState<{ original: string; translated: string } | null>(null);
  const [callEnded, setCallEnded] = useState(false);
  const liveEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ sessions: { call_id: string | null }[] }>('/translator/sessions/active')
      .then(r => { const c = r.sessions?.[0]?.call_id; if (c) { setLiveCallId(c); setCallEnded(false); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onNewCall = (data: { call_id: string; status: string }) => {
      if (data.status === 'in_progress' && data.call_id) {
        setLiveCallId(data.call_id); setLiveTranscript([]); setLiveInterim(null); setCallEnded(false);
      }
    };
    socket.on('call:status', onNewCall);
    return () => { socket.off('call:status', onNewCall); };
  }, [socket]);

  useEffect(() => {
    if (!socket || !liveCallId) return;
    if (!callEnded) { setLiveTranscript([]); setLiveInterim(null); }
    socket.emit('call:translate:join', { call_id: liveCallId });
    const onTranslation = (d: { call_id: string; speaker: string; original: string; translated: string; timestamp: string }) => {
      if (d.call_id !== liveCallId) return;
      setLiveTranscript(prev => [...prev, { speaker: d.speaker, original: d.original, translated: d.translated, timestamp: d.timestamp }]);
      setLiveInterim(null);
    };
    const onInterim = (d: { call_id: string; original: string; translated: string }) => {
      if (d.call_id !== liveCallId) return;
      setLiveInterim({ original: d.original || '', translated: d.translated || '' });
    };
    const onEnd = (d: { call_id: string; status: string }) => {
      if (d.call_id === liveCallId && (d.status === 'completed' || d.status === 'failed')) { setCallEnded(true); setLiveInterim(null); }
    };
    socket.on('call:translation', onTranslation);
    socket.on('call:translation:interim', onInterim);
    socket.on('call:status', onEnd);
    return () => {
      socket.emit('call:translate:leave', { call_id: liveCallId });
      socket.off('call:translation', onTranslation);
      socket.off('call:translation:interim', onInterim);
      socket.off('call:status', onEnd);
    };
  }, [socket, liveCallId, callEnded]);

  useEffect(() => { liveEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [liveTranscript, liveInterim]);

  // ── Recent sessions ───────────────────────────────────────────────
  const [recent, setRecent] = useState<SessionRow[]>([]);
  useEffect(() => {
    api.get<{ sessions: SessionRow[] }>('/translator/sessions?limit=10')
      .then(r => setRecent((r.sessions || []).filter(s => !s.is_training && s.status === 'completed').slice(0, 5)))
      .catch(() => {});
  }, []);

  const live = !!liveCallId && (liveTranscript.length > 0 || !!liveInterim || !callEnded);
  const lowBalance = balance != null && balance < 5;

  const fmtPhone = (p: string) => p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 ($1) $2-$3');

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Low balance banner */}
      {lowBalance && (
        <button onClick={() => setTopUp(true)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left"
          style={{ background: balance! < 1 ? 'rgba(239,68,68,0.1)' : 'rgba(217,119,6,0.1)', border: `1px solid ${balance! < 1 ? 'rgba(239,68,68,0.3)' : 'rgba(217,119,6,0.3)'}` }}>
          <span className="text-sm font-medium" style={{ color: balance! < 1 ? '#ef4444' : '#d97706' }}>
            {balance! < 1 ? tt('Balance too low — top up to keep translating', 'Баланс на нуле — пополни, чтобы переводить') : tt('Low balance', 'Низкий баланс')} (${balance!.toFixed(2)})
          </span>
          <span className="text-sm font-bold px-3 py-1 rounded-lg text-white shrink-0" style={{ background: 'var(--th-primary)' }}>{tt('Top up', 'Пополнить')}</span>
        </button>
      )}

      {/* Hero: number + how to call */}
      <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--th-text-muted)' }}>
          {tt('Your translator number', 'Твой номер переводчика')}
        </p>
        {phone ? (
          <a href={`tel:${phone}`} className="text-3xl sm:text-4xl font-extrabold tracking-wide block"
            style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed, #6d28d9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 14px rgba(139,92,246,0.45))' }}>
            {fmtPhone(phone)}
          </a>
        ) : (
          <p className="text-sm" style={{ color: 'var(--th-text-muted)' }}>{tt('No number assigned yet — contact support.', 'Номер ещё не назначен — напиши в поддержку.')}</p>
        )}
        <p className="text-sm mt-3 max-w-md mx-auto" style={{ color: 'var(--th-text-muted)' }}>
          {tt('Call this number, put both people on speakerphone — the AI translates live, both directions.',
              'Позвони на этот номер и включи громкую связь у обоих — AI переводит вживую в обе стороны.')}
        </p>
      </div>

      {/* Languages — the one essential setting */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold" style={{ color: 'var(--th-text)' }}>{tt('Languages', 'Языки')}</h2>
          {saved && <span className="text-xs" style={{ color: 'var(--th-success-text)' }}>{tt('Saved', 'Сохранено')}</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--th-text-muted)' }}>{tt('I speak', 'Я говорю на')}</label>
            <select value={defaults.my_language || 'ru'} onChange={e => setLang('my_language', e.target.value)} className={selectCls}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <span className="hidden sm:flex items-center justify-center pb-3 text-lg" style={{ color: 'var(--th-text-muted)' }}>⇄</span>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--th-text-muted)' }}>{tt('Translate to', 'Переводить на')}</label>
            <select value={defaults.target_language || 'en'} onChange={e => setLang('target_language', e.target.value)} className={selectCls}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* How it works — 3 steps */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)' }}>
        <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--th-text)' }}>{tt('How it works', 'Как это работает')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: 'call', t: tt('1. Call the number', '1. Позвони на номер'), d: tt('From any phone, any carrier.', 'С любого телефона и оператора.') },
            { icon: 'group', t: tt('2. Speakerphone', '2. Громкая связь'), d: tt('Both people near one phone.', 'Оба собеседника у одного телефона.') },
            { icon: 'translate', t: tt('3. Speak freely', '3. Говори свободно'), d: tt('AI translates both sides live.', 'AI переводит обе стороны вживую.') },
          ].map(s => (
            <div key={s.icon} className="text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 mx-auto sm:mx-0" style={{ background: 'rgba(99,102,241,0.1)' }}>
                <span className="material-symbols-outlined text-xl" style={{ color: 'var(--th-primary)' }}>{s.icon}</span>
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--th-text)' }}>{s.t}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--th-text-muted)' }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Live transcript — only while a session is active */}
      {live && (
        <div className="rounded-2xl flex flex-col" style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)', minHeight: 280 }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--th-border)' }}>
            <span className={`w-2.5 h-2.5 rounded-full ${callEnded ? 'bg-gray-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="text-sm font-bold" style={{ color: 'var(--th-text)' }}>{callEnded ? tt('Translation', 'Перевод') : tt('Live translation', 'Перевод вживую')}</span>
            {!callEnded && (
              <button onClick={() => { api.post(`/calls/${liveCallId}/hangup`, {}).catch(() => {}); }}
                className="ml-auto p-1.5 rounded-lg bg-red-500/15 border border-red-500/20 text-red-400" title={tt('End call', 'Завершить')}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.69 3.69L20.31 20.31M15.536 8.464a5 5 0 010 7.072" /></svg>
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[420px]">
            {liveTranscript.map((e, i) => {
              const you = e.speaker === 'subscriber';
              return (
                <div key={i} className={`flex ${you ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] rounded-2xl px-4 py-2.5" style={you ? { background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' } : { background: 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
                    <p className="text-[15px] font-semibold leading-relaxed" style={{ color: 'var(--th-text)' }}>{e.translated}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--th-text-muted)' }}>{e.original}</p>
                  </div>
                </div>
              );
            })}
            {liveInterim && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-2.5" style={{ background: 'var(--th-surface)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <p className="text-[15px] italic opacity-70" style={{ color: 'var(--th-text)' }}>{liveInterim.translated || '…'}</p>
                </div>
              </div>
            )}
            <div ref={liveEndRef} />
          </div>
        </div>
      )}

      {/* Advanced settings — collapsed */}
      <CollapsibleSection title={tt('Advanced settings', 'Расширенные настройки')} defaultOpen={false}>
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--th-text-muted)' }}>{tt('Voice', 'Голос')}</label>
            <select value={defaults.tts_voice_id || 'eve'} onChange={e => setDefaults({ ...defaults, tts_voice_id: e.target.value })} className={selectCls}>
              <optgroup label={tt('Female', 'Женские')}>{VOICES.filter(v => v.gender === 'Female').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</optgroup>
              <optgroup label={tt('Male', 'Мужские')}>{VOICES.filter(v => v.gender === 'Male').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</optgroup>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--th-text-muted)' }}>{tt('Mode', 'Режим')}</label>
            <div className="flex gap-2">
              {[{ v: 'bidirectional', l: tt('Both directions', 'Обе стороны') }, { v: 'unidirectional', l: tt('One direction', 'Одна сторона') }].map(m => (
                <button key={m.v} onClick={() => setDefaults({ ...defaults, translation_mode: m.v })} className="flex-1 px-3 py-2.5 rounded-xl text-sm border min-h-[44px]"
                  style={(defaults.translation_mode || 'bidirectional') === m.v ? { borderColor: 'var(--th-primary)', background: 'rgba(99,102,241,0.06)', color: 'var(--th-text)' } : { borderColor: 'var(--th-border)', color: 'var(--th-text-muted)' }}>{m.l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--th-text-muted)' }}>{tt('Greeting (optional)', 'Приветствие (необязательно)')}</label>
            <textarea value={defaults.greeting_text || ''} onChange={e => setDefaults({ ...defaults, greeting_text: e.target.value })} rows={2} className={selectCls + ' resize-y'} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--th-text-muted)' }}>{tt('Personal context (optional)', 'Личный контекст (необязательно)')}</label>
            <textarea value={defaults.personal_context || ''} onChange={e => setDefaults({ ...defaults, personal_context: e.target.value })} rows={4}
              placeholder={tt('Name, DOB, insurance, address… helps the AI spell names & numbers.', 'Имя, дата рождения, страховка, адрес… помогает AI точно произносить имена и цифры.')}
              className={selectCls + ' resize-y font-mono text-xs'} />
          </div>
          <button onClick={saveAdvanced} disabled={savingAdv}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 min-h-[44px]"
            style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-primary-hover))' }}>
            {savingAdv ? tt('Saving…', 'Сохраняю…') : tt('Save', 'Сохранить')}
          </button>
        </div>
      </CollapsibleSection>

      {/* Recent sessions */}
      {recent.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ color: 'var(--th-text)' }}>{tt('Recent sessions', 'Последние сессии')}</h2>
            <a href="/dashboard/calls" className="text-xs font-semibold" style={{ color: 'var(--th-primary)' }}>{tt('All', 'Все')} →</a>
          </div>
          <div className="space-y-1.5">
            {recent.map(s => {
              const secs = s.duration_seconds || 0;
              const mins = Math.floor(secs / 60), rem = secs % 60;
              return (
                <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--th-border)' }}>
                  <span className="text-sm" style={{ color: 'var(--th-text)' }}>{s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}</span>
                  <span className="text-sm" style={{ color: 'var(--th-text-muted)' }}>{mins}:{String(rem).padStart(2, '0')} · ${Number(s.cost_usd || 0).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <TopUpModal open={topUp} onClose={() => setTopUp(false)} />
    </div>
  );
}
