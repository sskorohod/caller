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

const VOICES = [
  { value: 'ara', label: 'Ara', gender: 'F' },
  { value: 'eve', label: 'Eve', gender: 'F' },
  { value: 'rex', label: 'Rex', gender: 'M' },
  { value: 'sal', label: 'Sal', gender: 'M' },
  { value: 'leo', label: 'Leo', gender: 'M' },
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
  const [callId, setCallId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const startTimeRef = useRef(Date.now());

  // Local duration timer (backup for stats gaps)
  useEffect(() => {
    if (status !== 'live') return;
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

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
      startTimeRef.current = Date.now();
    });

    s.on('connect_error', () => {
      setError('Connection failed');
      setStatus('error');
    });

    // Final translation
    s.on('call:translation', (data: TranslationEntry & { call_id?: string }) => {
      if (data.call_id) setCallId(data.call_id);
      setTranslations(prev => [...prev, data]);
      setInterimOriginal('');
      setInterimTranslated('');
      setIsSpeaking(false);
    });

    // Streaming interim translation
    s.on('call:translation:interim', (data: { original: string; translated: string; call_id?: string }) => {
      if (data.call_id) setCallId(data.call_id);
      setInterimOriginal(data.original || '');
      setInterimTranslated(data.translated || '');
    });

    // Interim transcript (speech indicator)
    s.on('call:transcript', (data: { text: string; isFinal: boolean; call_id?: string }) => {
      if (data.call_id) setCallId(data.call_id);
      if (!data.isFinal) {
        setIsSpeaking(true);
        if (data.text) setInterimOriginal(data.text);
      } else {
        setIsSpeaking(false);
      }
    });

    // Stats (duration + cost from server)
    s.on('translator:stats', (data: { duration_seconds: number; cost_usd: number }) => {
      setDuration(data.duration_seconds);
      setCost(data.cost_usd);
    });

    // Call ended
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

  const changeVoice = useCallback((v: string) => {
    setVoice(v);
    if (socketRef.current && callId) {
      socketRef.current.emit('translator:set-voice', { call_id: callId, voice: v });
    }
  }, [callId]);

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

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white flex flex-col">
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-20 bg-[#0a0e1a]/95 backdrop-blur-sm border-b border-white/5">
        <div className="px-4 py-3 max-w-2xl mx-auto">
          {/* Row 1: Logo + Status */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3" />
                </svg>
              </div>
              <span className="font-bold text-sm">Translator</span>
            </div>
            <div className="flex items-center gap-3">
              {status === 'live' && (
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-emerald-400 font-medium">Live</span>
                </span>
              )}
              {status === 'ended' && <span className="text-xs text-gray-500">Ended</span>}
              {status === 'connecting' && <span className="text-xs text-amber-400">Connecting...</span>}
            </div>
          </div>

          {/* Row 2: Duration + Cost */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-gray-400">{formatTime(duration)}</span>
            <span className="font-mono text-gray-400">${cost.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ─── Controls ─── */}
      {status === 'live' && (
        <div className="sticky top-[76px] z-10 bg-[#0a0e1a]/95 backdrop-blur-sm border-b border-white/5 px-4 py-2.5">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-white/10 overflow-hidden flex-1">
              {(['bidirectional', 'unidirectional'] as const).map(m => (
                <button key={m} onClick={() => changeMode(m)}
                  className={`flex-1 px-3 py-1.5 text-[11px] font-medium transition-all ${
                    mode === m ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-500 hover:text-gray-300'
                  }`}>
                  {m === 'bidirectional' ? 'Both ways' : 'One way'}
                </button>
              ))}
            </div>
            {/* Voice select */}
            <select value={voice} onChange={e => changeVoice(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-gray-300 outline-none">
              <optgroup label="Female">
                {VOICES.filter(v => v.gender === 'F').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </optgroup>
              <optgroup label="Male">
                {VOICES.filter(v => v.gender === 'M').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </optgroup>
            </select>
          </div>
        </div>
      )}

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
            {/* Speaker + time */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${entry.speaker === 'subscriber' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {entry.speaker === 'subscriber' ? 'You' : 'Other'}
              </span>
              <span className="text-[10px] text-gray-600">
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            {/* Translation (prominent) */}
            <div className="text-[17px] leading-relaxed font-medium text-white mb-1">
              {entry.translated}
            </div>
            {/* Original (subtle) */}
            <div className="text-[13px] text-gray-500 leading-snug">
              {entry.original}
            </div>
          </div>
        ))}

        {/* Interim: streaming translation */}
        {(isSpeaking || interimTranslated) && (
          <div className="mb-5 opacity-80">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/70">
                Speaking...
              </span>
            </div>
            {interimTranslated && (
              <div className="text-[17px] leading-relaxed font-medium text-white/60">
                {interimTranslated}
              </div>
            )}
            {interimOriginal && (
              <div className="text-[13px] text-gray-600 leading-snug">
                {interimOriginal}
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

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
