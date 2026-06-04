'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLang } from './useLang';
import { useSandboxAudio, type SandboxMode } from '@/lib/use-sandbox-audio';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrySandboxWidget() {
  const { t, lang } = useLang();
  const { status, lines, liveLine, remainingSeconds, error, start, stop } = useSandboxAudio();
  const [mode, setMode] = useState<SandboxMode>('echo');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isLive = status === 'live' || status === 'connecting';

  // Sync countdown from the server-provided daily budget.
  useEffect(() => {
    if (remainingSeconds != null) setSecondsLeft(remainingSeconds);
  }, [remainingSeconds]);

  // Tick down while live.
  useEffect(() => {
    if (status !== 'live') return;
    const id = setInterval(() => {
      setSecondsLeft(prev => (prev == null ? prev : Math.max(0, prev - 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // Auto-scroll transcript.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines, liveLine]);

  const modes: { id: SandboxMode; label: string; desc: string; icon: string }[] = [
    { id: 'echo', label: t('Echo', 'Эхо'), desc: t('Say a phrase — hear the translation and a readback', 'Скажи фразу — услышь перевод и проверку'), icon: 'repeat' },
    { id: 'simulation', label: t('Simulation', 'Симуляция'), desc: t('Practice a real call with a US bank or hospital', 'Тренируй звонок в банк или госпиталь США'), icon: 'support_agent' },
    { id: 'support', label: t('Help', 'Поддержка'), desc: t('Ask how the service works', 'Спроси, как работает сервис'), icon: 'help' },
  ];

  const showCta = status === 'limit' || status === 'ended';

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 relative overflow-hidden">
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
            {t('Try it now — free, no sign-up', 'Попробуй прямо сейчас — бесплатно, без регистрации')}
          </div>
          <h2 className="text-2xl sm:text-4xl font-headline font-extrabold tracking-tight mb-3">
            {t('Talk to the AI right here', 'Поговори с AI прямо здесь')}
          </h2>
          <p className="text-sm sm:text-base max-w-xl mx-auto" style={{ color: '#a0a8c0' }}>
            {t('Hear the premium voice and instant translation from your browser. No phone call needed.',
               'Услышь премиальный голос и мгновенный перевод прямо из браузера. Без телефонного звонка.')}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-5 sm:p-7 relative"
          style={{ background: 'rgba(22,28,40,0.7)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>

          {/* Mode tabs */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {modes.map(m => {
              const active = mode === m.id;
              return (
                <button key={m.id} onClick={() => !isLive && setMode(m.id)} disabled={isLive}
                  className="rounded-xl p-3 text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: active ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? 'rgba(129,140,248,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                  <span className="material-symbols-outlined text-lg" style={{ color: active ? '#818cf8' : '#a0a8c0' }}>{m.icon}</span>
                  <div className="text-sm font-semibold mt-1" style={{ color: active ? '#fff' : '#c2c6d6' }}>{m.label}</div>
                  <div className="text-[11px] leading-snug mt-0.5 hidden sm:block" style={{ color: 'rgba(160,168,192,0.65)' }}>{m.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Steps */}
          <div className="flex items-center justify-center gap-4 sm:gap-8 mb-5 text-xs sm:text-sm" style={{ color: '#a0a8c0' }}>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}>1</span>
              {t('Allow microphone', 'Разреши микрофон')}
            </div>
            <span className="material-symbols-outlined text-base opacity-40">arrow_forward</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}>2</span>
              {t('Talk to the AI', 'Говори с AI')}
            </div>
          </div>

          {/* Transcript */}
          <div ref={scrollRef} className="rounded-xl p-4 mb-4 overflow-y-auto"
            style={{ background: 'rgba(13,17,26,0.6)', border: '1px solid rgba(255,255,255,0.05)', height: 200 }}>
            {lines.length === 0 && !liveLine && (
              <div className="h-full flex items-center justify-center text-center text-xs" style={{ color: 'rgba(160,168,192,0.4)' }}>
                {status === 'connecting'
                  ? t('Connecting…', 'Подключение…')
                  : t('Your conversation will appear here', 'Здесь появится ваш разговор')}
              </div>
            )}
            {lines.map((l, i) => (
              <div key={i} className={`mb-2.5 flex ${l.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm leading-snug"
                  style={l.role === 'user'
                    ? { background: 'rgba(74,222,128,0.1)', color: '#d7f5e1', border: '1px solid rgba(74,222,128,0.15)' }
                    : { background: 'rgba(129,140,248,0.1)', color: '#dfe3f5', border: '1px solid rgba(129,140,248,0.15)' }}>
                  {l.text}
                </div>
              </div>
            ))}
            {liveLine && (
              <div className={`mb-2.5 flex ${liveLine.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm leading-snug italic opacity-70"
                  style={liveLine.role === 'user'
                    ? { background: 'rgba(74,222,128,0.07)', color: '#d7f5e1' }
                    : { background: 'rgba(129,140,248,0.07)', color: '#dfe3f5' }}>
                  {liveLine.text}
                </div>
              </div>
            )}
          </div>

          {/* CTA after limit/ended */}
          {showCta && (
            <div className="rounded-xl p-4 mb-4 text-center" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <div className="text-sm font-semibold mb-1" style={{ color: '#4ade80' }}>
                {status === 'limit'
                  ? t('Training time is up for today', 'Тренировочное время на сегодня закончилось')
                  : t('Nice! Ready for a real call?', 'Отлично! Готов к реальному звонку?')}
              </div>
              <div className="text-xs mb-3" style={{ color: '#a0a8c0' }}>
                {t('You already have $2 of free credit on your balance for real calls.',
                   'У тебя уже есть $2 на балансе для реальных звонков.')}
              </div>
              <Link href="/login?mode=register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', color: '#fff' }}>
                {t('Start free', 'Начать бесплатно')}
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            {!isLive && status !== 'limit' && (
              <button onClick={() => start(mode, lang)}
                className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-base font-bold transition-all active:scale-[.97] cta-glow"
                style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', color: '#fff' }}>
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                {status === 'ended' || status === 'error' ? t('Start again', 'Начать снова') : t('Start talking', 'Начать разговор')}
              </button>
            )}
            {isLive && (
              <button onClick={stop} disabled={status === 'connecting'}
                className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-base font-bold transition-all active:scale-[.97] disabled:opacity-70"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                {status === 'connecting' ? (
                  <>
                    <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                    {t('Connecting…', 'Подключение…')}
                  </>
                ) : (
                  <>
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#f87171' }} />
                      <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: '#f87171' }} />
                    </span>
                    {t('Stop', 'Завершить')}
                  </>
                )}
              </button>
            )}

            {/* Training-time indicator */}
            {secondsLeft != null && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-mono"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: secondsLeft <= 30 ? '#fbbf24' : '#a0a8c0' }}>
                <span className="material-symbols-outlined text-base">timer</span>
                {fmt(secondsLeft)}
              </div>
            )}
          </div>

          {status === 'denied' && (
            <p className="text-center text-xs mt-3" style={{ color: '#f87171' }}>
              {t('Microphone access was denied. Please allow it and try again.',
                 'Доступ к микрофону запрещён. Разреши его и попробуй снова.')}
            </p>
          )}
          {status === 'error' && error && (
            <p className="text-center text-xs mt-3" style={{ color: '#f87171' }}>{error}</p>
          )}
        </div>
      </div>
    </section>
  );
}
