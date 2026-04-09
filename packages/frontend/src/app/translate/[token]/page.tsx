'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { io as socketIO, Socket } from 'socket.io-client';

interface TranslationEntry {
  speaker: string;
  original: string;
  translated: string;
  timestamp: string;
}

type Mode = 'bidirectional' | 'unidirectional';

const LANGUAGES = [
  { value: 'en', label: 'EN' },
  { value: 'ru', label: 'RU' },
  { value: 'es', label: 'ES' },
  { value: 'de', label: 'DE' },
  { value: 'fr', label: 'FR' },
];

const VOICES = [
  { value: 'ara', label: 'Ara', gender: 'F' },
  { value: 'eve', label: 'Eve', gender: 'F' },
  { value: 'rex', label: 'Rex', gender: 'M' },
  { value: 'sal', label: 'Sal', gender: 'M' },
  { value: 'leo', label: 'Leo', gender: 'M' },
];

const TONES = [
  { value: 'neutral', label: 'Neutral', icon: '🔄' },
  { value: 'business', label: 'Business', icon: '💼' },
  { value: 'friendly', label: 'Friendly', icon: '😊' },
  { value: 'medical', label: 'Medical', icon: '🏥' },
  { value: 'legal', label: 'Legal', icon: '⚖️' },
  { value: 'intelligent', label: 'Intelligent', icon: '🎩' },
];

export default function LiveTranslatePage() {
  const params = useParams();
  const token = params.token as string;

  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [interimOriginal, setInterimOriginal] = useState<string>('');
  const [interimTranslated, setInterimTranslated] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState<'connecting' | 'live' | 'ended' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [cost, setCost] = useState(0);
  const [mode, setMode] = useState<Mode>('bidirectional');
  const [voice, setVoice] = useState('eve');
  const [tone, setTone] = useState('business');
  const [myLang, setMyLang] = useState('ru');
  const [targetLang, setTargetLang] = useState('en');
  const [callId, setCallId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [showToneMenu, setShowToneMenu] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) { setError('Missing token'); setStatus('error'); return; }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const s = socketIO(wsUrl, {
      path: '/socket.io',
      auth: { shareToken: token },
      transports: ['polling', 'websocket'],
    });
    socketRef.current = s;

    s.on('connect', () => {
      s.emit('call:translate:join:token', { token });
      setStatus('live');
    });

    s.on('connect_error', () => {
      setError('Connection failed');
      setStatus('error');
    });

    s.on('call:translation', (data: TranslationEntry & { call_id?: string }) => {
      if (data.call_id) setCallId(data.call_id);
      setTranslations(prev => [...prev, data]);
      setInterimOriginal('');
      setInterimTranslated('');
      setIsSpeaking(false);
    });

    s.on('call:translation:interim', (data: { original: string; translated: string; call_id?: string }) => {
      if (data.call_id) setCallId(data.call_id);
      setInterimOriginal(data.original || '');
      setInterimTranslated(data.translated || '');
    });

    s.on('call:transcript', (data: { text: string; isFinal: boolean; call_id?: string }) => {
      if (data.call_id) setCallId(data.call_id);
      if (!data.isFinal) {
        setIsSpeaking(true);
        if (data.text) setInterimOriginal(data.text);
      } else {
        setIsSpeaking(false);
      }
    });

    s.on('translator:stats', (data: { duration_seconds: number; cost_usd: number }) => {
      setDuration(data.duration_seconds);
      setCost(data.cost_usd);
    });

    s.on('call:status', (data: { status: string }) => {
      if (data.status === 'completed' || data.status === 'failed') {
        setStatus('ended');
      }
    });

    return () => { s.disconnect(); };
  }, [token]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [translations, interimTranslated, isSpeaking]);

  // Controls
  const changeMode = useCallback((m: Mode) => {
    setMode(m);
    if (socketRef.current && callId) {
      socketRef.current.emit('translator:set-mode', { call_id: callId, mode: m });
    }
  }, [callId]);

  const changeMyLang = useCallback((newMy: string) => {
    const newTarget = newMy === targetLang ? myLang : targetLang;
    setMyLang(newMy);
    setTargetLang(newTarget);
    if (socketRef.current && callId) {
      socketRef.current.emit('translator:set-languages', { call_id: callId, my_language: newMy, target_language: newTarget });
    }
  }, [callId, myLang, targetLang]);

  const changeTargetLang = useCallback((newTarget: string) => {
    const newMy = newTarget === myLang ? targetLang : myLang;
    setMyLang(newMy);
    setTargetLang(newTarget);
    if (socketRef.current && callId) {
      socketRef.current.emit('translator:set-languages', { call_id: callId, my_language: newMy, target_language: newTarget });
    }
  }, [callId, myLang, targetLang]);

  const changeVoice = useCallback((v: string) => {
    setVoice(v);
    if (socketRef.current && callId) {
      socketRef.current.emit('translator:set-voice', { call_id: callId, voice: v });
    }
  }, [callId]);

  const changeTone = useCallback((t: string) => {
    setTone(t);
    setShowToneMenu(false);
    if (socketRef.current && callId) {
      socketRef.current.emit('translator:set-tone', { call_id: callId, tone: t });
    }
  }, [callId]);

  const togglePause = useCallback(() => {
    const newPaused = !paused;
    setPaused(newPaused);
    if (socketRef.current && callId) {
      socketRef.current.emit(newPaused ? 'translator:pause' : 'translator:resume', { call_id: callId });
    }
  }, [callId, paused]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-white mb-1">Connection Error</h1>
          <p className="text-sm text-gray-400">{error || 'Unable to connect to translation session'}</p>
        </div>
      </div>
    );
  }

  const currentTone = TONES.find(t => t.value === tone);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white flex flex-col">
      {/* ─── Header: Timer + Cost only ─── */}
      <div className="sticky top-0 z-20 bg-[#0a0e1a]/95 backdrop-blur-sm border-b border-white/5 px-3 py-2.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status === 'live' && !paused && <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />}
            {status === 'live' && paused && <span className="w-2 h-2 bg-amber-400 rounded-full" />}
            {status === 'ended' && <span className="w-2 h-2 bg-gray-500 rounded-full" />}
            {status === 'connecting' && <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />}
            <span className="font-mono text-sm text-gray-300">{formatTime(duration)}</span>
            {paused && <span className="text-[10px] font-medium text-amber-400 uppercase">Paused</span>}
          </div>
          <span className="font-mono text-sm text-gray-300">${cost.toFixed(2)}</span>
        </div>
      </div>

      {/* ─── Translations ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full">
        {translations.length === 0 && !isSpeaking && status === 'live' && (
          <div className="text-center mt-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Waiting for conversation...</p>
            <p className="text-[11px] text-gray-600 mt-1">Translations will appear here in real-time</p>
          </div>
        )}

        {translations.map((entry, i) => (
          <div key={i} className="mb-5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${entry.speaker === 'subscriber' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {entry.speaker === 'subscriber' ? 'You' : 'Other'}
              </span>
              <span className="text-[10px] text-gray-600">
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <div className="text-[17px] leading-relaxed font-medium text-white mb-1">
              {entry.translated}
            </div>
            <div className="text-[13px] text-gray-500 leading-snug">
              {entry.original}
            </div>
          </div>
        ))}

        {/* Interim */}
        {(isSpeaking || interimTranslated) && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/70">
                {interimTranslated ? 'Translating...' : 'Listening...'}
              </span>
            </div>
            {interimTranslated && (
              <div className="text-[17px] leading-relaxed font-medium text-white">
                {interimTranslated}<span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse" />
              </div>
            )}
            {interimOriginal && (
              <div className="text-[13px] text-gray-500 leading-snug mt-1">
                {interimOriginal}
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ─── Bottom Controls ─── */}
      {status === 'live' && (
        <div className="sticky bottom-0 z-20 bg-[#0a0e1a]/95 backdrop-blur-sm border-t border-white/5 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto space-y-2">
            {/* Row 1: Mode + Languages + Pause */}
            <div className="flex items-center gap-2">
              {/* Mode toggle */}
              <div className="flex rounded-md border border-white/10 overflow-hidden">
                {(['bidirectional', 'unidirectional'] as const).map(m => (
                  <button key={m} onClick={() => changeMode(m)}
                    className={`px-2.5 py-1.5 text-[10px] font-medium transition-all ${
                      mode === m ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-500 hover:text-gray-300'
                    }`}>
                    {m === 'bidirectional' ? '2-way' : '1-way'}
                  </button>
                ))}
              </div>

              {/* Languages */}
              <div className="flex items-center gap-1">
                <select value={myLang} onChange={e => changeMyLang(e.target.value)}
                  className="px-1.5 py-1.5 rounded-md text-[11px] bg-white/5 border border-white/10 text-gray-300 outline-none w-14">
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <svg className="w-3 h-3 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                <select value={targetLang} onChange={e => changeTargetLang(e.target.value)}
                  className="px-1.5 py-1.5 rounded-md text-[11px] bg-white/5 border border-white/10 text-gray-300 outline-none w-14">
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>

              {/* Pause button */}
              <button onClick={togglePause}
                className={`ml-auto p-1.5 rounded-lg border transition-all ${
                  paused
                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
                title={paused ? 'Resume' : 'Pause'}>
                {paused ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Row 2: Voice + Tone */}
            <div className="flex items-center gap-2">
              {/* Voice selector */}
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
                <select value={voice} onChange={e => changeVoice(e.target.value)}
                  className="px-1.5 py-1.5 rounded-md text-[11px] bg-white/5 border border-white/10 text-gray-300 outline-none">
                  <optgroup label="Female">
                    {VOICES.filter(v => v.gender === 'F').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </optgroup>
                  <optgroup label="Male">
                    {VOICES.filter(v => v.gender === 'M').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </optgroup>
                </select>
              </div>

              {/* Tone selector */}
              <div className="relative ml-auto">
                <button onClick={() => setShowToneMenu(!showToneMenu)}
                  title="Communication style for translations"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-all ${
                    tone !== 'neutral'
                      ? 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-300'
                  }`}>
                  <span>{currentTone?.icon}</span>
                  <span>{currentTone?.label || 'Tone'}</span>
                  <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {showToneMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowToneMenu(false)} />
                    <div className="absolute bottom-full right-0 mb-1 z-40 bg-[#161b2e] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[160px]">
                      {TONES.map(t => (
                        <button key={t.value} onClick={() => changeTone(t.value)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] text-left transition-all ${
                            tone === t.value
                              ? 'bg-indigo-500/15 text-indigo-300'
                              : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                          }`}>
                          <span>{t.icon}</span>
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Footer (when ended) ─── */}
      {status === 'ended' && (
        <div className="border-t border-white/5 px-4 py-4 text-center">
          <p className="text-xs text-gray-500">
            Session ended &middot; {translations.length} translations &middot; {formatTime(duration)} &middot; ${cost.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}
