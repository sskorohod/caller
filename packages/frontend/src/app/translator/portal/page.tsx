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

const cardCls = "rounded-2xl p-5 border" +
  " border-[rgba(140,144,159,0.12)] bg-[rgba(26,32,44,0.7)] backdrop-blur-sm";
const inputCls = "w-full px-4 py-3 rounded-xl text-sm outline-none transition" +
  " bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-[#adc6ff]/50";

export default function TranslatorPortalPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 opacity-50 text-sm" style={{ color: '#c2c6d6' }}>Loading...</div>}>
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
      <div className="text-center py-20 opacity-50 text-sm" style={{ color: '#c2c6d6' }}>
        Loading...
      </div>
    );
  }

  // ─── Login Screen ──────────────────────────────────────────
  if (!jwt) {
    return (
      <div className={cardCls + ' mt-8'}>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#dde2f3' }}>Sign In</h2>
        <p className="text-sm mb-6" style={{ color: '#c2c6d6' }}>
          Enter your email to receive a magic link.
        </p>

        {linkSent ? (
          <div className="text-center py-4">
            <svg className="w-12 h-12 mx-auto mb-3" style={{ color: '#4ade80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <p className="text-sm font-medium" style={{ color: '#4ade80' }}>Check your email!</p>
            <p className="text-xs mt-2" style={{ color: '#c2c6d6' }}>
              We sent a sign-in link to <strong>{email}</strong>
            </p>
            <button onClick={() => { setLinkSent(false); setEmail(''); }}
              className="mt-4 text-xs underline" style={{ color: '#adc6ff' }}>
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
              className="w-full mt-4 py-3 rounded-xl text-sm font-bold text-[#0e131f] transition disabled:opacity-30"
              style={{ background: 'linear-gradient(135deg, #adc6ff, #4d8eff)' }}>
              Send Magic Link
            </button>
          </>
        )}
      </div>
    );
  }

  // ─── Authenticated Portal ──────────────────────────────────
  if (!profile) {
    return <div className="text-center py-20 opacity-50 text-sm" style={{ color: '#c2c6d6' }}>Loading profile...</div>;
  }

  return (
    <div className="space-y-5 mt-4">
      {/* Balance Card */}
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#c2c6d6' }}>Balance</span>
          <button onClick={logout} className="text-[10px] underline" style={{ color: '#c2c6d6' }}>Sign out</button>
        </div>
        <div className="text-4xl font-bold" style={{ color: profile.balance_minutes < 5 ? '#fbbf24' : '#4ade80' }}>
          {profile.balance_minutes.toFixed(1)}
          <span className="text-sm font-normal ml-1 opacity-60">min</span>
        </div>
        <p className="text-xs mt-2" style={{ color: '#c2c6d6' }}>
          Hello, <strong>{profile.name}</strong> &middot; {profile.phone_number}
        </p>
      </div>

      {/* Live Session (if active) */}
      {activeSession && (
        <div className={cardCls} style={{ borderColor: 'rgba(74,222,128,0.3)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-bold" style={{ color: '#4ade80' }}>Live Session</span>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {liveTranscript.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: '#c2c6d6' }}>Waiting for speech...</p>
            )}
            {liveTranscript.map((entry, i) => (
              <div key={i} className={`flex gap-2 ${entry.speaker === 'caller' ? '' : 'flex-row-reverse'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  entry.speaker === 'caller' ? 'bg-white/5' : 'bg-[#adc6ff]/10'
                }`}>
                  <p style={{ color: '#dde2f3' }}>{entry.original}</p>
                  <p className="text-xs mt-0.5 italic" style={{ color: '#c2c6d6' }}>{entry.translated}</p>
                </div>
              </div>
            ))}
            <div ref={liveEndRef} />
          </div>
        </div>
      )}

      {/* Settings */}
      <div className={cardCls}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#c2c6d6' }}>My Settings</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span style={{ color: '#c2c6d6' }}>Languages</span>
            <span style={{ color: '#dde2f3' }}>{LANG_LABELS[profile.my_language] || profile.my_language} → {LANG_LABELS[profile.target_language] || profile.target_language}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: '#c2c6d6' }}>Mode</span>
            <span className="capitalize" style={{ color: '#dde2f3' }}>{profile.translation_mode}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: '#c2c6d6' }}>Voice</span>
            <span className="capitalize" style={{ color: '#dde2f3' }}>{profile.tts_provider}{profile.tts_voice_id ? ` / ${profile.tts_voice_id}` : ''}</span>
          </div>
        </div>
        {profile.greeting_text && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(140,144,159,0.12)' }}>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#c2c6d6' }}>Greeting</span>
            <p className="text-xs mt-1 italic" style={{ color: '#e5e7eb' }}>&ldquo;{profile.greeting_text}&rdquo;</p>
          </div>
        )}
      </div>

      {/* Session History */}
      <div className={cardCls}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#c2c6d6' }}>Session History</h3>
        {sessions.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: '#c2c6d6' }}>No sessions yet</p>
        ) : (
          <div className="space-y-1">
            {sessions.map(session => {
              const expanded = expandedSession === session.id;
              return (
                <div key={session.id}>
                  <button onClick={() => setExpandedSession(expanded ? null : session.id)}
                    className="w-full flex items-center justify-between py-2.5 px-1 text-left hover:bg-white/3 rounded-lg transition">
                    <div>
                      <div className="text-sm" style={{ color: '#dde2f3' }}>
                        {new Date(session.created_at).toLocaleDateString()} {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-xs" style={{ color: '#c2c6d6' }}>
                        {Math.floor((session.duration_seconds || 0) / 60)}:{String((session.duration_seconds || 0) % 60).padStart(2, '0')} &middot; {parseFloat(session.minutes_used || '0').toFixed(1)} min
                      </div>
                    </div>
                    <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: '#c2c6d6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {expanded && (
                    <div className="pb-3 px-1">
                      <div className="space-y-2 max-h-60 overflow-y-auto rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
                        {(session.transcript || []).length === 0 ? (
                          <p className="text-xs text-center py-2" style={{ color: '#c2c6d6' }}>No transcript</p>
                        ) : session.transcript.map((entry, i) => (
                          <div key={i} className={`flex gap-2 ${entry.speaker === 'caller' ? '' : 'flex-row-reverse'}`}>
                            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                              entry.speaker === 'caller' ? 'bg-white/5' : 'bg-[#adc6ff]/10'
                            }`}>
                              <p style={{ color: '#dde2f3' }}>{entry.original || entry.text || ''}</p>
                              {entry.translated && <p className="mt-0.5 italic" style={{ color: '#c2c6d6' }}>{entry.translated}</p>}
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
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#c2c6d6' }}>Balance History</h3>
          <div className="space-y-1">
            {transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center py-1.5 text-xs border-b" style={{ borderColor: 'rgba(140,144,159,0.08)' }}>
                <div>
                  <span className="font-medium capitalize" style={{ color: '#dde2f3' }}>{t.type}</span>
                  {t.comment && <span className="ml-2" style={{ color: '#c2c6d6' }}>{t.comment}</span>}
                  <div className="text-[10px]" style={{ color: '#c2c6d6' }}>
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
