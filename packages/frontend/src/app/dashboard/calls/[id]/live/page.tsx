'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { useT } from '@/lib/i18n';

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

interface AgentProfile {
  id: string;
  name: string;
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
  completed:   'bg-green-100 text-green-700',
  failed:      'bg-red-100 text-red-700',
  in_progress: 'bg-blue-100 text-blue-700',
  initiated:   'bg-purple-100 text-purple-700',
  ringing:     'bg-yellow-100 text-yellow-700',
  cancelled:   'bg-gray-100 text-gray-500',
  no_answer:   'bg-orange-100 text-orange-600',
};

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
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // ─── Load call detail ───────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    api.get<CallDetail>(`/calls/${callId}/detail`)
      .then(r => {
        setCallData(r.call);
        if (r.session?.transcript && Array.isArray(r.session.transcript)) {
          setTranscript(normalizeTranscript(r.session.transcript));
        }
        // Load agent name
        if (r.call.agent_profile_id) {
          api.get<AgentProfile>(`/agents/${r.call.agent_profile_id}`)
            .then(a => setAgentName(a.name))
            .catch(() => {});
        }
        // Load caller history
        const phone = r.call.direction === 'outbound' ? r.call.to_number : r.call.from_number;
        if (phone) {
          api.get<CallerHistory>(`/calls/by-phone/${encodeURIComponent(phone)}`)
            .then(h => {
              setCallerHistory((h.calls ?? []).filter(c => c.id !== callId));
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

    const handleTranscript = (data: { call_id: string; entry: RawTranscriptEntry }) => {
      if (data.call_id !== callId) return;
      const entry = normalizeTranscript([data.entry])[0];
      setTranscript(prev => [...prev, entry]);
    };

    const handleStatus = (data: { call_id: string; status: string }) => {
      if (data.call_id !== callId) return;
      setCallData(prev => prev ? { ...prev, status: data.status } : prev);
    };

    socket.on('call:transcript', handleTranscript);
    socket.on('call:status', handleStatus);

    return () => {
      socket.off('call:transcript', handleTranscript);
      socket.off('call:status', handleStatus);
    };
  }, [socket, callId]);

  // ─── Auto-scroll transcript ─────────────────────────────────────────────

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ─── Translation ────────────────────────────────────────────────────────

  const translateEntry = useCallback(async (entry: TranscriptEntry, targetLang: string): Promise<string> => {
    try {
      const res = await api.post<{ translated: string }>('/translate', {
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

  const toggleVoiceInput = useCallback(() => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const text = event.results[0]?.[0]?.transcript ?? '';
      if (text) setInstruction(prev => prev + (prev ? ' ' : '') + text);
      setListening(false);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening]);

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
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!callData) {
    return (
      <div className="p-8 text-center text-[#64748b]">
        Call not found.
        <button onClick={() => router.push('/dashboard/calls')} className="ml-2 text-[#6366f1] hover:underline">
          {t('live.back')}
        </button>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/calls')}
          className="p-2 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-[#0f172a]">{t('live.title')}</h1>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[callData.status] ?? 'bg-gray-100 text-gray-500'}`}>
          {callData.status === 'ringing' ? t('live.waiting') : callData.status}
        </span>
        {isActive && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* ─── Left Column: Caller Info (40%) ───────────────────────────── */}
        <div className="w-full lg:w-2/5 space-y-4">

          {/* Caller card */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide">{t('live.callerInfo')}</h2>
            <div className="text-2xl font-bold text-[#0f172a]">{fromNumber}</div>
            {agentName && (
              <div className="flex items-center gap-1.5 text-sm text-[#64748b]">
                <span>{t('realtime.agent')}:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#6366f1]/10 text-[#6366f1] text-xs font-medium">
                  {agentName}
                </span>
              </div>
            )}
          </div>

          {/* Memory facts */}
          {memoryFacts.length > 0 && (
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide">{t('live.memoryFacts')}</h2>
              <ul className="space-y-1.5">
                {memoryFacts.map((fact, i) => (
                  <li key={i} className="text-sm text-[#334155] flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#6366f1] shrink-0" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Call history accordion */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide">{t('live.callHistory')}</h2>
            {callerHistory.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">{t('live.noHistory')}</p>
            ) : (
              <div className="space-y-2">
                {callerHistory.slice(0, 10).map(pastCall => (
                  <div key={pastCall.id} className="border border-[#f1f5f9] rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleExpandCall(pastCall.id)}
                      className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#f8fafc] transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-[#64748b] shrink-0">{fmtDate(pastCall.created_at)}</span>
                        <span className="text-xs text-[#94a3b8]">{fmtDuration(pastCall.duration_seconds)}</span>
                      </div>
                      <svg
                        className={`w-4 h-4 text-[#94a3b8] shrink-0 transition-transform ${expandedCall === pastCall.id ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    {pastCall.summary && (
                      <div className="px-3 pb-2 text-xs text-[#64748b] line-clamp-2">{pastCall.summary}</div>
                    )}
                    {expandedCall === pastCall.id && (
                      <div className="px-3 pb-3 border-t border-[#f1f5f9]">
                        {expandedTranscript === null ? (
                          <div className="py-2 text-xs text-[#94a3b8]">{t('common.loading')}</div>
                        ) : expandedTranscript.length === 0 ? (
                          <div className="py-2 text-xs text-[#94a3b8]">No transcript</div>
                        ) : (
                          <div className="py-2 space-y-1.5 max-h-48 overflow-y-auto">
                            {expandedTranscript.map((entry, i) => (
                              <div key={i} className="text-xs">
                                <span className={`font-medium ${entry.role === 'agent' ? 'text-[#6366f1]' : 'text-[#334155]'}`}>
                                  {entry.role === 'agent' ? 'Agent' : 'Caller'}:
                                </span>{' '}
                                <span className="text-[#475569]">{entry.content}</span>
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

        {/* ─── Right Column: Live Transcript (60%) ──────────────────────── */}
        <div className="w-full lg:w-3/5 flex flex-col bg-white rounded-xl border border-[#e2e8f0] overflow-hidden" style={{ minHeight: '500px' }}>

          {/* Transcript header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#f1f5f9]">
            <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide">{t('live.liveTranscript')}</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#64748b]">{t('live.language')}:</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="text-xs border border-[#e2e8f0] rounded-lg px-2 py-1 text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
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
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            {callData.status === 'ringing' && transcript.length === 0 && (
              <div className="flex items-center justify-center h-full text-sm text-[#94a3b8]">
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 mx-auto border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
                  <div>{t('live.waiting')}</div>
                </div>
              </div>
            )}

            {transcript.map((entry, i) => {
              if (entry.role === 'system') {
                return (
                  <div key={i} className="flex justify-center animate-[fadeIn_0.3s_ease-out]">
                    <div className="px-3 py-1.5 rounded-full bg-[#fef3c7] text-[#92400e] text-xs font-medium">
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
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      isAgent
                        ? 'bg-[#6366f1] text-white rounded-br-md'
                        : 'bg-[#f1f5f9] text-[#0f172a] rounded-bl-md'
                    }`}
                  >
                    <div className="text-sm leading-relaxed">{displayText}</div>
                    {language !== 'original' && entry.translated && (
                      <div className={`text-xs mt-1 ${isAgent ? 'text-white/60' : 'text-[#94a3b8]'}`}>
                        {entry.content}
                      </div>
                    )}
                    {entry.timestamp && (
                      <div className={`text-[10px] mt-1 ${isAgent ? 'text-white/50' : 'text-[#94a3b8]'}`}>
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
            <div className="px-5 py-3 border-t border-[#f1f5f9] bg-[#f8fafc]">
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[callData.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {t('live.callEnded')}
                </span>
                {callData.duration_seconds && (
                  <span className="text-[#64748b] text-xs">{fmtDuration(callData.duration_seconds)}</span>
                )}
              </div>
            </div>
          )}

          {/* Instruction input */}
          {isActive && (
            <div className="px-4 py-3 border-t border-[#f1f5f9] flex items-center gap-2">
              <button
                onClick={toggleVoiceInput}
                className={`p-2 rounded-lg transition-colors ${
                  listening
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a]'
                }`}
                title={t('live.voiceInput')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </button>
              <input
                type="text"
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendInstruction()}
                placeholder={t('live.sendInstruction')}
                className="flex-1 px-4 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
              />
              <button
                onClick={sendInstruction}
                disabled={!instruction.trim()}
                className="px-4 py-2 bg-[#6366f1] text-white text-sm font-medium rounded-lg hover:bg-[#4f46e5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('live.send')}
              </button>
            </div>
          )}
        </div>
      </div>

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
