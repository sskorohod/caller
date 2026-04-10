'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { io as socketIO, Socket } from 'socket.io-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Profile {
  id: string;
  name: string;
  email: string | null;
  phone_number: string;
  my_language: string;
  target_language: string;
  mode: string;
  who_hears: string;
  translation_mode: string;
  greeting_text: string;
  tts_provider: string;
  tts_voice_id: string | null;
  balance_minutes: number;
  enabled: boolean;
}

interface Session {
  id: string;
  call_id: string | null;
  duration_seconds: number;
  minutes_used: string;
  cost_usd: string;
  transcript: Array<{ speaker?: string; original?: string; translated?: string; text?: string }>;
  status: string;
  created_at: string;
}

interface Transaction {
  id: string;
  type: string;
  minutes: number;
  comment: string | null;
  created_at: string;
}

interface TranslationEntry {
  speaker: string;
  original: string;
  translated: string;
  timestamp: string;
}

const LANG_LABELS: Record<string, string> = { en: 'English', ru: 'Русский', es: 'Español', de: 'Deutsch', fr: 'Français' };

const cardCls = "rounded-2xl p-4 md:p-5 border" +
  " border-[var(--th-card-border-subtle)] bg-[var(--th-card)] backdrop-blur-sm";
const inputCls = "w-full px-4 py-3 min-h-[44px] rounded-xl text-base md:text-sm outline-none transition" +
  " bg-[var(--th-input)] border border-[var(--th-input-border)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:border-[var(--th-primary)]";

export default function TranslatorPortalPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 opacity-50 text-sm" style={{ color: 'var(--th-text-secondary)' }}>Loading...</div>}>
      <TranslatorPortal />
    </Suspense>
  );
}

function TranslatorPortal() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token');

  const [jwt, setJwt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Login state
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Authenticated state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // Live session
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<TranslationEntry[]>([]);
  const liveEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // ─── Auth ─────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('caller_subscriber_token');
    if (stored) {
      setJwt(stored);
      setLoading(false);
      return;
    }
    if (tokenParam) {
      // Verify magic link token
      fetch(`${API_BASE}/translator/portal/verify?token=${tokenParam}`)
        .then(r => r.json())
        .then(data => {
          if (data.token) {
            localStorage.setItem('caller_subscriber_token', data.token);
            setJwt(data.token);
            // Clean URL
            window.history.replaceState({}, '', '/translator/portal');
          } else {
            setLoginError('Invalid or expired link. Please request a new one.');
          }
        })
        .catch(() => setLoginError('Verification failed.'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [tokenParam]);

  const apiFetch = useCallback(async (path: string) => {
    const res = await fetch(`${API_BASE}/translator/portal${path}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (res.status === 401) {
      localStorage.removeItem('caller_subscriber_token');
      setJwt(null);
      throw new Error('Unauthorized');
    }
    return res.json();
  }, [jwt]);

  // ─── Load data ─────────────────────────────────────────────
  useEffect(() => {
    if (!jwt) return;
    Promise.all([
      apiFetch('/me'),
      apiFetch('/sessions?limit=20'),
      apiFetch('/transactions'),
      apiFetch('/sessions/active'),
    ]).then(([me, sess, tx, active]) => {
      setProfile(me);
      setSessions(sess.sessions || []);
      setTransactions(tx.transactions || []);
      setActiveSession(active.session || null);
    }).catch(() => {});
  }, [jwt, apiFetch]);

  // ─── Live transcript ──────────────────────────────────────
  useEffect(() => {
    if (!activeSession?.call_id || !jwt) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const s = socketIO(wsUrl, {
      path: '/socket.io',
      auth: { token: jwt },
      transports: ['websocket'],
    });

    s.on('connect', () => {
      s.emit('call:translate:join', { call_id: activeSession.call_id });
    });

    s.on('call:translation', (data: TranslationEntry & { call_id: string }) => {
      if (data.call_id !== activeSession.call_id) return;
      setLiveTranscript(prev => [...prev, { speaker: data.speaker, original: data.original, translated: data.translated, timestamp: data.timestamp }]);
    });

    socketRef.current = s;
    return () => { s.disconnect(); socketRef.current = null; };
  }, [activeSession, jwt]);

  useEffect(() => {
    liveEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTranscript]);

  // ─── Request magic link ────────────────────────────────────
  const requestLink = async () => {
    setLoginError('');
    try {
      await fetch(`${API_BASE}/translator/portal/request-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setLinkSent(true);
    } catch {
      setLoginError('Failed to send link. Try again.');
    }
  };

  const logout = () => {
    localStorage.removeItem('caller_subscriber_token');
    setJwt(null);
    setProfile(null);
  };

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-center py-20 opacity-50 text-sm" style={{ color: 'var(--th-text-secondary)' }}>
        Loading...
      </div>
    );
  }

  // ─── Login Screen ──────────────────────────────────────────
  if (!jwt) {
    return (
      <div className={cardCls + ' mt-6 md:mt-8 mx-4 md:mx-0'}>
        <h2 className="text-lg md:text-xl font-bold mb-2" style={{ color: 'var(--th-text)' }}>Sign In</h2>
        <p className="text-sm mb-4 md:mb-6" style={{ color: 'var(--th-text-secondary)' }}>
          Enter your email to receive a magic link.
        </p>

        {linkSent ? (
          <div className="text-center py-4">
            <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--th-success-text)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <p className="text-sm font-medium" style={{ color: 'var(--th-success-text)' }}>Check your email!</p>
            <p className="text-xs mt-2" style={{ color: 'var(--th-text-secondary)' }}>
              We sent a sign-in link to <strong>{email}</strong>
            </p>
            <button onClick={() => { setLinkSent(false); setEmail(''); }}
              className="mt-4 text-xs underline" style={{ color: 'var(--th-primary-light)' }}>
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className={inputCls}
              onKeyDown={e => e.key === 'Enter' && email && requestLink()}
            />
            {loginError && <p className="text-xs mt-2" style={{ color: '#f87171' }}>{loginError}</p>}
            <button onClick={requestLink} disabled={!email}
              className="w-full mt-4 py-3 min-h-[44px] rounded-xl text-sm font-bold text-[#0e131f] transition disabled:opacity-30 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, var(--th-primary-light), var(--th-primary))' }}>
              Send Magic Link
            </button>
          </>
        )}
      </div>
    );
  }

  // ─── Authenticated Portal ──────────────────────────────────
  if (!profile) {
    return <div className="text-center py-20 opacity-50 text-sm" style={{ color: 'var(--th-text-secondary)' }}>Loading profile...</div>;
  }

  return (
    <div className="space-y-4 md:space-y-5 mt-4 px-4 md:px-0 pb-[env(safe-area-inset-bottom)]">
      {/* Balance Card */}
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--th-text-secondary)' }}>Balance</span>
          <button onClick={logout} className="text-[10px] underline min-h-[44px] flex items-center" style={{ color: 'var(--th-text-secondary)' }}>Sign out</button>
        </div>
        <div className="text-3xl md:text-4xl font-bold" style={{ color: profile.balance_minutes < 5 ? '#fbbf24' : '#4ade80' }}>
          {profile.balance_minutes.toFixed(1)}
          <span className="text-sm font-normal ml-1 opacity-60">min</span>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--th-text-secondary)' }}>
          Hello, <strong>{profile.name}</strong> &middot; {profile.phone_number}
        </p>
      </div>

      {/* Live Session (if active) */}
      {activeSession && (
        <div className={cardCls} style={{ borderColor: 'rgba(74,222,128,0.3)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-bold" style={{ color: 'var(--th-success-text)' }}>Live Session</span>
          </div>
          <div className="space-y-2 max-h-[50vh] md:max-h-60 overflow-y-auto">
            {liveTranscript.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--th-text-secondary)' }}>Waiting for speech...</p>
            )}
            {liveTranscript.map((entry, i) => (
              <div key={i} className={`flex gap-2 ${entry.speaker === 'caller' ? '' : 'flex-row-reverse'}`}>
                <div className={`max-w-[85%] md:max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  entry.speaker === 'caller' ? 'bg-white/5' : 'bg-[#adc6ff]/10'
                }`}>
                  <p style={{ color: 'var(--th-text)' }}>{entry.original}</p>
                  <p className="text-xs mt-0.5 italic" style={{ color: 'var(--th-text-secondary)' }}>{entry.translated}</p>
                </div>
              </div>
            ))}
            <div ref={liveEndRef} />
          </div>
        </div>
      )}

      {/* Settings */}
      <div className={cardCls}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--th-text-secondary)' }}>My Settings</h3>
        <div className="space-y-2.5 md:space-y-2 text-sm">
          <div className="flex flex-col gap-0.5 md:flex-row md:justify-between">
            <span style={{ color: 'var(--th-text-secondary)' }}>Languages</span>
            <span style={{ color: 'var(--th-text)' }}>{LANG_LABELS[profile.my_language] || profile.my_language} → {LANG_LABELS[profile.target_language] || profile.target_language}</span>
          </div>
          <div className="flex flex-col gap-0.5 md:flex-row md:justify-between">
            <span style={{ color: 'var(--th-text-secondary)' }}>Mode</span>
            <span className="capitalize" style={{ color: 'var(--th-text)' }}>{profile.translation_mode}</span>
          </div>
          <div className="flex flex-col gap-0.5 md:flex-row md:justify-between">
            <span style={{ color: 'var(--th-text-secondary)' }}>Voice</span>
            <span className="capitalize" style={{ color: 'var(--th-text)' }}>{profile.tts_provider}{profile.tts_voice_id ? ` / ${profile.tts_voice_id}` : ''}</span>
          </div>
        </div>
        {profile.greeting_text && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(140,144,159,0.12)' }}>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--th-text-secondary)' }}>Greeting</span>
            <p className="text-xs mt-1 italic" style={{ color: '#e5e7eb' }}>&ldquo;{profile.greeting_text}&rdquo;</p>
          </div>
        )}
      </div>

      {/* Session History */}
      <div className={cardCls}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--th-text-secondary)' }}>Session History</h3>
        {sessions.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--th-text-secondary)' }}>No sessions yet</p>
        ) : (
          <div className="space-y-1">
            {sessions.map(session => {
              const expanded = expandedSession === session.id;
              return (
                <div key={session.id}>
                  <button onClick={() => setExpandedSession(expanded ? null : session.id)}
                    className="w-full flex items-center justify-between py-3 md:py-2.5 px-2 md:px-1 min-h-[44px] text-left hover:bg-white/3 rounded-lg transition active:bg-white/5">
                    <div>
                      <div className="text-sm" style={{ color: 'var(--th-text)' }}>
                        {new Date(session.created_at).toLocaleDateString()} {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>
                        {Math.floor((session.duration_seconds || 0) / 60)}:{String((session.duration_seconds || 0) % 60).padStart(2, '0')} &middot; {parseFloat(session.minutes_used || '0').toFixed(1)} min
                      </div>
                    </div>
                    <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: 'var(--th-text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {expanded && (
                    <div className="pb-3 px-1">
                      <div className="space-y-2 max-h-[50vh] md:max-h-60 overflow-y-auto rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
                        {(session.transcript || []).length === 0 ? (
                          <p className="text-xs text-center py-2" style={{ color: 'var(--th-text-secondary)' }}>No transcript</p>
                        ) : session.transcript.map((entry, i) => (
                          <div key={i} className={`flex gap-2 ${entry.speaker === 'caller' ? '' : 'flex-row-reverse'}`}>
                            <div className={`max-w-[85%] md:max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                              entry.speaker === 'caller' ? 'bg-white/5' : 'bg-[#adc6ff]/10'
                            }`}>
                              <p style={{ color: 'var(--th-text)' }}>{entry.original || entry.text || ''}</p>
                              {entry.translated && <p className="mt-0.5 italic" style={{ color: 'var(--th-text-secondary)' }}>{entry.translated}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Balance History */}
      {transactions.length > 0 && (
        <div className={cardCls}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--th-text-secondary)' }}>Balance History</h3>
          <div className="space-y-1">
            {transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center py-1.5 text-xs border-b" style={{ borderColor: 'rgba(140,144,159,0.08)' }}>
                <div>
                  <span className="font-medium capitalize" style={{ color: 'var(--th-text)' }}>{t.type}</span>
                  {t.comment && <span className="ml-2" style={{ color: 'var(--th-text-secondary)' }}>{t.comment}</span>}
                  <div className="text-[10px]" style={{ color: 'var(--th-text-secondary)' }}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span className="font-mono" style={{ color: t.minutes >= 0 ? '#4ade80' : '#f87171' }}>
                  {t.minutes >= 0 ? '+' : ''}{t.minutes.toFixed(1)} min
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
