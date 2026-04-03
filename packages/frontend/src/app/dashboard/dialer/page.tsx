'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from '@/lib/i18n';
import { useSocket } from '@/lib/socket';
import { useTwilioDevice } from '@/lib/use-twilio-device';
import { api } from '@/lib/api';

interface TranscriptEntry {
  speaker: 'caller' | 'operator' | 'system';
  text: string;
  timestamp: string;
  isFinal: boolean;
  translated?: string;
  correction?: string;
  correctionExplanation?: string;
}

type CallState = 'idle' | 'connecting' | 'ringing' | 'in_call' | 'ended';

const STT_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
];

// Map timezone prefix to phone placeholder and default STT language
function getRegionDefaults(timezone: string, languages: string[]): { placeholder: string; defaultSttLang: string } {
  const tz = timezone.toLowerCase();
  if (tz.startsWith('america/')) return { placeholder: '+1', defaultSttLang: languages.includes('es') ? 'es' : 'en' };
  if (tz.startsWith('europe/moscow') || tz.startsWith('europe/samara') || tz.startsWith('asia/yekaterinburg') || tz.startsWith('asia/novosib') || tz.startsWith('asia/vladivostok'))
    return { placeholder: '+7', defaultSttLang: 'ru' };
  if (tz.startsWith('europe/berlin') || tz.startsWith('europe/vienna') || tz.startsWith('europe/zurich'))
    return { placeholder: '+49', defaultSttLang: 'de' };
  if (tz.startsWith('europe/paris')) return { placeholder: '+33', defaultSttLang: 'fr' };
  if (tz.startsWith('europe/madrid')) return { placeholder: '+34', defaultSttLang: 'es' };
  if (tz.startsWith('europe/london')) return { placeholder: '+44', defaultSttLang: 'en' };
  return { placeholder: '+1', defaultSttLang: languages[0] || 'en' };
}

const TRANSLATE_LANGUAGES = [
  { value: '', label: 'Off' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
];

export default function DialerPage() {
  const t = useT();
  const { socket } = useSocket();
  const { makeCall, hangup, toggleMute, isMuted, activeCall, initDevice } = useTwilioDevice();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [sttLanguage, setSttLanguage] = useState('en');
  const [sttProvider, setSttProvider] = useState<'deepgram' | 'openai'>('deepgram');
  const [phonePlaceholder, setPhonePlaceholder] = useState('+1');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callId, setCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [duration, setDuration] = useState(0);
  const [translateTo, setTranslateTo] = useState('ru');
  const [suggestions, setSuggestions] = useState<Array<{ text: string; translation: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartRef = useRef<number>(0);

  // Load workspace settings to determine region defaults
  useEffect(() => {
    api.get<{ timezone?: string; languages?: string[] }>('/workspaces/current').then(ws => {
      const { placeholder, defaultSttLang } = getRegionDefaults(ws.timezone || '', ws.languages || ['en']);
      setPhonePlaceholder(placeholder);
      setSttLanguage(defaultSttLang);
    }).catch(() => {});
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Duration timer
  useEffect(() => {
    if (callState === 'in_call') {
      callStartRef.current = Date.now();
      durationRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
      }, 1000);
    } else {
      if (durationRef.current) clearInterval(durationRef.current);
    }
    return () => { if (durationRef.current) clearInterval(durationRef.current); };
  }, [callState]);

  // Socket.IO listeners
  useEffect(() => {
    if (!socket || !callId) return;

    socket.emit('call:join', { call_id: callId });

    const onTranscript = (data: { call_id: string; speaker: string; text: string; timestamp: string; isFinal: boolean }) => {
      if (data.call_id !== callId) return;
      setTranscript(prev => {
        const speaker = data.speaker as TranscriptEntry['speaker'];
        // Update last interim from same speaker, or add new entry
        if (!data.isFinal && prev.length > 0) {
          const last = prev[prev.length - 1];
          if (last.speaker === speaker && !last.isFinal) {
            return [...prev.slice(0, -1), { ...last, text: data.text, timestamp: data.timestamp }];
          }
        }
        return [...prev, { speaker, text: data.text, timestamp: data.timestamp, isFinal: data.isFinal }];
      });
    };

    const onStatus = (data: { call_id: string; status: string }) => {
      if (data.call_id !== callId) return;
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'canceled') {
        setCallState('ended');
      }
    };

    const onTranslation = (data: { call_id: string; speaker: string; original: string; translated: string; timestamp: string }) => {
      if (data.call_id !== callId) return;
      setTranscript(prev => {
        // Find matching transcript entry and add translation
        const idx = [...prev].reverse().findIndex(
          e => e.speaker === data.speaker && e.isFinal
        );
        if (idx >= 0) {
          const realIdx = prev.length - 1 - idx;
          const updated = [...prev];
          updated[realIdx] = { ...updated[realIdx], translated: data.translated };
          return updated;
        }
        return prev;
      });
    };

    const onCorrection = (data: { call_id: string; original: string; corrected: string; explanation?: string }) => {
      if (data.call_id !== callId) return;
      setTranscript(prev => {
        const idx = [...prev].reverse().findIndex(
          e => e.speaker === 'operator' && e.isFinal
        );
        if (idx >= 0) {
          const realIdx = prev.length - 1 - idx;
          const updated = [...prev];
          updated[realIdx] = { ...updated[realIdx], correction: data.corrected, correctionExplanation: data.explanation };
          return updated;
        }
        return prev;
      });
    };

    const onSuggestions = (data: { call_id: string; suggestions: Array<{ text: string; translation: string }> }) => {
      if (data.call_id !== callId) return;
      setSuggestions(data.suggestions ?? []);
    };

    socket.on('call:transcript', onTranscript);
    socket.on('call:status', onStatus);
    socket.on('call:translation', onTranslation);
    socket.on('call:speech-correction', onCorrection);
    socket.on('call:copilot:suggestions', onSuggestions);

    return () => {
      socket.off('call:transcript', onTranscript);
      socket.off('call:status', onStatus);
      socket.off('call:translation', onTranslation);
      socket.off('call:speech-correction', onCorrection);
      socket.off('call:copilot:suggestions', onSuggestions);
    };
  }, [socket, callId]);

  // Init Twilio device on mount
  useEffect(() => {
    initDevice().catch(() => {});
  }, [initDevice]);

  // Start translation
  useEffect(() => {
    if (!callId || !translateTo || callState !== 'in_call') return;

    api.post(`/calls/${callId}/translate/start`, {
      target_language: translateTo,
      source_language: sttLanguage,
      mode: 'copilot',
      my_language: translateTo,
      instant: true,
    }).catch(() => {});

    if (socket) {
      socket.emit('call:translate:join', { call_id: callId, target_language: translateTo });
    }

    return () => {
      if (socket) {
        socket.emit('call:translate:leave', { call_id: callId });
      }
    };
  }, [callId, translateTo, callState, socket]);

  const handleCall = useCallback(async () => {
    if (!phoneNumber.trim()) return;
    setError(null);
    setTranscript([]);
    setDuration(0);
    setCallState('connecting');

    // Normalize phone number to E.164 format
    let normalizedPhone = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
    if (!normalizedPhone.startsWith('+')) {
      // 10 digits without country code → prepend +1 (US)
      if (/^\d{10}$/.test(normalizedPhone)) {
        normalizedPhone = '+1' + normalizedPhone;
      } else if (/^1\d{10}$/.test(normalizedPhone)) {
        normalizedPhone = '+' + normalizedPhone;
      } else {
        normalizedPhone = '+' + normalizedPhone;
      }
    }

    try {
      // 1. Create call record on backend
      const result = await api.post<{ call_id: string; from_number: string; stt_language: string }>(
        '/calls/dial',
        { to: normalizedPhone, stt_language: sttLanguage, stt_provider: sttProvider },
      );

      setCallId(result.call_id);

      // 2. Initiate browser call via Twilio Voice SDK
      const call = await makeCall({
        To: normalizedPhone,
        CallId: result.call_id,
        SttLanguage: sttLanguage,
      });

      call.on('ringing', () => setCallState('ringing'));
      call.on('accept', () => setCallState('in_call'));
      call.on('disconnect', () => setCallState('ended'));
      call.on('cancel', () => setCallState('ended'));
      call.on('reject', () => { setCallState('ended'); setError('Call rejected'); });
    } catch (err: any) {
      setCallState('idle');
      setError(err.message || 'Failed to start call');
    }
  }, [phoneNumber, sttLanguage, makeCall]);

  const handleHangup = useCallback(() => {
    hangup();
    setCallState('ended');
  }, [hangup]);

  const handleNewCall = useCallback(() => {
    setCallState('idle');
    setCallId(null);
    setTranscript([]);
    setSuggestions([]);
    setDuration(0);
    setError(null);
    setTranslateTo('ru');
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return ''; }
  };

  const isInCall = callState === 'in_call' || callState === 'ringing' || callState === 'connecting';

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 p-4">
      {/* Left: Dialer controls */}
      <div className="lg:w-[360px] shrink-0 flex flex-col gap-4">
        <div className="rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] p-6">
          <h2 className="text-lg font-semibold text-[var(--th-text)] mb-4">{t('dialer.title')}</h2>

          {/* Phone number input */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[var(--th-text-secondary)] mb-1">
              {t('dialer.phonePlaceholder')}
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              placeholder={`${phonePlaceholder}...`}
              disabled={isInCall}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--th-border)] bg-[var(--th-bg)] text-[var(--th-text)] text-lg font-mono focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)] disabled:opacity-50"
            />
          </div>

          {/* STT language */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[var(--th-text-secondary)] mb-1">
              {t('dialer.sttLanguage')}
            </label>
            <select
              value={sttLanguage}
              onChange={e => setSttLanguage(e.target.value)}
              disabled={isInCall}
              className="w-full px-3 py-2 rounded-lg border border-[var(--th-border)] bg-[var(--th-bg)] text-[var(--th-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)] disabled:opacity-50"
            >
              {sttProvider === 'openai' && (
                <option value="auto">Auto-detect</option>
              )}
              {STT_LANGUAGES.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* STT provider */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[var(--th-text-secondary)] mb-1">
              STT Engine
            </label>
            <div className="flex gap-1.5">
              {([
                { value: 'deepgram' as const, label: 'Deepgram', desc: 'Fast, low cost' },
                { value: 'openai' as const, label: 'Whisper', desc: 'Auto-detect lang' },
              ]).map(p => (
                <button
                  key={p.value}
                  onClick={() => setSttProvider(p.value)}
                  disabled={isInCall}
                  className={`flex-1 px-2 py-1.5 rounded-lg border text-xs transition disabled:opacity-50 ${
                    sttProvider === p.value
                      ? 'border-[var(--th-primary)] bg-[var(--th-primary)]/10 text-[var(--th-primary)] font-medium'
                      : 'border-[var(--th-border)] bg-[var(--th-bg)] text-[var(--th-text-secondary)] hover:border-[var(--th-primary)]'
                  }`}
                >
                  <div className="font-medium">{p.label}</div>
                  <div className="text-[10px] opacity-70">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Call controls */}
          <div className="flex flex-col gap-2">
            {callState === 'idle' && (
              <button
                onClick={handleCall}
                disabled={!phoneNumber.trim()}
                className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                {t('dialer.call')}
              </button>
            )}

            {isInCall && (
              <>
                {/* Status + duration */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                      {callState === 'connecting' ? t('dialer.connecting') :
                       callState === 'ringing' ? t('dialer.ringing') :
                       t('dialer.inCall')}
                    </span>
                  </div>
                  {callState === 'in_call' && (
                    <span className="text-sm font-mono text-green-700 dark:text-green-400">
                      {formatDuration(duration)}
                    </span>
                  )}
                </div>

                {/* Mute + Hangup */}
                <div className="flex gap-2">
                  <button
                    onClick={toggleMute}
                    className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2 ${
                      isMuted
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-700'
                        : 'bg-[var(--th-bg)] border border-[var(--th-border)] text-[var(--th-text)] hover:bg-[var(--th-surface-hover)]'
                    }`}
                  >
                    {isMuted ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L5 5m14 0v4a2 2 0 01-2 2H7m0 0v2a5 5 0 0010 0v-2M7 11V7a5 5 0 019.9-1" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                    )}
                    {isMuted ? t('dialer.unmute') : t('dialer.mute')}
                  </button>

                  <button
                    onClick={handleHangup}
                    className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
                    </svg>
                    {t('dialer.hangup')}
                  </button>
                </div>
              </>
            )}

            {callState === 'ended' && (
              <>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <span className="text-sm text-[var(--th-text-secondary)]">{t('dialer.callEnded')}</span>
                  <span className="text-sm font-mono text-[var(--th-text-secondary)]">{formatDuration(duration)}</span>
                </div>
                <button
                  onClick={handleNewCall}
                  className="w-full py-2.5 rounded-lg bg-[var(--th-primary)] hover:opacity-90 text-white font-medium text-sm transition"
                >
                  {t('dialer.call')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Translation panel */}
        <div className="rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] p-4">
          <label className="block text-xs font-medium text-[var(--th-text-secondary)] mb-1">
            {t('dialer.translateTo')}
          </label>
          <select
            value={translateTo}
            onChange={e => setTranslateTo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--th-border)] bg-[var(--th-bg)] text-[var(--th-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]"
          >
            {TRANSLATE_LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Transcript */}
      <div className="flex-1 flex flex-col rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--th-border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('dialer.transcript')}</h3>
          {transcript.length > 0 && (
            <span className="text-xs text-[var(--th-text-secondary)]">
              {transcript.filter(e => e.isFinal).length} messages
            </span>
          )}
        </div>

        {/* Copilot suggestions */}
        {suggestions.length > 0 && callState === 'in_call' && (
          <div className="px-4 py-2 border-b border-[var(--th-border)] bg-blue-50 dark:bg-blue-900/20">
            <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
              Suggested responses
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => navigator.clipboard.writeText(s.text)}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-white dark:bg-[var(--th-bg)] border border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition text-xs group"
                  title="Click to copy"
                >
                  <span className="text-[var(--th-text)] font-medium">{s.text}</span>
                  <span className="block text-[var(--th-text-secondary)] mt-0.5 text-[10px]">{s.translation}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {transcript.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-[var(--th-text-secondary)] text-center">
                {t('dialer.noTranscript')}
              </p>
            </div>
          ) : (
            transcript.map((entry, i) => (
              <div
                key={i}
                className={`flex ${entry.speaker === 'operator' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 ${
                    entry.speaker === 'operator'
                      ? 'bg-[var(--th-primary)] text-white'
                      : 'bg-[var(--th-bg)] border border-[var(--th-border)] text-[var(--th-text)]'
                  } ${!entry.isFinal ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold uppercase opacity-70">
                      {entry.speaker === 'operator' ? t('dialer.you') : t('dialer.them')}
                    </span>
                    <span className="text-[10px] opacity-50">{formatTime(entry.timestamp)}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{entry.text}</p>
                  {entry.translated && (
                    <p className="text-xs mt-1 opacity-70 italic border-t border-white/20 pt-1">
                      {entry.translated}
                    </p>
                  )}
                  {entry.correction && (
                    <p className={`text-xs mt-1 border-t pt-1 ${
                      entry.speaker === 'operator'
                        ? 'border-white/20 text-amber-200'
                        : 'border-[var(--th-border)] text-amber-600 dark:text-amber-400'
                    }`}>
                      <span className="font-medium">Better:</span> {entry.correction}
                      {entry.correctionExplanation && (
                        <span className="opacity-60 ml-1">({entry.correctionExplanation})</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>
    </div>
  );
}
