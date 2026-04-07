'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { authApi, api } from '@/lib/api';
import Link from 'next/link';

function LoginContent() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('return');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/magic-link', { email });
      setMagicLinkSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      login(res.token, res.user, res.workspace ?? undefined, returnUrl ?? undefined);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .input-field {
          width: 100%; padding: 12px 16px; border-radius: 12px; font-size: 14px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(140, 144, 159, 0.2);
          color: #dde2f3; outline: none; transition: all 0.2s;
        }
        .input-field::placeholder { color: rgba(194, 198, 214, 0.4); }
        .input-field:focus { border-color: rgba(173, 198, 255, 0.5); box-shadow: 0 0 0 3px rgba(173, 198, 255, 0.08); }
      `}</style>

      {/* Left — Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0a0f1a 0%, #131a2e 50%, #0e131f 100%)' }}>
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #adc6ff 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #d0bcff 0%, transparent 70%)', filter: 'blur(60px)' }} />

        <div className="relative z-10 max-w-md px-12">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #adc6ff 0%, #4d8eff 100%)' }}>
              <span className="material-symbols-outlined text-2xl" style={{ color: '#0e131f', fontVariationSettings: "'FILL' 1" }}>call</span>
            </div>
            <span className="text-2xl font-headline font-extrabold tracking-tight">Caller</span>
          </div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight leading-tight mb-4">
            AI Phone Agents
            <br />
            <span style={{ color: '#adc6ff' }}>& Live Translator</span>
          </h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: '#c2c6d6' }}>
            Automate your phone calls with AI agents or get real-time translation on any call.
            Start with $2 free credit.
          </p>
          <div className="space-y-3">
            {[
              { icon: 'smart_toy', text: 'AI agents that answer & make calls' },
              { icon: 'translate', text: 'Live translation in 10+ languages' },
              { icon: 'shield', text: 'Your keys or ours — you choose' },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="material-symbols-outlined text-lg" style={{ color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
                <span className="text-sm" style={{ color: '#c2c6d6' }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #adc6ff 0%, #4d8eff 100%)' }}>
              <span className="material-symbols-outlined text-xl" style={{ color: '#0e131f', fontVariationSettings: "'FILL' 1" }}>call</span>
            </div>
            <span className="text-xl font-headline font-extrabold tracking-tight">Caller</span>
          </div>

          {/* Magic Link Sent */}
          {magicLinkSent ? (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <span className="material-symbols-outlined text-3xl" style={{ color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
              </div>
              <div>
                <h1 className="text-2xl font-headline font-bold tracking-tight mb-2">Check your email</h1>
                <p className="text-sm" style={{ color: '#c2c6d6' }}>
                  We sent a sign-in link to<br />
                  <strong style={{ color: '#dde2f3' }}>{email}</strong>
                </p>
              </div>
              <p className="text-xs" style={{ color: 'rgba(194,198,214,0.5)' }}>
                Link expires in 15 minutes. Check spam if you don&apos;t see it.
              </p>
              <div className="pt-2">
                <button onClick={() => { setMagicLinkSent(false); setEmail(''); }}
                  className="text-sm font-medium hover:underline" style={{ color: '#adc6ff' }}>
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Heading */}
              <div className="mb-8">
                <h1 className="text-2xl font-headline font-bold tracking-tight">
                  Welcome to Caller
                </h1>
                <p className="text-sm mt-1" style={{ color: '#c2c6d6' }}>
                  Sign in or create an account
                </p>
              </div>

              {/* Magic Link Form (primary) */}
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(194, 198, 214, 0.5)' }}>
                    Email
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>mail</span>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="you@company.com"
                      className="input-field"
                      style={{ paddingLeft: '40px' }}
                    />
                  </div>
                </div>

                {error && !showPassword && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                    style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', color: '#f87171' }}>
                    <span className="material-symbols-outlined text-base">error</span>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #adc6ff 0%, #4d8eff 100%)',
                    color: '#0e131f',
                    boxShadow: '0 4px 24px rgba(77, 142, 255, 0.2)',
                  }}>
                  {loading && !showPassword ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">magic_button</span>
                      Continue with Email
                    </span>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px" style={{ background: 'rgba(140, 144, 159, 0.15)' }} />
                <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>or use password</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(140, 144, 159, 0.15)' }} />
              </div>

              {/* Password toggle */}
              {!showPassword ? (
                <button onClick={() => setShowPassword(true)}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Sign in with password
                </button>
              ) : (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(194, 198, 214, 0.5)' }}>
                      Password
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>lock</span>
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="Enter password"
                        className="input-field"
                        style={{ paddingLeft: '40px' }}
                        autoFocus
                      />
                    </div>
                  </div>

                  {error && showPassword && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                      style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', color: '#f87171' }}>
                      <span className="material-symbols-outlined text-base">error</span>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[.98] disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>
              )}

              {/* Footer */}
              <p className="text-center text-[10px] mt-8" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>
                By continuing, you agree to our Terms of Service.<br />
                Caller Platform &copy; {new Date().getFullYear()}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0e131f' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#adc6ff', borderTopColor: 'transparent' }} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
