'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { useCallAudio, type AudioChannel } from '@/lib/use-call-audio';
import { useTwilioDevice } from '@/lib/use-twilio-device';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TranscriptEntry {
  role: 'agent' | 'caller' | 'system';
  content: string;
  translated?: string;
  timestamp?: string;
}

interface RawTranscriptEntry {
  speaker?: string;
  role?: string;
  text?: string;
  content?: string;
  timestamp?: string;
}

interface CallData {
  id: string;
  direction: string;
  status: string;
  from_number: string;
  to_number: string;
  duration_seconds: number | null;
  summary: string | null;
  agent_profile_id: string | null;
  created_at: string;
}

interface AiSession {
  transcript: RawTranscriptEntry[] | null;
  summary: string | null;
}

interface CallDetail {
  call: CallData;
  session: AiSession | null;
  events: unknown[];
}

interface PastCall {
  id: string;
  status: string;
  direction: string;
  created_at: string;
  duration_seconds: number | null;
  summary: string | null;
  from_number: string;
  to_number: string;
}

interface CallerHistory {
  calls: PastCall[];
  memory_facts?: string[];
}

interface SkillPack {
  id: string;
  name: string;
  intent: string;
  conversation_rules: string;
}

interface AgentProfile {
  id: string;
  name: string;
  display_name?: string;
  skill_packs?: SkillPack[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeTranscript(raw: RawTranscriptEntry[]): TranscriptEntry[] {
  return raw.map(entry => ({
    role: (entry.role ?? entry.speaker ?? 'caller') as TranscriptEntry['role'],
    content: entry.content ?? entry.text ?? '',
    timestamp: entry.timestamp,
  }));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDuration(s: number | null) {
  if (!s) return '--';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const STATUS_COLORS: Record<string, string> = {
  completed:   'bg-[var(--th-success-bg)] text-[var(--th-success-text)]',
  failed:      'bg-[var(--th-error-bg)] text-[var(--th-error-text)]',
  in_progress: 'bg-[var(--th-info-bg)] text-[var(--th-info-text)]',
  initiated:   'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]',
  ringing:     'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]',
  cancelled:   'bg-[var(--th-surface)] text-[var(--th-text-muted)]',
  no_answer:   'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]',
};

const TONE_PRESETS = [
  { key: 'formal', emoji: '🤝', labelKey: 'live.toneFormal', instruction: 'Switch your communication style to formal and professional. Use polite language, avoid slang.' },
  { key: 'friendly', emoji: '😊', labelKey: 'live.toneFriendly', instruction: 'Switch your communication style to warm and friendly. Be casual, use humor where appropriate.' },
  { key: 'urgent', emoji: '⚡', labelKey: 'live.toneUrgent', instruction: 'Switch to urgent mode. Be direct, concise, focus on solving the problem quickly.' },
];

const LANGUAGES = [
  { value: 'original', labelKey: 'live.original' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
  { value: 'es', label: 'Spanish' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function LiveCallPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const { socket } = useSocket();
  const toast = useToast();
  const callId = params.id as string;

  // Call data
  const [callData, setCallData] = useState<CallData | null>(null);
  const [agentName, setAgentName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Transcript
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Caller history
  const [callerHistory, setCallerHistory] = useState<PastCall[]>([]);
  const [memoryFacts, setMemoryFacts] = useState<string[]>([]);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState<TranscriptEntry[] | null>(null);

  // Language / translation
  const [language, setLanguage] = useState('original');

  // Instruction input
  const [instruction, setInstruction] = useState('');
  const [activeTone, setActiveTone] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Agent skill packs
  const [agentSkills, setAgentSkills] = useState<SkillPack[]>([]);

  // Call audio listening
  const { isListening, channel: audioChannel, volume: audioVolume, startListening, stopListening, setChannel: setAudioChannel, setVolume: setAudioVolume } = useCallAudio(callId);

  // Twilio Device for browser takeover
  const { isReady: deviceReady, activeCall: twilioCall, isMuted, initDevice, hangup: twilioHangup, toggleMute } = useTwilioDevice();

  // Takeover
  const [showTakeover, setShowTakeover] = useState(false);
  const [takeoverPhone, setTakeoverPhone] = useState('');
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const [operatorConnected, setOperatorConnected] = useState(false);
  const [takeoverMode, setTakeoverMode] = useState<'browser' | 'phone'>('browser');

  // ─── Load call detail ───────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    api.get<CallDetail>(`/calls/${callId}/detail`)
      .then(r => {
        setCallData(r.call);
        if (r.session?.transcript && Array.isArray(r.session.transcript)) {
          setTranscript(normalizeTranscript(r.session.transcript));
        }
        // Load agent name + skill packs
        if (r.call.agent_profile_id) {
          api.get<AgentProfile>(`/agents/${r.call.agent_profile_id}`)
            .then(a => {
              setAgentName(a.display_name || a.name);
              setAgentSkills(a.skill_packs || []);
            })
            .catch(() => {});
        }
        // Load caller history
        const phone = r.call.direction === 'outbound' ? r.call.to_number : r.call.from_number;
        if (phone) {
          api.get<CallerHistory>(`/calls/by-phone/${encodeURIComponent(phone)}`)
            .then(h => {
              setCallerHistory((h.calls ?? []).filter(c => c && c.id !== callId));
              setMemoryFacts(h.memory_facts ?? []);
            })
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [callId]);

  // ─── Socket.IO ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !callId) return;

    socket.emit('call:join', { call_id: callId });

    const handleTranscript = (data: { call_id: string; speaker: string; text: string; timestamp: string; isFinal: boolean }) => {
      if (data.call_id !== callId) return;
      const entry = normalizeTranscript([{ speaker: data.speaker, text: data.text, timestamp: data.timestamp }])[0];
      if (entry?.content) setTranscript(prev => [...prev, entry]);
    };

    const handleStatus = (data: { call_id: string; status: string }) => {
      if (data.call_id !== callId) return;
      setCallData(prev => prev ? { ...prev, status: data.status } : prev);
    };

    const handleTakeoverStarted = (data: { call_id: string; mode: string }) => {
      if (data.call_id !== callId) return;
      setOperatorConnected(true);
    };

    socket.on('call:transcript', handleTranscript);
    socket.on('call:status', handleStatus);
    socket.on('call:takeover:started', handleTakeoverStarted);

    return () => {
      socket.off('call:transcript', handleTranscript);
      socket.off('call:status', handleStatus);
      socket.off('call:takeover:started', handleTakeoverStarted);
    };
  }, [socket, callId]);

  // ─── Auto-scroll transcript (only when new messages arrive, not on translation) ─────

  const prevTranscriptLen = useRef(0);
  useEffect(() => {
    // Only scroll when new entries are added, not when existing entries are updated (translation)
    if (transcript.length > prevTranscriptLen.current) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    prevTranscriptLen.current = transcript.length;
  }, [transcript.length]);

  // ─── Translation ────────────────────────────────────────────────────────

  const translateEntry = useCallback(async (entry: TranscriptEntry, targetLang: string): Promise<string> => {
    try {
      const res = await api.post<{ translated: string }>('/calls/translate', {
        text: entry.content,
        target_language: targetLang,
      });
      return res.translated;
    } catch {
      return entry.content;
    }
  }, []);

  // Translate new entries when language changes
  useEffect(() => {
    if (language === 'original') return;
    const untranslated = transcript.filter(e => !e.translated && e.role !== 'system');
    if (untranslated.length === 0) return;

    (async () => {
      const updated = [...transcript];
      for (const entry of untranslated) {
        const idx = updated.indexOf(entry);
        if (idx >= 0) {
          const translated = await translateEntry(entry, language);
          updated[idx] = { ...updated[idx], translated };
        }
      }
      setTranscript(updated);
    })();
  }, [language, transcript.length]);

  // ─── Send instruction ───────────────────────────────────────────────────

  const sendInstruction = useCallback(() => {
    if (!instruction.trim() || !socket) return;
    socket.emit('call:instruction', { call_id: callId, text: instruction.trim() });
    setTranscript(prev => [...prev, {
      role: 'system' as const,
      content: instruction.trim(),
      timestamp: new Date().toISOString(),
    }]);
    setInstruction('');
  }, [instruction, socket, callId]);

  // ─── Voice input (Web Speech API) ───────────────────────────────────────

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleVoiceInput = useCallback(() => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;        // Keep listening until manually stopped
    recognition.interimResults = true;    // Show partial results
    recognition.lang = '';                // Auto-detect language

    // Reset silence timer on each result
    const resetSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        // 10 seconds of silence → auto stop
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          setListening(false);
        }
      }, 10000);
    };

    recognition.onresult = (event: any) => {
      resetSilenceTimer();
      // Get the latest final result
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0]?.transcript?.trim() ?? '';
          if (text) setInstruction(prev => prev + (prev ? ' ' : '') + text);
        }
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech') setListening(false);
    };

    // Auto-restart if browser stops (some browsers stop after silence)
    recognition.onend = () => {
      if (listening && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { setListening(false); }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    resetSilenceTimer();
    toast.info(t('live.voiceInput'));
  }, [listening, t]);

  // ─── Takeover handler ───────────────────────────────────────────────────

  const handleBrowserTakeover = useCallback(async () => {
    setTakeoverLoading(true);
    try {
      // Init Twilio Device first so it's ready to receive the incoming call
      await initDevice();
      // Stop audio listening to avoid echo
      if (isListening) stopListening();
      await api.post(`/calls/${callId}/takeover`, { mode: 'browser' });
      setShowTakeover(false);
      toast.success(t('live.operatorConnected'));
    } catch (e: any) {
      toast.error(e.message || 'Browser takeover failed');
    } finally {
      setTakeoverLoading(false);
    }
  }, [callId, initDevice, isListening, stopListening, toast, t]);

  const handleTakeover = useCallback(async () => {
    if (!takeoverPhone.trim()) return;
    setTakeoverLoading(true);
    try {
      await api.post(`/calls/${callId}/takeover`, { mode: 'phone', phone_number: takeoverPhone });
      setShowTakeover(false);
      toast.success(t('live.operatorConnected'));
    } catch (e: any) {
      toast.error(e.message || 'Takeover failed');
    } finally {
      setTakeoverLoading(false);
    }
  }, [takeoverPhone, callId, toast, t]);

  // ─── Expand past call transcript ────────────────────────────────────────

  const toggleExpandCall = useCallback((pastCallId: string) => {
    if (expandedCall === pastCallId) {
      setExpandedCall(null);
      setExpandedTranscript(null);
      return;
    }
    setExpandedCall(pastCallId);
    setExpandedTranscript(null);
    api.get<CallDetail>(`/calls/${pastCallId}/detail`)
      .then(r => {
        if (r.session?.transcript && Array.isArray(r.session.transcript)) {
          setExpandedTranscript(normalizeTranscript(r.session.transcript));
        }
      })
      .catch(() => {});
  }, [expandedCall]);

  // ─── Derived ────────────────────────────────────────────────────────────

  const isActive = callData?.status === 'ringing' || callData?.status === 'in_progress';
  const fromNumber = callData
    ? (callData.direction === 'outbound' ? callData.to_number : callData.from_number)
    : '';

  // ─── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-[var(--th-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!callData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-14 h-14 bg-[var(--th-surface)] rounded-2xl flex items-center justify-center text-[var(--th-text-muted)]">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 3.75v4.5m0-4.5h-4.5m4.5 0l-6 6m3 12c-8.284 0-15-6.716-15-15 0-1.372.185-2.702.53-3.965.214-.784 1.109-1.285 1.94-1.285H6.75l2.474 4.015a1.19 1.19 0 01-.11 1.335l-1.56 1.873a12.02 12.02 0 006.274 6.274l1.873-1.56a1.19 1.19 0 011.335-.11L21.75 12v2.25" /></svg>
        </div>
        <p className="text-sm font-medium text-[var(--th-text-secondary)]">Call not found</p>
        <button onClick={() => router.push('/dashboard/calls')} className="text-xs text-[var(--th-primary-text)] hover:underline font-medium">
          {t('live.back')}
        </button>
      </div>
    );
  }

  const selectCls = 'text-xs border border-[var(--th-card-border-subtle)] rounded-lg px-2.5 py-1.5 bg-[var(--th-card)] text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors appearance-none cursor-pointer';

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 shrink-0 mb-4">
        <button
          onClick={() => router.push('/dashboard/calls')}
          className="p-2 rounded-xl hover:bg-[var(--th-surface)] text-[var(--th-text-secondary)] hover:text-[var(--th-text)] transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-[var(--th-text)]">{t('live.title')}</h1>
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${STATUS_COLORS[callData.status] ?? 'bg-[var(--th-surface)] text-[var(--th-text-muted)]'}`}>
          {callData.status === 'ringing' ? t('live.waiting') : callData.status}
        </span>
        {isActive && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
        )}
        {operatorConnected && (
          <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]">
            {t('live.operatorConnected')}
          </span>
        )}
        {isActive && (
          <div className="ml-auto flex items-center gap-2">
            {/* Listen button */}
            <button
              onClick={() => isListening ? stopListening() : startListening('both')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded-lg transition-all ${
                isListening
                  ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white shadow-[0_2px_8px_rgba(99,102,241,0.3)]'
                  : 'bg-[var(--th-surface)] text-[var(--th-text-secondary)] hover:bg-[var(--th-primary-bg)] hover:text-[var(--th-primary-text)] border border-[var(--th-card-border-subtle)]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
              {isListening ? 'Listening' : 'Listen'}
              {isListening && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
            </button>

            {/* Channel & volume (when listening) */}
            {isListening && (
              <>
                <select
                  value={audioChannel}
                  onChange={e => setAudioChannel(e.target.value as AudioChannel)}
                  className={selectCls}
                >
                  <option value="both">Both</option>
                  <option value="caller">Caller</option>
                  <option value="agent">Agent</option>
                </select>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={audioVolume}
                  onChange={e => setAudioVolume(parseFloat(e.target.value))}
                  className="w-16 h-1 accent-[var(--th-primary)]"
                />
              </>
            )}

            {/* Translate in new tab */}
            <button
              onClick={() => window.open(`/dashboard/calls/${callId}/translate`, '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-[var(--th-surface)] text-[var(--th-text-secondary)] hover:bg-[var(--th-info-bg)] hover:text-[var(--th-info-text)] border border-[var(--th-card-border-subtle)] transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
              </svg>
              Translate
            </button>

            {/* Take Over */}
            {!operatorConnected && (
              <button
                onClick={() => setShowTakeover(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] font-semibold rounded-lg hover:from-red-600 hover:to-red-700 shadow-[0_2px_8px_rgba(239,68,68,0.3)] transition-all"
              >
                {t('live.takeOver')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Two-column layout ──────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 min-h-0 flex-1">

        {/* ─── Left Column: Caller Info (40%) ─────────────────────────── */}
        <div className="w-full lg:w-2/5 space-y-4 lg:overflow-y-auto min-h-0">

          {/* Caller card */}
          <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 space-y-3 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-[var(--th-primary)] opacity-[0.04]" />
            <h2 className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{t('live.callerInfo')}</h2>
            <div className="text-2xl font-bold text-[var(--th-text)] tabular-nums">{fromNumber}</div>
            {agentName && (
              <div className="flex items-center gap-1.5 text-sm text-[var(--th-text-secondary)]">
                <span>{t('realtime.agent')}:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--th-primary-bg)] text-[var(--th-primary-text)] text-[10px] font-semibold">
                  {agentName}
                </span>
              </div>
            )}
          </div>

          {/* Memory facts */}
          {memoryFacts.length > 0 && (
            <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 space-y-3 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
              <h2 className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                {t('live.memoryFacts')}
              </h2>
              <ul className="space-y-2">
                {memoryFacts.map((fact, i) => (
                  <li key={i} className="text-sm text-[var(--th-text)] flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--th-primary)] shrink-0" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Call history accordion */}
          <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 space-y-3 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
            <h2 className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {t('live.callHistory')}
            </h2>
            {callerHistory.length === 0 ? (
              <p className="text-sm text-[var(--th-text-muted)]">{t('live.noHistory')}</p>
            ) : (
              <div className="space-y-2">
                {callerHistory.slice(0, 10).map(pastCall => (
                  <div key={pastCall.id} className="border border-[var(--th-card-border-subtle)] rounded-xl overflow-hidden transition-all hover:border-[var(--th-border)]">
                    <button
                      onClick={() => toggleExpandCall(pastCall.id)}
                      className="w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-[var(--th-surface)] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs text-[var(--th-text)] font-medium shrink-0">{fmtDate(pastCall.created_at)}</span>
                        <span className="text-[10px] text-[var(--th-text-muted)] font-medium tabular-nums">{fmtDuration(pastCall.duration_seconds)}</span>
                      </div>
                      <svg
                        className={`w-4 h-4 text-[var(--th-text-muted)] shrink-0 transition-transform duration-200 ${expandedCall === pastCall.id ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    {pastCall.summary && (
                      <div className="px-3.5 pb-2.5 text-xs text-[var(--th-text-secondary)] leading-relaxed">{pastCall.summary}</div>
                    )}
                    {expandedCall === pastCall.id && (
                      <div className="px-3.5 pb-3 border-t border-[var(--th-card-border-subtle)]">
                        {expandedTranscript === null ? (
                          <div className="py-3 flex justify-center">
                            <div className="w-4 h-4 border-2 border-[var(--th-primary)] border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : expandedTranscript.length === 0 ? (
                          <div className="py-2 text-xs text-[var(--th-text-muted)]">{t('calls.noTranscript')}</div>
                        ) : (
                          <div className="py-2 space-y-1.5 max-h-48 overflow-y-auto">
                            {expandedTranscript.map((entry, i) => (
                              <div key={i} className="text-xs">
                                <span className={`font-semibold ${entry.role === 'agent' ? 'text-[var(--th-primary-text)]' : 'text-[var(--th-text)]'}`}>
                                  {entry.role === 'agent' ? t('live.agentRole') : t('live.callerRole')}:
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
            )}
          </div>
        </div>

        {/* ─── Right Column: Live Transcript (60%) ────────────────────── */}
        <div className="w-full lg:w-3/5 flex flex-col bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] overflow-hidden min-h-0 flex-1 lg:flex-none lg:h-full shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">

          {/* Transcript header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--th-card-border-subtle)]">
            <h2 className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{t('live.liveTranscript')}</h2>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{t('live.language')}:</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className={selectCls}
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.value} value={lang.value}>
                    {lang.labelKey ? t(lang.labelKey) : lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Transcript body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {callData.status === 'ringing' && transcript.length === 0 && (
              <div className="flex items-center justify-center h-full text-sm text-[var(--th-text-muted)]">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 mx-auto border-2 border-[var(--th-primary)] border-t-transparent rounded-full animate-spin" />
                  <div className="text-sm font-medium">{t('live.waiting')}</div>
                </div>
              </div>
            )}

            {transcript.map((entry, i) => {
              if (entry.role === 'system') {
                return (
                  <div key={i} className="flex justify-center animate-[fadeIn_0.3s_ease-out]">
                    <div className="px-3.5 py-1.5 rounded-full bg-[var(--th-warning-bg)] text-[var(--th-warning-text)] text-[10px] font-semibold flex items-center gap-1.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                      {t('live.instructionSent')}: {entry.content}
                    </div>
                  </div>
                );
              }

              const isAgent = entry.role === 'agent';
              const displayText = language !== 'original' && entry.translated ? entry.translated : entry.content;

              return (
                <div
                  key={i}
                  className={`flex ${isAgent ? 'justify-end' : 'justify-start'} animate-[fadeIn_0.3s_ease-out]`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-[0_1px_3px_var(--th-shadow)] ${
                      isAgent
                        ? 'bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 text-white rounded-br-md'
                        : 'bg-[var(--th-surface)] text-[var(--th-text)] rounded-bl-md border border-[var(--th-card-border-subtle)]'
                    }`}
                  >
                    <div className="text-sm leading-relaxed">{displayText}</div>
                    {language !== 'original' && entry.translated && (
                      <div className={`text-[10px] mt-1 ${isAgent ? 'text-white/60' : 'text-[var(--th-text-muted)]'}`}>
                        {entry.content}
                      </div>
                    )}
                    {entry.timestamp && (
                      <div className={`text-[10px] mt-1 ${isAgent ? 'text-white/50' : 'text-[var(--th-text-muted)]'}`}>
                        {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={transcriptEndRef} />
          </div>

          {/* Call ended banner */}
          {!isActive && callData.status !== 'initiated' && (
            <div className="px-5 py-3 border-t border-[var(--th-card-border-subtle)] bg-[var(--th-surface)]">
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[callData.status] ?? 'bg-[var(--th-surface)] text-[var(--th-text-muted)]'}`}>
                  {t('live.callEnded')}
                </span>
                {callData.duration_seconds && (
                  <span className="text-[var(--th-text-secondary)] text-xs tabular-nums font-medium">{fmtDuration(callData.duration_seconds)}</span>
                )}
              </div>
            </div>
          )}

          {/* Quick action buttons */}
          {isActive && (
            <div className="flex gap-2 overflow-x-auto px-4 py-2.5 border-t border-[var(--th-card-border-subtle)]">
              {TONE_PRESETS.map(tone => (
                <button
                  key={tone.key}
                  onClick={() => {
                    socket?.emit('call:instruction', { call_id: callId, text: tone.instruction });
                    setActiveTone(tone.key);
                    toast.success(`${tone.emoji} ${t(tone.labelKey)}`);
                    setTimeout(() => setActiveTone(prev => prev === tone.key ? null : prev), 5000);
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                    activeTone === tone.key
                      ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white shadow-[0_2px_8px_rgba(99,102,241,0.3)]'
                      : 'border border-[var(--th-card-border-subtle)] text-[var(--th-primary-text)] hover:bg-[var(--th-primary-bg)] hover:border-[var(--th-primary)]'
                  }`}
                >
                  {tone.emoji} {t(tone.labelKey)}
                </button>
              ))}
              {agentSkills.map(skill => (
                <button
                  key={skill.id}
                  onClick={() => {
                    socket?.emit('call:instruction', { call_id: callId, text: skill.conversation_rules || skill.intent });
                    toast.info(`Sent: ${skill.name}`);
                  }}
                  className="shrink-0 px-3 py-1.5 bg-[var(--th-surface)] border border-[var(--th-card-border-subtle)] rounded-lg text-[10px] font-semibold text-[var(--th-text-secondary)] hover:bg-[var(--th-primary-bg)] hover:border-[var(--th-primary)] hover:text-[var(--th-primary-text)] transition-all"
                  title={skill.intent}
                >
                  {skill.name}
                </button>
              ))}
              <button
                onClick={() => {
                  socket?.emit('call:instruction', { call_id: callId, text: 'Politely wrap up the conversation and end the call.' });
                }}
                className="shrink-0 px-3 py-1.5 bg-[var(--th-error-bg)] border border-transparent rounded-lg text-[10px] font-semibold text-[var(--th-error-text)] hover:shadow-[0_2px_8px_rgba(239,68,68,0.15)] transition-all"
              >
                {t('live.endCall')}
              </button>
            </div>
          )}

          {/* Instruction input */}
          {isActive && (
            <div className="px-4 py-3 border-t border-[var(--th-card-border-subtle)] flex items-center gap-2">
              <button
                onClick={toggleVoiceInput}
                className={`p-2.5 rounded-xl transition-all ${
                  listening
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-[0_2px_8px_rgba(239,68,68,0.3)]'
                    : 'hover:bg-[var(--th-surface)] text-[var(--th-text-secondary)] hover:text-[var(--th-text)] border border-[var(--th-card-border-subtle)]'
                }`}
                title={t('live.voiceInput')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </button>
              <input
                type="text"
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendInstruction()}
                placeholder={t('live.sendInstruction')}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
              />
              <button
                onClick={sendInstruction}
                disabled={!instruction.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white text-sm font-semibold rounded-xl hover:shadow-[0_2px_12px_rgba(99,102,241,0.3)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
              >
                {t('live.send')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Browser call controls (operator live bar) ──────────────────── */}
      {twilioCall && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.25),0_0_0_1px_var(--th-card-border-subtle)] backdrop-blur-sm px-6 py-3 flex items-center gap-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--th-success-text)]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            You are live
          </span>
          <button
            onClick={toggleMute}
            className={`p-2.5 rounded-xl transition-all ${isMuted ? 'bg-[var(--th-error-bg)] text-[var(--th-error-text)]' : 'bg-[var(--th-surface)] text-[var(--th-text-secondary)] hover:bg-[var(--th-primary-bg)]'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isMuted ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L17.591 17.591L5.409 5.409L4 4M12 18.75C8.136 18.75 5.25 15.864 5.25 12V10.5M18.75 10.5V12C18.75 12.847 18.601 13.659 18.327 14.411M12 15.75a3 3 0 01-2.818-1.932M12 15.75V4.5a3 3 0 013 3v3.75M12 18.75v3.75m-3.75 0h7.5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              )}
            </svg>
          </button>
          <button
            onClick={twilioHangup}
            className="p-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-[0_2px_8px_rgba(239,68,68,0.3)] transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15" />
            </svg>
          </button>
        </div>
      )}

      {/* ─── Takeover modal ─────────────────────────────────────────────── */}
      {showTakeover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowTakeover(false)}>
          <div className="bg-[var(--th-card)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--th-text)]">{t('live.takeOver')}</h3>
              <button onClick={() => setShowTakeover(false)} className="p-1.5 hover:bg-[var(--th-surface)] rounded-lg transition-colors text-[var(--th-text-muted)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-1 p-1 bg-[var(--th-surface)] rounded-xl">
              <button
                onClick={() => setTakeoverMode('browser')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${takeoverMode === 'browser' ? 'bg-[var(--th-card)] text-[var(--th-text)] shadow-[0_1px_3px_var(--th-shadow)]' : 'text-[var(--th-text-muted)]'}`}
              >
                Browser
              </button>
              <button
                onClick={() => setTakeoverMode('phone')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${takeoverMode === 'phone' ? 'bg-[var(--th-card)] text-[var(--th-text)] shadow-[0_1px_3px_var(--th-shadow)]' : 'text-[var(--th-text-muted)]'}`}
              >
                Phone
              </button>
            </div>

            {takeoverMode === 'browser' ? (
              <button
                onClick={handleBrowserTakeover}
                disabled={takeoverLoading}
                className="w-full px-4 py-3 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white text-sm font-semibold rounded-xl hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
                {takeoverLoading ? t('live.connecting') : 'Take Over via Browser'}
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={takeoverPhone}
                  onChange={e => setTakeoverPhone(e.target.value)}
                  placeholder={t('live.phoneNumber')}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
                />
                <button
                  onClick={handleTakeover}
                  disabled={!takeoverPhone.trim() || takeoverLoading}
                  className="px-4 py-2.5 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white text-sm font-semibold rounded-xl hover:shadow-[0_2px_12px_rgba(99,102,241,0.3)] disabled:opacity-40 transition-all"
                >
                  {t('live.connect')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSS animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(0.5rem); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
