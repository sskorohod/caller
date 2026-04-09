'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from '@/lib/i18n';
import { useSocket } from '@/lib/socket';
import { api } from '@/lib/api';

type Tab = 'settings' | 'sessions' | 'live';

interface TranslatorDefaults {
  greeting_text?: string;
  tts_voice_id?: string;
  tone?: string;
  personal_context?: string;
  my_language?: string;
  target_language?: string;
  translation_mode?: string;
}

interface Session {
  id: string;
  subscriber_id: string;
  call_id: string | null;
  duration_seconds: number;
  minutes_used: string;
  cost_usd: string;
  transcript: Array<{ speaker?: string; original?: string; translated?: string; text?: string; timestamp?: string }>;
  status: string;
  created_at: string;
}

interface ActiveSession {
  id: string;
  subscriber_id: string;
  call_id: string | null;
  duration_seconds: number;
  created_at: string;
  subscriber_name: string;
  subscriber_phone: string;
}

interface Subscriber {
  id: string;
  name: string;
}

interface TranslationEntry {
  speaker: string;
  original: string;
  translated: string;
  timestamp: string;
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
];

const VOICES = [
  { value: 'ara', label: 'Ara', gender: 'Female' },
  { value: 'eve', label: 'Eve', gender: 'Female' },
  { value: 'rex', label: 'Rex', gender: 'Male' },
  { value: 'sal', label: 'Sal', gender: 'Male' },
  { value: 'leo', label: 'Leo', gender: 'Male' },
];

const TONES = [
  { value: 'neutral', label: 'Neutral', desc: 'Natural translation, preserves original tone.' },
  { value: 'business', label: 'Business', desc: 'Formal, professional. Removes filler words (um, uh).' },
  { value: 'friendly', label: 'Friendly', desc: 'Warm, casual, conversational.' },
  { value: 'medical', label: 'Medical', desc: 'Precise medical terminology.' },
  { value: 'legal', label: 'Legal', desc: 'Precise legal terminology, formal tone.' },
];

const selectCls = "w-full px-3 py-2 rounded-xl border border-[var(--th-border)] bg-[var(--th-input)] text-[var(--th-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/30 focus:border-[var(--th-primary)] transition-all appearance-none";

export default function TranslatorPage() {
  const t = useT();
  const { socket } = useSocket();
  const [tab, setTab] = useState<Tab>('settings');

  // ─── Translator Phone Number ────────────────────────────────────
  const [translatorPhone, setTranslatorPhone] = useState<string | null>(null);

  useEffect(() => {
    api.get<Array<{ phone_number: string; ai_answering_enabled: boolean }>>('/telephony/connections')
      .then(conns => {
        const active = conns.find(c => c.ai_answering_enabled);
        if (active) setTranslatorPhone(active.phone_number);
      })
      .catch(() => {});
  }, []);

  // ─── Settings ──────────────────────────────────────────────────
  const [defaults, setDefaults] = useState<TranslatorDefaults>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<TranslatorDefaults>('/translator/defaults').then(setDefaults).catch(() => {});
  }, []);

  const saveDefaults = async () => {
    setSaving(true);
    try {
      const updated = await api.put<TranslatorDefaults>('/translator/defaults', defaults);
      setDefaults(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  // ─── Sessions ──────────────────────────────────────────────────
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subFilter, setSubFilter] = useState('');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const loadSessions = useCallback(() => {
    setSessionsLoading(true);
    const params = new URLSearchParams();
    if (subFilter) params.set('subscriber_id', subFilter);
    params.set('limit', '50');
    api.get<{ sessions: Session[] }>(`/translator/sessions?${params}`)
      .then(r => setSessions(r.sessions))
      .finally(() => setSessionsLoading(false));
  }, [subFilter]);

  useEffect(() => {
    if (tab === 'sessions') {
      loadSessions();
      api.get<{ subscribers: Subscriber[] }>('/translator/subscribers')
        .then(r => setSubscribers(r.subscribers.map(s => ({ id: s.id, name: s.name }))));
    }
  }, [tab, loadSessions]);

  // ─── Live Monitor ──────────────────────────────────────────────
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [liveCallId, setLiveCallId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<TranslationEntry[]>([]);
  const liveEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === 'live') {
      api.get<{ sessions: ActiveSession[] }>('/translator/sessions/active')
        .then(r => setActiveSessions(r.sessions));
    }
  }, [tab]);

  // Live transcript via Socket.IO
  useEffect(() => {
    if (!socket || !liveCallId) return;
    setLiveTranscript([]);

    socket.emit('call:translate:join', { call_id: liveCallId });

    const onTranslation = (data: { call_id: string; speaker: string; original: string; translated: string; timestamp: string }) => {
      if (data.call_id !== liveCallId) return;
      setLiveTranscript(prev => [...prev, { speaker: data.speaker, original: data.original, translated: data.translated, timestamp: data.timestamp }]);
    };

    socket.on('call:translation', onTranslation);

    return () => {
      socket.emit('call:translate:leave', { call_id: liveCallId });
      socket.off('call:translation', onTranslation);
    };
  }, [socket, liveCallId]);

  useEffect(() => {
    liveEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTranscript]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'settings', label: 'Settings' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'live', label: 'Live' },
  ];

  return (
    <div className="space-y-5">
      {/* Header + Phone + Tabs */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-[var(--th-text)]">Translator</h2>
        <div className="flex items-center gap-4">
          {translatorPhone && (
            <div className="text-right">
              <a href={`tel:${translatorPhone}`}
                className="text-2xl font-extrabold tracking-wide"
                style={{
                  background: 'linear-gradient(135deg, #a855f7, #7c3aed, #6d28d9)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 12px rgba(139,92,246,0.5)) drop-shadow(0 0 24px rgba(139,92,246,0.25))',
                }}>
                {translatorPhone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 ($1) $2-$3')}
              </a>
              <p className="text-[11px] text-[var(--th-text-muted)] mt-0.5">Call this number to connect the live translator</p>
            </div>
          )}
          <div className="flex rounded-xl border border-[var(--th-border)] overflow-hidden">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-medium transition-all ${tab === t.id
                  ? 'bg-[var(--th-primary)] text-white'
                  : 'text-[var(--th-text-muted)] hover:bg-[var(--th-card)]'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Settings Tab ──────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-6 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] space-y-6 max-w-2xl">
          <div>
            <h3 className="text-sm font-bold text-[var(--th-text)] mb-1">Translation Mode</h3>
            <p className="text-xs text-[var(--th-text-muted)] mb-3">How the translator processes speech during calls.</p>
            <div className="flex gap-3">
              {[
                { value: 'bidirectional', label: 'Bidirectional', desc: 'Both directions translated via voice. All participants hear translations.' },
                { value: 'unidirectional', label: 'Unidirectional', desc: 'Incoming speech → text on screen. Subscriber\'s speech → voice translation for the other party.' },
              ].map(m => (
                <button key={m.value}
                  onClick={() => setDefaults({ ...defaults, translation_mode: m.value })}
                  className="flex-1 p-3 rounded-xl border text-left transition-all"
                  style={defaults.translation_mode === m.value || (!defaults.translation_mode && m.value === 'bidirectional')
                    ? { borderColor: 'var(--th-primary)', background: 'rgba(99,102,241,0.06)' }
                    : { borderColor: 'var(--th-border)' }
                  }>
                  <div className="text-sm font-medium text-[var(--th-text)]">{m.label}</div>
                  <div className="text-[11px] mt-1 text-[var(--th-text-muted)]">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">Default My Language</label>
              <select value={defaults.my_language || 'ru'} onChange={e => setDefaults({ ...defaults, my_language: e.target.value })} className={selectCls}>
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">Default Target Language</label>
              <select value={defaults.target_language || 'en'} onChange={e => setDefaults({ ...defaults, target_language: e.target.value })} className={selectCls}>
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">Default Greeting Text</label>
            <textarea value={defaults.greeting_text || ''} onChange={e => setDefaults({ ...defaults, greeting_text: e.target.value })}
              placeholder="A live interpreter has joined this call. I will translate between your languages. Please speak naturally, then pause briefly after finishing your thought so I can translate. Let's begin."
              className={selectCls + ' min-h-[80px] resize-y'} rows={3} />
          </div>

          <div>
            <h3 className="text-sm font-bold text-[var(--th-text)] mb-1">Tone</h3>
            <p className="text-xs text-[var(--th-text-muted)] mb-3">Communication style for translations.</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {TONES.map(tone => (
                <button key={tone.value}
                  onClick={() => setDefaults({ ...defaults, tone: tone.value })}
                  className="p-3 rounded-xl border text-left transition-all"
                  style={(defaults.tone || 'neutral') === tone.value
                    ? { borderColor: 'var(--th-primary)', background: 'rgba(99,102,241,0.06)' }
                    : { borderColor: 'var(--th-border)' }
                  }>
                  <div className="text-sm font-medium text-[var(--th-text)]">{tone.label}</div>
                  <div className="text-[10px] mt-0.5 text-[var(--th-text-muted)]">{tone.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">Voice</label>
            <select value={defaults.tts_voice_id || 'eve'} onChange={e => setDefaults({ ...defaults, tts_voice_id: e.target.value })} className={selectCls}>
              <optgroup label="Female">
                {VOICES.filter(v => v.gender === 'Female').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </optgroup>
              <optgroup label="Male">
                {VOICES.filter(v => v.gender === 'Male').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </optgroup>
            </select>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[var(--th-text)] mb-1">Personal Context</h3>
            <p className="text-xs text-[var(--th-text-muted)] mb-3">Personal details the translator will use when relevant — names, insurance, addresses, etc.</p>
            <textarea value={defaults.personal_context || ''} onChange={e => setDefaults({ ...defaults, personal_context: e.target.value })}
              placeholder={"Name: John Smith (spell as \"John Smith\")\nDOB: March 15, 1990\nInsurance: Blue Cross, ID: XYZ123456\nPharmacy: CVS, 123 Main St, Austin TX\nAddress: 456 Oak Ave, Apt 2B, Austin TX 78701"}
              className={selectCls + ' min-h-[120px] resize-y font-mono text-xs'} rows={5} />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={saveDefaults} disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-primary-hover))' }}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {saved && <span className="text-sm text-[var(--th-success-text)]">Saved!</span>}
          </div>
        </div>
      )}

      {/* ─── Sessions Tab ──────────────────────────────────────── */}
      {tab === 'sessions' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-3">
            <select value={subFilter} onChange={e => setSubFilter(e.target.value)} className={selectCls + ' max-w-xs'}>
              <option value="">All Subscribers</option>
              {subscribers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Sessions list */}
          <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] overflow-hidden">
            {sessionsLoading ? (
              <div className="p-8 text-center opacity-50">Loading...</div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center opacity-50">No sessions found</div>
            ) : (
              <div className="divide-y divide-[var(--th-border)]">
                {sessions.map(session => {
                  const subName = subscribers.find(s => s.id === session.subscriber_id)?.name || 'Unknown';
                  const expanded = expandedSession === session.id;
                  return (
                    <div key={session.id}>
                      <button onClick={() => setExpandedSession(expanded ? null : session.id)}
                        className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-[var(--th-card)]/80 transition-all">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--th-text)]">{subName}</div>
                          <div className="text-xs text-[var(--th-text-muted)]">
                            {new Date(session.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-xs text-[var(--th-text-muted)] text-right shrink-0">
                          <div>{Math.floor((session.duration_seconds || 0) / 60)}:{String((session.duration_seconds || 0) % 60).padStart(2, '0')}</div>
                          <div className="font-mono">${parseFloat(session.cost_usd || '0').toFixed(4)}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${session.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-[var(--th-text-muted)]'}`}>
                          {session.status}
                        </span>
                        <svg className={`w-4 h-4 shrink-0 text-[var(--th-text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                      {expanded && (
                        <div className="px-5 pb-4 border-t border-[var(--th-border)]">
                          <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                            {(session.transcript || []).length === 0 ? (
                              <p className="text-xs text-[var(--th-text-muted)] py-4 text-center">No transcript available</p>
                            ) : session.transcript.map((entry, i) => {
                              const isYou = ['subscriber', 'you', 'operator'].includes(entry.speaker || '');
                              const label = entry.speaker === 'subscriber' ? 'You' : entry.speaker === 'other' ? 'Other party' : entry.speaker || 'speaker';
                              return (
                              <div key={i} className={`flex gap-2 ${isYou ? 'flex-row-reverse' : ''}`}>
                                <div className={`max-w-[75%] rounded-xl px-3 py-2 text-xs ${
                                  isYou
                                    ? 'bg-[var(--th-primary)]/15 text-[var(--th-text)]'
                                    : 'bg-[var(--th-input)] text-[var(--th-text)]'
                                }`}>
                                  <span className="font-bold text-[10px] uppercase text-[var(--th-text-muted)] block mb-0.5">{label}</span>
                                  <p>{entry.original || entry.text || ''}</p>
                                  {entry.translated && <p className="mt-1 opacity-70 italic">{entry.translated}</p>}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Live Monitor Tab ──────────────────────────────────── */}
      {tab === 'live' && (
        <div className="space-y-4">
          {activeSessions.length === 0 && !liveCallId ? (
            <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-12 text-center shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
              <svg className="w-12 h-12 mx-auto mb-3 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
              </svg>
              <p className="text-sm text-[var(--th-text-muted)]">No active translator sessions</p>
              <p className="text-xs text-[var(--th-text-muted)] mt-1 opacity-60">Sessions will appear here when subscribers make calls</p>
            </div>
          ) : liveCallId ? (
            /* Live transcript view */
            <div className="space-y-3">
              <button onClick={() => { setLiveCallId(null); setLiveTranscript([]); }}
                className="flex items-center gap-2 text-sm text-[var(--th-text-muted)] hover:text-[var(--th-text)] transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to sessions
              </button>
              <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--th-border)] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm font-medium text-[var(--th-text)]">Live Transcript</span>
                </div>
                <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto min-h-[200px]">
                  {liveTranscript.length === 0 && (
                    <p className="text-xs text-[var(--th-text-muted)] text-center py-8">Waiting for speech...</p>
                  )}
                  {liveTranscript.map((entry, i) => (
                    <div key={i} className={`flex gap-2 ${entry.speaker === 'caller' ? '' : 'flex-row-reverse'}`}>
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                        entry.speaker === 'caller'
                          ? 'bg-[var(--th-input)] text-[var(--th-text)]'
                          : 'bg-[var(--th-primary)]/15 text-[var(--th-text)]'
                      }`}>
                        <p>{entry.original}</p>
                        <p className="mt-1 text-xs opacity-70 italic">{entry.translated}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={liveEndRef} />
                </div>
              </div>
            </div>
          ) : (
            /* Active sessions list */
            <div className="grid gap-3">
              {activeSessions.map(session => (
                <div key={session.id}
                  className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-4 flex items-center gap-4 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
                  <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--th-text)]">{session.subscriber_name}</div>
                    <div className="text-xs text-[var(--th-text-muted)] font-mono">{session.subscriber_phone}</div>
                  </div>
                  <div className="text-xs text-[var(--th-text-muted)]">
                    {Math.floor((session.duration_seconds || 0) / 60)}:{String((session.duration_seconds || 0) % 60).padStart(2, '0')}
                  </div>
                  <button onClick={() => session.call_id && setLiveCallId(session.call_id)}
                    disabled={!session.call_id}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-30"
                    style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-primary-hover))' }}>
                    View Live
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
