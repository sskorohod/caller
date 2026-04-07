'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { authApi } from '@/lib/api';
import Link from 'next/link';

function LoginContent() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('return');
  const modeParam = searchParams.get('mode');
  const [tab, setTab] = useState<'login' | 'register'>(modeParam === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        const res = await authApi.login({ email, password });
        login(res.token, res.user, res.workspace ?? undefined, returnUrl ?? undefined);
      } else {
        const res = await authApi.register({ email, password });
        login(res.token, res.user, res.workspace, '/onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
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
        .glass-panel { background: rgba(26, 32, 44, 0.6); backdrop-filter: blur(20px); border: 0.5px solid rgba(140, 144, 159, 0.15); }
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

        {/* Decorative orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #adc6ff 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #d0bcff 0%, transparent 70%)', filter: 'blur(60px)' }} />

        <div className="relative z-10 max-w-md px-12">
          {/* Logo */}
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

          {/* Feature list */}
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

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-8" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <button
              onClick={() => setTab('login')}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={tab === 'login'
                ? { background: 'rgba(173, 198, 255, 0.12)', color: '#adc6ff' }
                : { color: 'rgba(194, 198, 214, 0.6)' }}>
              Sign In
            </button>
            <button
              onClick={() => setTab('register')}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={tab === 'register'
                ? { background: 'rgba(173, 198, 255, 0.12)', color: '#adc6ff' }
                : { color: 'rgba(194, 198, 214, 0.6)' }}>
              Create Account
            </button>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-2xl font-headline font-bold tracking-tight">
              {tab === 'login' ? 'Welcome back' : 'Get started'}
            </h1>
            <p className="text-sm mt-1" style={{ color: '#c2c6d6' }}>
              {tab === 'login'
                ? 'Sign in to your account'
                : 'Create your account — $2 free credit included'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="Min. 8 characters"
                  className="input-field"
                  style={{ paddingLeft: '40px' }}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', color: '#f87171' }}>
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{
                background: 'linear-gradient(135deg, #adc6ff 0%, #4d8eff 100%)',
                color: '#0e131f',
                boxShadow: '0 4px 24px rgba(77, 142, 255, 0.2)',
              }}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Please wait...
                </span>
              ) : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: 'rgba(140, 144, 159, 0.15)' }} />
            <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(140, 144, 159, 0.15)' }} />
          </div>

          {/* Switch prompt */}
          <p className="text-center text-sm" style={{ color: '#c2c6d6' }}>
            {tab === 'login' ? (
              <>Don&apos;t have an account?{' '}
                <button onClick={() => setTab('register')} className="font-semibold hover:underline" style={{ color: '#adc6ff' }}>
                  Sign up free
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => setTab('login')} className="font-semibold hover:underline" style={{ color: '#adc6ff' }}>
                  Sign in
                </button>
              </>
            )}
          </p>

          {/* Footer */}
          <p className="text-center text-[10px] mt-8" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>
            Caller Platform &copy; {new Date().getFullYear()}
          </p>
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
