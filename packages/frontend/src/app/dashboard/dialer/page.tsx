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

const GROK_VOICES = [
  { value: 'ara', label: 'Ara', gender: 'Female' },
  { value: 'eve', label: 'Eve', gender: 'Female' },
  { value: 'rex', label: 'Rex', gender: 'Male' },
  { value: 'sal', label: 'Sal', gender: 'Male' },
  { value: 'leo', label: 'Leo', gender: 'Male' },
];

export default function DialerPage() {
  const t = useT();
  const { socket } = useSocket();
  const { makeCall, hangup, toggleMute, isMuted, activeCall, initDevice } = useTwilioDevice();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [sttLanguage, setSttLanguage] = useState('en');
  const [sttProvider] = useState<'deepgram' | 'openai'>('deepgram');
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
  const [ttsVoice, setTtsVoice] = useState('ara');
  const [ttsTargetLang, setTtsTargetLang] = useState('en'); // language to translate operator's speech INTO
  const [pttMode, setPttMode] = useState(true); // push-to-talk vs always-on
  const [pttActive, setPttActive] = useState(false); // currently holding PTT button

  // Live cost counter
  const [callCost, setCallCost] = useState(0);
  const eventCostRef = useRef(0); // accumulated TTS + LLM costs from events
  const pttPressCountRef = useRef(0); // incremented on each PTT press, used to split bubbles
  const lastBubblePttRef = useRef(0); // pttPressCount when last operator bubble was created

  // Call history by phone number
  const [callHistory, setCallHistory] = useState<Array<{ id: string; created_at: string; duration_seconds: number | null; direction: string; status: string; summary?: string; total_turns?: number }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryCall, setExpandedHistoryCall] = useState<string | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState<Array<{ role: string; content: string }> | null>(null);

  // Provider setup check
  const [twilioConfigured, setTwilioConfigured] = useState<boolean | null>(null); // null = loading

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

  // Check if Twilio is available (own credentials OR platform sharing)
  useEffect(() => {
    Promise.all([
      api.get<Array<{ provider: string }>>('/auth/providers'),
      api.get<Record<string, string>>('/billing/provider-config'),
    ]).then(([providers, config]) => {
      const hasOwn = providers.some(p => p.provider === 'twilio');
      const usesPlatform = config.twilio === 'platform';
      setTwilioConfigured(hasOwn || usesPlatform);
    }).catch(() => setTwilioConfigured(false));
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

        // For operator in voice translate: translations already created entries via onTranslation.
        // utterance_end just confirms — skip if entries already exist with translations.
        if (data.isFinal && speaker === 'operator' && prev.length > 0) {
          const last = prev[prev.length - 1];
          if (last.speaker === speaker && last.translated) {
            // Already have translated entry — don't duplicate
            return prev;
          }
        }

        if (prev.length > 0) {
          const last = prev[prev.length - 1];

          if (last.speaker === speaker) {
            // Same speaker — always update/merge instead of creating new bubble
            if (!data.isFinal) {
              // Interim: replace last bubble text (whether interim or final within same utterance)
              if (!last.isFinal || !last.translated) {
                return [...prev.slice(0, -1), { ...last, text: data.text, timestamp: data.timestamp, isFinal: false }];
              }
            } else {
              // Final: replace interim or merge with recent final
              if (!last.isFinal) {
                return [...prev.slice(0, -1), { speaker, text: data.text, timestamp: data.timestamp, isFinal: true }];
              }
              // Merge consecutive finals from same speaker (within 8 seconds)
              if (!last.translated) {
                const timeDiff = new Date(data.timestamp).getTime() - new Date(last.timestamp).getTime();
                if (timeDiff < 8000) {
                  const updated = [...prev];
                  updated[prev.length - 1] = { ...last, text: last.text + ' ' + data.text, timestamp: data.timestamp };
                  return updated;
                }
              }
            }
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
        // Refresh call history
        const normalized = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
        if (normalized.length >= 7) {
          setTimeout(() => {
            api.get<{ calls: typeof callHistory }>(`/calls/by-phone/${encodeURIComponent(normalized)}`)
              .then(r => setCallHistory(r.calls ?? []))
              .catch(() => {});
          }, 3000);
        }
      }
    };

    const onTranslation = (data: { call_id: string; speaker: string; original: string; translated: string; timestamp: string }) => {
      if (data.call_id !== callId) return;
      // Add event-based cost: TTS + LLM translation
      const ttsRate = PRICING.tts.xai;
      eventCostRef.current += (data.translated.length / 1000) * ttsRate + PRICING.llm_translation;
      setTranscript(prev => {
        const speaker = data.speaker as TranscriptEntry['speaker'];
        const currentPtt = pttPressCountRef.current;

        // For operator: merge segments within SAME PTT press into one bubble
        if (speaker === 'operator' && prev.length > 0 && currentPtt === lastBubblePttRef.current) {
          const last = prev[prev.length - 1];
          if (last.speaker === 'operator' && last.isFinal) {
            const updated = [...prev];
            updated[prev.length - 1] = {
              ...last,
              text: last.text + ' ' + data.original,
              translated: (last.translated ? last.translated + ' ' : '') + data.translated,
              timestamp: data.timestamp,
            };
            return updated;
          }
        }

        // For callee: merge consecutive callee entries
        if (speaker !== 'operator' && prev.length > 0) {
          const last = prev[prev.length - 1];
          if (last.speaker === speaker && last.isFinal) {
            const updated = [...prev];
            updated[prev.length - 1] = {
              ...last,
              text: last.text + ' ' + data.original,
              translated: (last.translated ? last.translated + ' ' : '') + data.translated,
              timestamp: data.timestamp,
            };
            return updated;
          }
        }

        // New bubble
        lastBubblePttRef.current = currentPtt;
        return [...prev, {
          speaker,
          text: data.original,
          translated: data.translated,
          timestamp: data.timestamp,
          isFinal: true,
        }];
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

  // Start translation (only if VT enabled)
  useEffect(() => {
    if (!callId || !translateTo || callState !== 'in_call' || !voiceTranslate) return;

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
          voice_translate_mode: voiceTranslate && speakDirect ? 'sequential' : undefined,
          tts_provider: voiceTranslate ? 'xai' : undefined,
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
        setCallState('connecting'); // Browser connected, waiting for callee to answer
        if (voiceTranslate && socket) {
          socket.emit('call:listen:start', { call_id: result.call_id });
          if (pttMode) call.mute(true);
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
    // Explicitly hang up callee via API (don't rely only on WebSocket close)
    if (callId) {
      api.post(`/calls/${callId}/hangup`, {}).catch(() => {});
    }
    hangup();
    setCallState('ended');
    // Refresh call history after call ends
    const normalized = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
    if (normalized.length >= 7) {
      setTimeout(() => {
        api.get<{ calls: typeof callHistory }>(`/calls/by-phone/${encodeURIComponent(normalized)}`)
          .then(r => setCallHistory(r.calls ?? []))
          .catch(() => {});
      }, 2000);
    }
  }, [hangup, phoneNumber, callId]);

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

  // Select input style
  const selectCls = "w-full px-3 py-2 rounded-xl border border-[var(--th-border)] bg-[var(--th-input)] text-[var(--th-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/30 focus:border-[var(--th-primary)] disabled:opacity-40 transition-all appearance-none";
  const selectSmCls = "w-full px-2.5 py-1.5 rounded-lg border border-[var(--th-border)] bg-[var(--th-input)] text-[var(--th-text)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/30 focus:border-[var(--th-primary)] disabled:opacity-40 transition-all appearance-none";

  return (
    <div className="h-full flex flex-col gap-5">
      {twilioConfigured === false && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(251, 191, 36, 0.06)', border: '1px solid rgba(251, 191, 36, 0.15)' }}>
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span style={{ color: '#fbbf24' }}>
            <strong>Twilio not configured</strong> — To make and receive calls, connect your Twilio account in Settings → Providers.
          </span>
          <a href="/dashboard/settings?section=providers" className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0"
            style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>
            Configure
          </a>
        </div>
      )}
      <div className="flex-1 flex flex-col lg:flex-row lg:items-start gap-5 overflow-y-auto">
      {/* ──── Left: Dialer ──── */}
      <div className="lg:w-[440px] shrink-0 flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start lg:max-h-screen lg:overflow-y-auto lg:scrollbar-none">

        {/* Main dialer card */}
        <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">

          {/* Phone input */}
          <div className="mb-5 relative">
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">
              {t('dialer.phonePlaceholder')}
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => { setPhoneNumber(e.target.value); setShowRecent(false); }}
                onFocus={() => { if (!phoneNumber && recentNumbers.length > 0) setShowRecent(true); }}
                onBlur={() => setTimeout(() => setShowRecent(false), 200)}
                placeholder={`${phonePlaceholder}...`}
                disabled={isInCall}
                className="w-full px-4 py-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-input)] text-[var(--th-text)] text-lg font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/30 focus:border-[var(--th-primary)] disabled:opacity-40 transition-all placeholder:text-[var(--th-text-muted)]"
              />
              {/* Phone icon */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--th-text-muted)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </div>
            </div>
            {/* Recent numbers dropdown */}
            {showRecent && recentNumbers.length > 0 && (
              <div className="absolute z-10 w-full mt-1.5 rounded-xl border border-[var(--th-border)] bg-[var(--th-card)] shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden backdrop-blur-sm">
                <div className="px-3.5 py-2 text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider border-b border-[var(--th-border-light)]">{t('dialer.recentNumbers')}</div>
                {recentNumbers.map(num => (
                  <button
                    key={num}
                    onMouseDown={() => { setPhoneNumber(num); setShowRecent(false); }}
                    className="w-full text-left px-3.5 py-2.5 text-sm font-mono text-[var(--th-text)] hover:bg-[var(--th-surface)] transition-colors"
                  >
                    {num}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language + STT section */}
          <div className="space-y-3 mb-5">
            {voiceTranslate ? (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1">{t('dialer.yourLanguage')}</label>
                  <select value={sttLanguage} onChange={e => setSttLanguage(e.target.value)} disabled={isInCall} className={selectCls}>
                    <option value="auto">Auto-detect</option>
                    {STT_LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div className="pb-2.5 text-[var(--th-text-muted)]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1">{t('dialer.sttLanguage')}</label>
                  <select value={ttsTargetLang} onChange={e => setTtsTargetLang(e.target.value)} disabled={isInCall} className={selectCls}>
                    {STT_LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1">{t('dialer.sttLanguage')}</label>
                  <select value={sttLanguage} onChange={e => setSttLanguage(e.target.value)} disabled={isInCall} className={selectCls}>
                    <option value="auto">Auto-detect</option>
                    {STT_LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1">{t('dialer.translateTo')}</label>
                  <select value={translateTo} onChange={e => setTranslateTo(e.target.value)} className={selectCls}>
                    {TRANSLATE_LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
            )}

          </div>

          {/* Voice Translate */}
          <div className="mb-5">
            <button
              onClick={() => {
                const next = !voiceTranslate;
                setVoiceTranslate(next);
                if (next && !isInCall) { setTtsTargetLang(sttLanguage); setSttLanguage('ru'); }
                // Mid-call toggle: notify backend
                if (callId && socket) {
                  socket.emit('call:translate:toggle', { call_id: callId, enabled: next });
                  if (next) {
                    // Also start translation service
                    api.post(`/calls/${callId}/translate/start`, {
                      target_language: translateTo, source_language: sttLanguage,
                      mode: 'copilot', my_language: translateTo, instant: true,
                    }).catch(() => {});
                    socket.emit('call:translate:join', { call_id: callId });
                  }
                }
              }}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center justify-between disabled:opacity-40 ${
                voiceTranslate
                  ? 'border-purple-500/40 bg-purple-500/10 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                  : 'border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text-secondary)] hover:border-purple-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                </svg>
                <span>{voiceTranslate ? 'Voice Translate ON' : 'Voice Translate'}</span>
              </div>
              <span className={`inline-flex items-center w-9 h-5 rounded-full transition-colors shrink-0 ${voiceTranslate ? 'bg-purple-500' : 'bg-[var(--th-text-muted)]/30'}`}>
                <span className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${voiceTranslate ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
              </span>
            </button>
            {voiceTranslate && (
              <div className="mt-3 space-y-2.5 pl-1">
                <p className="text-[10px] text-purple-400/80">{t('dialer.voiceTranslateHint')}</p>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1">{t('dialer.voice') || 'Voice'}</label>
                  <select
                    value={ttsVoice}
                    onChange={e => {
                      setTtsVoice(e.target.value);
                      if (callId && socket) socket.emit('call:tts:change', { call_id: callId, provider: 'xai', voice: e.target.value, language: ttsTargetLang });
                    }}
                    className={selectSmCls}
                  >
                    <optgroup label="Female">
                      {GROK_VOICES.filter(v => v.gender === 'Female').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </optgroup>
                    <optgroup label="Male">
                      {GROK_VOICES.filter(v => v.gender === 'Male').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </optgroup>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[var(--th-error-bg)] border border-[var(--th-error-border)] text-[var(--th-error-text)] text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          )}

          {/* ── Call Controls ── */}
          <div className="flex flex-col gap-2.5">
            {callState === 'idle' && (
              <button
                onClick={handleCall}
                disabled={!phoneNumber.trim()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-[0_4px_16px_rgba(34,197,94,0.25)] hover:shadow-[0_6px_24px_rgba(34,197,94,0.35)] active:scale-[0.98]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                {t('dialer.call')}
              </button>
            )}

            {isInCall && (
              <>
                {/* Status bar */}
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[var(--th-success-bg)] border border-[var(--th-success-border)]">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--th-success-icon)] opacity-50" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--th-success-icon)]" />
                    </span>
                    <span className="text-sm font-semibold text-[var(--th-success-text)]">
                      {callState === 'connecting' ? t('dialer.connecting') :
                       callState === 'ringing' ? t('dialer.ringing') :
                       t('dialer.inCall')}
                    </span>
                  </div>
                  {callState === 'in_call' && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-bold text-[var(--th-success-text)] tabular-nums">{formatDuration(duration)}</span>
                      <span className="text-xs font-mono text-[var(--th-warning-text)] tabular-nums bg-[var(--th-warning-bg)] px-2 py-0.5 rounded-md">${callCost.toFixed(4)}</span>
                    </div>
                  )}
                </div>

                {/* Voice translate in-call controls */}
                {voiceTranslate && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] text-[var(--th-text-muted)]">{pttMode ? 'Push-to-talk' : 'Always listening'}</span>
                      <button
                        onClick={() => { setPttMode(!pttMode); if (activeCall) activeCall.mute(!pttMode); }}
                        className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        {pttMode ? 'Switch to always-on' : 'Switch to PTT'}
                      </button>
                    </div>
                    {/* Sequential mode toggle */}
                    <button
                      onClick={() => {
                        const next = !speakDirect;
                        setSpeakDirect(next);
                        if (socket && callId) socket.emit('call:translate:mode', { call_id: callId, sequential: next });
                      }}
                      className={`w-full py-1.5 rounded-lg font-medium text-[10px] transition-all ${
                        speakDirect
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                      }`}
                    >
                      {speakDirect ? '🎙 Voice + Translation' : '🔄 Translation only'}
                    </button>

                    {pttMode ? (
                      <button
                        onMouseDown={() => {
                          setPttActive(true);
                          pttPressCountRef.current++;
                          if (activeCall) activeCall.mute(false);
                          if (socket && callId) socket.emit('call:ptt:state', { call_id: callId, active: true });
                        }}
                        onMouseUp={() => {
                          setPttActive(false);
                          if (activeCall) activeCall.mute(true);
                          if (socket && callId) socket.emit('call:ptt:state', { call_id: callId, active: false });
                        }}
                        onMouseLeave={() => {
                          if (pttActive) {
                            setPttActive(false);
                            if (activeCall) activeCall.mute(true);
                            if (socket && callId) socket.emit('call:ptt:state', { call_id: callId, active: false });
                          }
                        }}
                        onTouchStart={() => {
                          setPttActive(true);
                          pttPressCountRef.current++;
                          if (activeCall) activeCall.mute(false);
                          if (socket && callId) socket.emit('call:ptt:state', { call_id: callId, active: true });
                        }}
                        onTouchEnd={() => {
                          setPttActive(false);
                          if (activeCall) activeCall.mute(true);
                          if (socket && callId) socket.emit('call:ptt:state', { call_id: callId, active: false });
                        }}
                        className={`w-full py-4 rounded-xl font-bold text-sm transition-all select-none ${
                          pttActive
                            ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-[0_0_24px_rgba(239,68,68,0.3)] scale-[1.02]'
                            : 'bg-purple-500/10 text-purple-300 border-2 border-dashed border-purple-500/30 hover:border-purple-500/50'
                        }`}
                      >
                        {pttActive ? (speakDirect ? '🎙 SPEAKING...' : '🔄 SPEAKING...') : 'HOLD TO SPEAK'}
                      </button>
                    ) : null}
                  </div>
                )}

                {/* Mute + Hangup */}
                <div className="flex gap-2.5">
                  <button
                    onClick={toggleMute}
                    className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                      isMuted
                        ? 'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)] border border-[var(--th-warning-border)]'
                        : 'bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] hover:bg-[var(--th-surface-hover)]'
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
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(239,68,68,0.2)]"
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
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--th-surface)] border border-[var(--th-border)]">
                  <span className="text-sm font-medium text-[var(--th-text-secondary)]">{t('dialer.callEnded')}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-[var(--th-text)] tabular-nums">{formatDuration(duration)}</span>
                    <span className="text-xs font-mono text-[var(--th-warning-text)] bg-[var(--th-warning-bg)] px-2 py-0.5 rounded-md tabular-nums">${callCost.toFixed(4)}</span>
                  </div>
                </div>
                <button
                  onClick={handleNewCall}
                  className="w-full py-3 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-white font-semibold text-sm transition-all shadow-[0_4px_16px_var(--th-shadow-primary)]"
                >
                  {t('dialer.call')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Call history with expandable transcripts */}
        {callHistory.length > 0 && (
          <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-4 shadow-[0_1px_3px_var(--th-shadow)] flex-1 min-h-0 flex flex-col">
            <h3 className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-2.5">
              {t('dialer.callHistory')} ({callHistory.length})
            </h3>
            <div className="space-y-1 flex-1 overflow-y-auto">
              {callHistory.slice(0, 15).map(c => (
                <div key={c.id} className="rounded-lg border border-[var(--th-border-light)] overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-[var(--th-surface)] text-xs transition-colors text-left"
                    onClick={() => {
                      if (expandedHistoryCall === c.id) {
                        setExpandedHistoryCall(null);
                        setExpandedTranscript(null);
                      } else {
                        setExpandedHistoryCall(c.id);
                        setExpandedTranscript(null);
                        api.get<{ session?: { transcript?: Array<{ speaker?: string; role?: string; text?: string; content?: string }> } }>(`/calls/${c.id}/detail`)
                          .then(r => {
                            const t = r.session?.transcript;
                            if (t && Array.isArray(t)) {
                              setExpandedTranscript(t.map(e => ({
                                role: e.role ?? e.speaker ?? 'caller',
                                content: e.content ?? e.text ?? '',
                              })));
                            } else {
                              setExpandedTranscript([]);
                            }
                          })
                          .catch(() => setExpandedTranscript([]));
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 text-sm ${c.direction === 'outbound' ? 'text-[var(--th-primary-text)]' : 'text-[var(--th-success-text)]'}`}>
                        {c.direction === 'outbound' ? '\u2197' : '\u2199'}
                      </span>
                      <span className="text-[var(--th-text-secondary)] shrink-0">
                        {new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-[var(--th-text-muted)] shrink-0 font-mono tabular-nums">
                        {c.duration_seconds ? formatDuration(c.duration_seconds) : '--'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        c.status === 'completed' ? 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]' :
                        c.status === 'failed' ? 'bg-[var(--th-error-bg)] text-[var(--th-error-text)]' :
                        'bg-[var(--th-surface)] text-[var(--th-text-muted)]'
                      }`}>{c.status}</span>
                      <svg className={`w-3.5 h-3.5 text-[var(--th-text-muted)] transition-transform ${expandedHistoryCall === c.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </button>
                  {c.summary && (
                    <div className="px-2.5 pb-1.5 text-[11px] text-[var(--th-text-secondary)] leading-snug">{c.summary}</div>
                  )}
                  {expandedHistoryCall === c.id && (
                    <div className="px-2.5 pb-2.5 border-t border-[var(--th-border-light)]">
                      {expandedTranscript === null ? (
                        <div className="py-2 text-[11px] text-[var(--th-text-muted)]">Loading...</div>
                      ) : expandedTranscript.length === 0 ? (
                        <div className="py-2 text-[11px] text-[var(--th-text-muted)]">No transcript</div>
                      ) : (
                        <div className="py-2 space-y-1 max-h-40 overflow-y-auto">
                          {expandedTranscript.map((entry, i) => (
                            <div key={i} className="text-[11px]">
                              <span className={`font-semibold ${entry.role === 'agent' || entry.role === 'operator' ? 'text-[var(--th-primary-text)]' : 'text-[var(--th-text-dark)]'}`}>
                                {entry.role === 'agent' || entry.role === 'operator' ? t('dialer.you') : t('dialer.them')}:
                              </span>{' '}
                              <span className="text-[var(--th-text-secondary)]">{entry.content}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Translation selector moved inline next to language */}
      </div>

      {/* ──── Right: Transcript ──── */}
      <div className="flex-1 flex flex-col rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
        <div className="px-5 py-3.5 border-b border-[var(--th-border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('dialer.transcript')}</h3>
          {transcript.length > 0 && (
            <span className="text-[11px] text-[var(--th-text-muted)] bg-[var(--th-surface)] px-2 py-0.5 rounded-md">
              {transcript.filter(e => e.isFinal).length} messages
            </span>
          )}
        </div>

        {/* Copilot suggestions */}
        {suggestions.length > 0 && callState === 'in_call' && (
          <div className="px-5 py-3 border-b border-[var(--th-border)] bg-[var(--th-info-bg)]">
            <div className="text-[10px] font-semibold text-[var(--th-info-text)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Suggested responses
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => navigator.clipboard.writeText(s.text)}
                  className="text-left px-3 py-2 rounded-xl bg-[var(--th-card)] border border-[var(--th-info-border)] hover:border-[var(--th-info-text)] transition-all text-xs group hover:shadow-[0_2px_8px_rgba(59,130,246,0.1)]"
                  title="Click to copy"
                >
                  <span className="text-[var(--th-text)] font-medium">{s.text}</span>
                  <span className="block text-[var(--th-text-muted)] mt-0.5 text-[10px]">{s.translation}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {transcript.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-16 h-16 rounded-2xl bg-[var(--th-primary-bg)] flex items-center justify-center text-[var(--th-primary-text)]">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[var(--th-text-secondary)] text-center">{t('dialer.noTranscript')}</p>
              <p className="text-[11px] text-[var(--th-text-muted)] text-center max-w-[240px]">{t('dialer.noTranscriptHint')}</p>
            </div>
          ) : (
            transcript.map((entry, i) => (
              <div key={i} className={`flex ${entry.speaker === 'operator' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    entry.speaker === 'operator'
                      ? 'bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 text-white shadow-[0_2px_8px_rgba(99,102,241,0.25)]'
                      : 'bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)]'
                  } ${!entry.isFinal ? 'opacity-40' : ''} transition-opacity`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                      {entry.speaker === 'operator' ? t('dialer.you') : t('dialer.them')}
                    </span>
                    <span className="text-[10px] opacity-40">{formatTime(entry.timestamp)}</span>
                  </div>
                  {entry.translated ? (
                    <>
                      <p className="text-sm leading-relaxed font-medium">{entry.translated}</p>
                      <p className="text-xs mt-1 opacity-40 italic">{entry.text}</p>
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed">{entry.text}</p>
                  )}
                  {entry.correction && (
                    <p className={`text-xs mt-1.5 border-t pt-1.5 ${
                      entry.speaker === 'operator'
                        ? 'border-white/15 text-amber-200'
                        : 'border-[var(--th-border)] text-[var(--th-warning-text)]'
                    }`}>
                      <span className="font-semibold">Better:</span> {entry.correction}
                      {entry.correctionExplanation && (
                        <span className="opacity-50 ml-1">({entry.correctionExplanation})</span>
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
    </div>
  );
}
