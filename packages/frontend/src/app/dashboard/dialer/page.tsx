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

// ─── Pricing (mirrors backend pricing.ts) ──────────────────────────────────

const PRICING = {
  telephony: { twilio: 0.013 }, // per minute per leg
  stt: { deepgram: 0.0043, openai: 0.006 }, // per minute per stream
  tts: { openai: 0.015, xai: 0.015, elevenlabs: 0.30 }, // per 1K chars
  llm_translation: 0.00003, // ~estimate per translation (50 in + 150 out tokens at gpt-4o-mini rates)
};

const TTS_VOICES: Record<string, Array<{ value: string; label: string }>> = {
  openai: [
    { value: 'alloy', label: 'Alloy' },
    { value: 'echo', label: 'Echo' },
    { value: 'fable', label: 'Fable' },
    { value: 'onyx', label: 'Onyx' },
    { value: 'nova', label: 'Nova' },
    { value: 'shimmer', label: 'Shimmer' },
  ],
  xai: [
    { value: 'ara', label: 'Ara' },
    { value: 'rex', label: 'Rex' },
    { value: 'sal', label: 'Sal' },
    { value: 'eve', label: 'Eve' },
    { value: 'leo', label: 'Leo' },
  ],
  elevenlabs: [],
};

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
  const [voiceTranslate, setVoiceTranslate] = useState(false);
  const [speakDirect, setSpeakDirect] = useState(false); // temporary bypass in voice translate mode
  const [ttsProvider, setTtsProvider] = useState<'elevenlabs' | 'openai' | 'xai'>('openai');
  const [ttsVoice, setTtsVoice] = useState('alloy'); // selected TTS voice
  const [ttsTargetLang, setTtsTargetLang] = useState('en'); // language to translate operator's speech INTO
  const [pttMode, setPttMode] = useState(true); // push-to-talk vs always-on
  const [pttActive, setPttActive] = useState(false); // currently holding PTT button

  // Live cost counter
  const [callCost, setCallCost] = useState(0);
  const eventCostRef = useRef(0); // accumulated TTS + LLM costs from events

  // Call history by phone number
  const [callHistory, setCallHistory] = useState<Array<{ id: string; created_at: string; duration_seconds: number | null; direction: string; status: string; summary?: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Recent numbers (from localStorage)
  const [recentNumbers, setRecentNumbers] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartRef = useRef<number>(0);

  // Load recent numbers from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('caller_recent_numbers');
      if (stored) setRecentNumbers(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const saveRecentNumber = useCallback((num: string) => {
    const normalized = num.trim().replace(/[\s\-\(\)]/g, '');
    if (!normalized) return;
    setRecentNumbers(prev => {
      const updated = [normalized, ...prev.filter(n => n !== normalized)].slice(0, 10);
      localStorage.setItem('caller_recent_numbers', JSON.stringify(updated));
      return updated;
    });
  }, []);

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

  // Duration timer + live cost calculation
  useEffect(() => {
    if (callState === 'in_call') {
      callStartRef.current = Date.now();
      eventCostRef.current = 0;
      setCallCost(0);
      durationRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - callStartRef.current) / 1000);
        setDuration(secs);
        // Time-based costs: Twilio (2 legs) + STT (2 streams if voice translate, 1 stream if normal)
        const mins = secs / 60;
        const sttRate = (PRICING.stt as any)[sttProvider] ?? PRICING.stt.deepgram;
        const sttStreams = voiceTranslate ? 2 : 1;
        const twilioLegs = voiceTranslate ? 2 : 1;
        const timeCost = mins * (PRICING.telephony.twilio * twilioLegs + sttRate * sttStreams);
        setCallCost(timeCost + eventCostRef.current);
      }, 1000);
    } else {
      if (durationRef.current) clearInterval(durationRef.current);
    }
    return () => { if (durationRef.current) clearInterval(durationRef.current); };
  }, [callState, sttProvider, voiceTranslate]);

  // Socket.IO listeners
  useEffect(() => {
    if (!socket || !callId) return;

    socket.emit('call:join', { call_id: callId });

    const onTranscript = (data: { call_id: string; speaker: string; text: string; timestamp: string; isFinal: boolean }) => {
      if (data.call_id !== callId) return;
      setTranscript(prev => {
        const speaker = data.speaker as TranscriptEntry['speaker'];

        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          // Update interim from same speaker
          if (!data.isFinal && last.speaker === speaker && !last.isFinal) {
            return [...prev.slice(0, -1), { ...last, text: data.text, timestamp: data.timestamp }];
          }
          // Final replacing an interim from same speaker
          if (data.isFinal && last.speaker === speaker && !last.isFinal) {
            return [...prev.slice(0, -1), { speaker, text: data.text, timestamp: data.timestamp, isFinal: true }];
          }
        }
        return [...prev, { speaker, text: data.text, timestamp: data.timestamp, isFinal: data.isFinal }];
      });
    };

    const onStatus = (data: { call_id: string; status: string }) => {
      if (data.call_id !== callId) return;
      if (data.status === 'in_progress') {
        setCallState('in_call'); // callee answered
      }
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'canceled') {
        setCallState('ended');
      }
    };

    const onTranslation = (data: { call_id: string; speaker: string; original: string; translated: string; timestamp: string }) => {
      if (data.call_id !== callId) return;
      // Add event-based cost: TTS + LLM translation
      const ttsRate = (PRICING.tts as any)[ttsProvider] ?? PRICING.tts.openai;
      eventCostRef.current += (data.translated.length / 1000) * ttsRate + PRICING.llm_translation;
      setTranscript(prev => {
        // Match by original text first, fallback to last untranslated isFinal from same speaker
        const reversed = [...prev].reverse();
        let idx = reversed.findIndex(e => e.speaker === data.speaker && e.isFinal && e.text === data.original);
        if (idx < 0) {
          idx = reversed.findIndex(e => e.speaker === data.speaker && e.isFinal && !e.translated);
        }
        if (idx >= 0) {
          const realIdx = prev.length - 1 - idx;
          const updated = [...prev];
          updated[realIdx] = { ...prev[realIdx], translated: data.translated };
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
    saveRecentNumber(phoneNumber);

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
        {
          to: normalizedPhone,
          stt_language: sttLanguage,
          stt_provider: sttProvider,
          voice_translate: voiceTranslate,
          tts_provider: voiceTranslate ? ttsProvider : undefined,
          tts_voice_id: voiceTranslate && ttsVoice ? ttsVoice : undefined,
          translate_to_language: voiceTranslate ? ttsTargetLang : undefined,
        },
      );

      setCallId(result.call_id);

      // 2. Initiate browser call via Twilio Voice SDK
      const call = await makeCall({
        To: normalizedPhone,
        CallId: result.call_id,
        SttLanguage: sttLanguage,
        VoiceTranslate: voiceTranslate ? 'true' : 'false',
      });

      call.on('ringing', () => setCallState('ringing'));
      call.on('accept', () => {
        if (voiceTranslate) {
          setCallState('connecting');
          if (socket) socket.emit('call:listen:start', { call_id: result.call_id });
          // In PTT mode, start muted — operator must hold button to speak
          if (pttMode) call.mute(true);
        } else {
          setCallState('in_call');
        }
      });
      call.on('disconnect', () => setCallState('ended'));
      call.on('cancel', () => setCallState('ended'));
      call.on('reject', () => { setCallState('ended'); setError('Call rejected'); });
    } catch (err: any) {
      setCallState('idle');
      setError(err.message || 'Failed to start call');
    }
  }, [phoneNumber, sttLanguage, sttProvider, voiceTranslate, makeCall, socket]);

  const handleHangup = useCallback(() => {
    hangup();
    setCallState('ended');
  }, [hangup]);

  const handleNewCall = useCallback(() => {
    hangup(); // ensure previous call is fully disconnected
    setCallState('idle');
    setCallId(null);
    setTranscript([]);
    setSuggestions([]);
    setDuration(0);
    setError(null);
    setTranslateTo('ru');
  }, [hangup]);

  // Load call history when phone number changes (debounced)
  useEffect(() => {
    const normalized = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
    if (normalized.length < 7) {
      setCallHistory([]);
      return;
    }
    const timer = setTimeout(() => {
      setHistoryLoading(true);
      api.get<{ calls: typeof callHistory }>(`/calls/by-phone/${encodeURIComponent(normalized)}`)
        .then(r => setCallHistory(r.calls ?? []))
        .catch(() => setCallHistory([]))
        .finally(() => setHistoryLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [phoneNumber]);

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
      <div className="lg:w-[420px] shrink-0 flex flex-col gap-4">
        <div className="rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] p-6">
          <h2 className="text-lg font-semibold text-[var(--th-text)] mb-4">{t('dialer.title')}</h2>

          {/* Phone number input + recent numbers */}
          <div className="mb-4 relative">
            <label className="block text-xs font-medium text-[var(--th-text-secondary)] mb-1">
              {t('dialer.phonePlaceholder')}
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={e => { setPhoneNumber(e.target.value); setShowRecent(false); }}
              onFocus={() => { if (!phoneNumber && recentNumbers.length > 0) setShowRecent(true); }}
              onBlur={() => setTimeout(() => setShowRecent(false), 200)}
              placeholder={`${phonePlaceholder}...`}
              disabled={isInCall}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--th-border)] bg-[var(--th-bg)] text-[var(--th-text)] text-lg font-mono focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)] disabled:opacity-50"
            />
            {showRecent && recentNumbers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 rounded-lg border border-[var(--th-border)] bg-[var(--th-card)] shadow-lg overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--th-text-muted)] uppercase">{t('dialer.recentNumbers')}</div>
                {recentNumbers.map(num => (
                  <button
                    key={num}
                    onMouseDown={() => { setPhoneNumber(num); setShowRecent(false); }}
                    className="w-full text-left px-3 py-2 text-sm font-mono text-[var(--th-text)] hover:bg-[var(--th-surface)] transition-colors"
                  >
                    {num}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language selectors */}
          {voiceTranslate ? (
            /* Voice translate: show both operator and callee language */
            <div className="mb-4 flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[var(--th-text-secondary)] mb-1">
                  {t('dialer.yourLanguage')}
                </label>
                <select
                  value={sttLanguage}
                  onChange={e => setSttLanguage(e.target.value)}
                  disabled={isInCall}
                  className="w-full px-2 py-2 rounded-lg border border-[var(--th-border)] bg-[var(--th-bg)] text-[var(--th-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)] disabled:opacity-50"
                >
                  {sttProvider === 'openai' && (
                    <option value="auto">Auto-detect</option>
                  )}
                  {STT_LANGUAGES.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-1 text-[var(--th-text-muted)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[var(--th-text-secondary)] mb-1">
                  {t('dialer.sttLanguage')}
                </label>
                <select
                  value={ttsTargetLang}
                  onChange={e => setTtsTargetLang(e.target.value)}
                  disabled={isInCall}
                  className="w-full px-2 py-2 rounded-lg border border-[var(--th-border)] bg-[var(--th-bg)] text-[var(--th-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)] disabled:opacity-50"
                >
                  {STT_LANGUAGES.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            /* Normal mode: just callee STT language */
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
          )}

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

          {/* Voice Translate toggle */}
          <div className="mb-4">
            <button
              onClick={() => {
                const next = !voiceTranslate;
                setVoiceTranslate(next);
                if (next) {
                  // When enabling VT: operator language = ru, callee language = current sttLanguage
                  setTtsTargetLang(sttLanguage);
                  setSttLanguage('ru');
                }
              }}
              disabled={isInCall}
              className={`w-full px-3 py-2.5 rounded-lg border text-sm font-medium transition flex items-center justify-between disabled:opacity-50 ${
                voiceTranslate
                  ? 'border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                  : 'border-[var(--th-border)] bg-[var(--th-bg)] text-[var(--th-text-secondary)] hover:border-purple-400'
              }`}
            >
              <span>{voiceTranslate ? 'Voice Translate ON' : 'Voice Translate'}</span>
              <span className={`inline-flex items-center w-9 h-5 rounded-full transition-colors shrink-0 ${voiceTranslate ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${voiceTranslate ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
              </span>
            </button>
            {voiceTranslate && (
              <div className="mt-2 space-y-2">
                <div className="text-[10px] text-purple-600 dark:text-purple-400 px-1">
                  {t('dialer.voiceTranslateHint')}
                </div>

                {/* TTS provider + voice (can be changed mid-call) */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-medium text-[var(--th-text-secondary)] mb-0.5 px-1">
                      TTS
                    </label>
                    <select
                      value={ttsProvider}
                      onChange={e => {
                        const p = e.target.value as 'openai' | 'elevenlabs' | 'xai';
                        const newVoice = TTS_VOICES[p]?.[0]?.value ?? '';
                        setTtsProvider(p);
                        setTtsVoice(newVoice);
                        if (callId && socket) {
                          socket.emit('call:tts:change', { call_id: callId, provider: p, voice: newVoice });
                        }
                      }}
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--th-border)] bg-[var(--th-bg)] text-[var(--th-text)] text-xs"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="xai">xAI (Grok)</option>
                      <option value="elevenlabs">ElevenLabs</option>
                    </select>
                  </div>
                  {TTS_VOICES[ttsProvider]?.length > 0 && (
                    <div className="flex-1">
                      <label className="block text-[10px] font-medium text-[var(--th-text-secondary)] mb-0.5 px-1">
                        {t('dialer.voice')}
                      </label>
                      <select
                        value={ttsVoice}
                        onChange={e => {
                          setTtsVoice(e.target.value);
                          if (callId && socket) {
                            socket.emit('call:tts:change', { call_id: callId, provider: ttsProvider, voice: e.target.value });
                          }
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-[var(--th-border)] bg-[var(--th-bg)] text-[var(--th-text)] text-xs"
                      >
                        {TTS_VOICES[ttsProvider].map(v => (
                          <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}
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
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-green-700 dark:text-green-400">
                        {formatDuration(duration)}
                      </span>
                      <span className="text-sm font-mono text-amber-600 dark:text-amber-400">
                        ${callCost.toFixed(4)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Voice translate controls */}
                {voiceTranslate && (
                  <div className="space-y-2">
                    {/* PTT mode toggle */}
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] text-[var(--th-text-secondary)]">
                        {pttMode ? 'Push-to-talk' : 'Always listening'}
                      </span>
                      <button
                        onClick={() => {
                          setPttMode(!pttMode);
                          if (activeCall) activeCall.mute(!pttMode); // mute when switching to PTT
                        }}
                        className="text-[10px] text-purple-600 dark:text-purple-400 underline"
                      >
                        {pttMode ? 'Switch to always-on' : 'Switch to PTT'}
                      </button>
                    </div>

                    {/* PTT button (big, hold to speak) */}
                    {pttMode ? (
                      <button
                        onMouseDown={() => { setPttActive(true); if (activeCall) activeCall.mute(false); }}
                        onMouseUp={() => { setPttActive(false); if (activeCall) activeCall.mute(true); }}
                        onMouseLeave={() => { if (pttActive) { setPttActive(false); if (activeCall) activeCall.mute(true); } }}
                        onTouchStart={() => { setPttActive(true); if (activeCall) activeCall.mute(false); }}
                        onTouchEnd={() => { setPttActive(false); if (activeCall) activeCall.mute(true); }}
                        className={`w-full py-4 rounded-xl font-bold text-sm transition select-none ${
                          pttActive
                            ? 'bg-red-500 text-white shadow-lg scale-[1.02]'
                            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-2 border-purple-300 dark:border-purple-700'
                        }`}
                      >
                        {pttActive ? 'SPEAKING...' : 'HOLD TO SPEAK'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setSpeakDirect(!speakDirect)}
                        className={`w-full py-2 rounded-lg font-medium text-xs transition ${
                          speakDirect
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700'
                            : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                        }`}
                      >
                        {speakDirect ? 'Speaking directly (no translation)' : 'Voice translating your speech'}
                      </button>
                    )}
                  </div>
                )}

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
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-[var(--th-text-secondary)]">{formatDuration(duration)}</span>
                    <span className="text-sm font-mono text-amber-600 dark:text-amber-400">${callCost.toFixed(4)}</span>
                  </div>
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

        {/* Call history for this number */}
        {callHistory.length > 0 && (
          <div className="rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] p-4">
            <h3 className="text-xs font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-2">
              {t('dialer.callHistory')} ({callHistory.length})
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {callHistory.slice(0, 10).map(c => (
                <div key={c.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[var(--th-bg)] text-xs transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`shrink-0 ${c.direction === 'outbound' ? 'text-blue-500' : 'text-green-500'}`}>
                      {c.direction === 'outbound' ? '↗' : '↙'}
                    </span>
                    <span className="text-[var(--th-text-secondary)] shrink-0">
                      {new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-[var(--th-text-muted)] shrink-0">
                      {c.duration_seconds ? formatDuration(c.duration_seconds) : '--'}
                    </span>
                    {c.summary && (
                      <span className="text-[var(--th-text-secondary)] truncate">{c.summary}</span>
                    )}
                  </div>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    c.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    c.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
                  {entry.translated ? (
                    <>
                      <p className="text-sm leading-relaxed font-medium">{entry.translated}</p>
                      <p className="text-xs mt-0.5 opacity-50 italic">{entry.text}</p>
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed">{entry.text}</p>
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
