'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { authApi } from '@/lib/api';
import Link from 'next/link';
import { useT } from '@/lib/i18n';

function LoginContent() {
  const { login } = useAuth();
  const t = useT();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('return');
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
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
        const res = await authApi.register({ email, password, workspace_name: workspaceName });
        login(res.token, res.user, res.workspace, '/onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[var(--th-primary)] rounded-xl flex items-center justify-center shadow-lg shadow-[var(--th-shadow-primary)]">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Caller</span>
        </div>

        {/* Card */}
        <div className="bg-[var(--th-card)] rounded-2xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[var(--th-border)]">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === 'login' ? 'text-[var(--th-primary-text)] border-b-2 border-[var(--th-primary)]' : 'text-[var(--th-text-muted)] hover:text-[var(--th-text-secondary)]'
              }`}
            >
              {t('login.signIn')}
            </button>
            <button
              onClick={() => setTab('register')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === 'register' ? 'text-[var(--th-primary-text)] border-b-2 border-[var(--th-primary)]' : 'text-[var(--th-text-muted)] hover:text-[var(--th-text-secondary)]'
              }`}
            >
              {t('login.createAccount')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            {tab === 'register' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">
                  {t('login.workspaceName')}
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={e => setWorkspaceName(e.target.value)}
                  required
                  placeholder="Acme Corp"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--th-border)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">
                {t('login.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full px-4 py-3 rounded-xl border border-[var(--th-border)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">
                {t('login.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-[var(--th-border)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors"
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-white font-semibold rounded-xl text-sm transition-all active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[var(--th-shadow-primary)] mt-2"
            >
              {loading ? t('login.pleaseWait') : tab === 'login' ? t('login.signIn') : t('login.createAccount')}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--th-text-secondary)] mt-6">
          {t('login.copyright')} © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--th-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
