'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

export default function SetPasswordPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const t = sessionStorage.getItem('caller_set_password_token');
    const u = sessionStorage.getItem('caller_set_password_user');
    const w = sessionStorage.getItem('caller_set_password_workspace');
    if (!t || !u) {
      router.push('/login');
      return;
    }
    setToken(t);
    setUser(JSON.parse(u));
    if (w && w !== 'null') setWorkspace(JSON.parse(w));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/set-password', { token, password });
      // Clean up session storage
      sessionStorage.removeItem('caller_set_password_token');
      sessionStorage.removeItem('caller_set_password_user');
      sessionStorage.removeItem('caller_set_password_workspace');
      // Log in and go to onboarding
      login(token, user!, workspace ?? undefined, '/onboarding');
    } catch (err: any) {
      setError(err.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6 sm:p-6" style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .input-field {
          width: 100%; padding: 14px 16px; border-radius: 12px; font-size: 16px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(140, 144, 159, 0.2);
          color: #dde2f3; outline: none; transition: all 0.2s;
        }
        .input-field::placeholder { color: rgba(194, 198, 214, 0.4); }
        .input-field:focus { border-color: rgba(173, 198, 255, 0.5); box-shadow: 0 0 0 3px rgba(173, 198, 255, 0.08); }
      `}</style>

      <div className="w-full max-w-sm">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(173,198,255,0.1)', border: '1px solid rgba(173,198,255,0.2)' }}>
            <span className="material-symbols-outlined text-3xl" style={{ color: '#adc6ff' }}>lock</span>
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-headline font-bold tracking-tight">Create your password</h1>
          <p className="text-sm mt-2" style={{ color: '#c2c6d6' }}>
            Set a password for <strong style={{ color: '#dde2f3' }}>{user?.email}</strong> so you can sign in next time.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(194, 198, 214, 0.5)' }}>
              Confirm Password
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg"
                style={{ color: password && confirm && password === confirm ? '#4ade80' : 'rgba(194, 198, 214, 0.3)' }}>
                {password && confirm && password === confirm ? 'check_circle' : 'lock'}
              </span>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={8}
                placeholder="Repeat password"
                className="input-field"
                style={{ paddingLeft: '40px' }}
              />
            </div>
            {confirm && password !== confirm && (
              <p className="text-xs mt-1" style={{ color: '#f87171' }}>Passwords do not match</p>
            )}
            {confirm && password === confirm && password.length >= 8 && (
              <p className="text-xs mt-1" style={{ color: '#4ade80' }}>Passwords match</p>
            )}
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
            disabled={loading || password.length < 8 || password !== confirm}
            className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            style={{
              background: 'linear-gradient(135deg, #adc6ff 0%, #4d8eff 100%)',
              color: '#0e131f',
              boxShadow: '0 4px 24px rgba(77, 142, 255, 0.2)',
            }}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Setting password...
              </span>
            ) : 'Set Password & Continue'}
          </button>
        </form>

        <p className="text-center text-[10px] mt-8" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>
          You&apos;ll use this password to sign in from now on.
        </p>
      </div>
    </div>
  );
}
