'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-context';
import { LANGUAGES } from '@/lib/constants';
import { useSandboxAudio, type SandboxMode } from '@/lib/use-sandbox-audio';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SandboxPage() {
  const { lang: uiLang } = useI18n();
  const { token } = useAuth();
  const tt = (en: string, ru: string) => (uiLang === 'ru' ? ru : en);

  const { status, lines, liveLine, remainingSeconds, error, start, stop } = useSandboxAudio();
  const [mode, setMode] = useState<SandboxMode>('echo');
  const [practiceLang, setPracticeLang] = useState('ru');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isLive = status === 'live' || status === 'connecting';

  useEffect(() => { if (remainingSeconds != null) setSecondsLeft(remainingSeconds); }, [remainingSeconds]);

  useEffect(() => {
    if (status !== 'live') return;
    const id = setInterval(() => setSecondsLeft(p => (p == null ? p : Math.max(0, p - 1))), 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines, liveLine]);

  // Stop the session if the user navigates away.
  useEffect(() => () => stop(), [stop]);

  const modes: { id: SandboxMode; label: string; desc: string; icon: string }[] = [
    { id: 'echo', label: tt('Echo', 'Эхо'), desc: tt('Say a phrase — hear the translation and a readback', 'Скажи фразу — услышь перевод и проверку'), icon: 'repeat' },
    { id: 'simulation', label: tt('Simulation', 'Симуляция'), desc: tt('Practice a real call with a US bank or hospital', 'Тренируй звонок в банк или госпиталь США'), icon: 'support_agent' },
    { id: 'support', label: tt('Help', 'Поддержка'), desc: tt('Ask how the service works', 'Спроси, как работает сервис'), icon: 'help' },
  ];

  const showLimit = status === 'limit';

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--th-text)' }}>
          {tt('AI Trainer', 'AI-тренажёр')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--th-text-muted)' }}>
          {tt('Practice phone calls and translation safely before a real call. Free — no minutes are charged.',
              'Безопасно потренируй звонки и перевод перед реальным разговором. Бесплатно — минуты не списываются.')}
        </p>
      </div>

      <div className="rounded-2xl p-5 sm:p-6" style={{ background: 'var(--th-card)', border: '1px solid var(--th-border)' }}>
        {/* Mode tabs */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {modes.map(m => {
            const active = mode === m.id;
            return (
              <button key={m.id} onClick={() => !isLive && setMode(m.id)} disabled={isLive}
                className="rounded-xl p-3 text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: active ? 'var(--th-success-bg, rgba(99,102,241,0.1))' : 'transparent',
                  border: `1px solid ${active ? 'var(--th-primary)' : 'var(--th-border)'}`,
                }}>
                <span className="material-symbols-outlined text-lg" style={{ color: active ? 'var(--th-primary)' : 'var(--th-text-muted)' }}>{m.icon}</span>
                <div className="text-sm font-semibold mt-1" style={{ color: 'var(--th-text)' }}>{m.label}</div>
                <div className="text-[11px] leading-snug mt-0.5 hidden sm:block" style={{ color: 'var(--th-text-muted)' }}>{m.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Language + steps */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--th-text-muted)' }}>
            {tt('Your language', 'Твой язык')}
            <select value={practiceLang} onChange={e => setPracticeLang(e.target.value)} disabled={isLive}
              className="rounded-lg px-2 py-1.5 text-sm disabled:opacity-60"
              style={{ background: 'var(--th-page)', border: '1px solid var(--th-border)', color: 'var(--th-text)' }}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--th-text-muted)' }}>
            <span className="flex items-center gap-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold" style={{ background: 'var(--th-primary)', color: '#fff' }}>1</span>
              {tt('Allow mic', 'Разреши микрофон')}
            </span>
            <span className="material-symbols-outlined text-sm opacity-40">arrow_forward</span>
            <span className="flex items-center gap-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold" style={{ background: 'var(--th-primary)', color: '#fff' }}>2</span>
              {tt('Talk', 'Говори')}
            </span>
          </div>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="rounded-xl p-4 mb-4 overflow-y-auto"
          style={{ background: 'var(--th-page)', border: '1px solid var(--th-border)', height: 240 }}>
          {lines.length === 0 && !liveLine && (
            <div className="h-full flex items-center justify-center text-center text-xs" style={{ color: 'var(--th-text-muted)' }}>
              {status === 'connecting'
                ? tt('Connecting…', 'Подключение…')
                : tt('Your conversation will appear here', 'Здесь появится ваш разговор')}
            </div>
          )}
          {lines.map((l, i) => (
            <div key={i} className={`mb-2.5 flex ${l.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm leading-snug"
                style={l.role === 'user'
                  ? { background: 'var(--th-primary)', color: '#fff' }
                  : { background: 'var(--th-card)', color: 'var(--th-text)', border: '1px solid var(--th-border)' }}>
                {l.text}
              </div>
            </div>
          ))}
          {liveLine && (
            <div className={`mb-2.5 flex ${liveLine.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm leading-snug italic opacity-70"
                style={liveLine.role === 'user'
                  ? { background: 'var(--th-primary)', color: '#fff' }
                  : { background: 'var(--th-card)', color: 'var(--th-text)', border: '1px solid var(--th-border)' }}>
                {liveLine.text}
              </div>
            </div>
          )}
        </div>

        {showLimit && (
          <div className="rounded-xl p-3 mb-4 text-center text-sm" style={{ background: 'var(--th-success-bg, rgba(99,102,241,0.08))', color: 'var(--th-text)', border: '1px solid var(--th-border)' }}>
            {tt('Daily training time is up. Come back tomorrow, or make a real call.',
                'Тренировочное время на сегодня закончилось. Возвращайся завтра или сделай реальный звонок.')}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {!isLive && (
            <button onClick={() => token && start(mode, practiceLang, token)} disabled={!token}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-base font-bold transition-all active:scale-[.97] disabled:opacity-50"
              style={{ background: 'var(--th-primary)', color: '#fff' }}>
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
              {status === 'ended' || status === 'error' || status === 'limit'
                ? tt('Start again', 'Начать снова')
                : tt('Start talking', 'Начать разговор')}
            </button>
          )}
          {isLive && (
            <button onClick={stop} disabled={status === 'connecting'}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-base font-bold transition-all active:scale-[.97] disabled:opacity-70"
              style={{ background: 'rgba(248,113,113,0.15)', color: '#ef4444', border: '1px solid rgba(248,113,113,0.3)' }}>
              {status === 'connecting' ? (
                <>
                  <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                  {tt('Connecting…', 'Подключение…')}
                </>
              ) : (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#ef4444' }} />
                    <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: '#ef4444' }} />
                  </span>
                  {tt('Stop', 'Завершить')}
                </>
              )}
            </button>
          )}

          {secondsLeft != null && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-mono"
              style={{ background: 'var(--th-page)', border: '1px solid var(--th-border)', color: secondsLeft <= 30 ? '#d97706' : 'var(--th-text-muted)' }}>
              <span className="material-symbols-outlined text-base">timer</span>
              {fmt(secondsLeft)}
            </div>
          )}
        </div>

        {status === 'denied' && (
          <p className="text-center text-xs mt-3" style={{ color: '#ef4444' }}>
            {tt('Microphone access was denied. Allow it in your browser and try again.',
                'Доступ к микрофону запрещён. Разреши его в браузере и попробуй снова.')}
          </p>
        )}
        {status === 'error' && error && (
          <p className="text-center text-xs mt-3" style={{ color: '#ef4444' }}>{error}</p>
        )}
        <p className="text-center text-[11px] mt-3" style={{ color: 'var(--th-text-muted)' }}>
          {tt('Tip: use headphones to avoid echo.', 'Совет: надень наушники, чтобы не было эха.')}
        </p>
      </div>
    </div>
  );
}
