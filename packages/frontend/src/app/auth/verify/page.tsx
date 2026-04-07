'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

function VerifyContent() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No verification token found');
      return;
    }

    api.get<{
      token: string;
      user: { id: string; email: string };
      workspace: { id: string; name: string } | null;
      isNewUser: boolean;
    }>(`/auth/verify?token=${token}`)
      .then(res => {
        setStatus('success');
        // Small delay so user sees success state
        setTimeout(() => {
          login(
            res.token,
            res.user,
            res.workspace ?? undefined,
            res.isNewUser ? '/onboarding' : undefined,
          );
        }, 1000);
      })
      .catch(err => {
        setStatus('error');
        setError(err.message || 'Invalid or expired link');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
      `}</style>

      <div className="text-center max-w-sm">
        {status === 'verifying' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(173,198,255,0.1)', border: '1px solid rgba(173,198,255,0.2)' }}>
              <span className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#adc6ff', borderTopColor: 'transparent' }} />
            </div>
            <h1 className="text-2xl font-headline font-bold mb-2">Verifying...</h1>
            <p className="text-sm" style={{ color: '#c2c6d6' }}>Signing you in, one moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <span className="material-symbols-outlined text-3xl" style={{ color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <h1 className="text-2xl font-headline font-bold mb-2">You&apos;re in!</h1>
            <p className="text-sm" style={{ color: '#c2c6d6' }}>Redirecting to your dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <span className="material-symbols-outlined text-3xl" style={{ color: '#f87171', fontVariationSettings: "'FILL' 1" }}>error</span>
            </div>
            <h1 className="text-2xl font-headline font-bold mb-2">Link expired</h1>
            <p className="text-sm mb-6" style={{ color: '#c2c6d6' }}>{error}</p>
            <button onClick={() => router.push('/login')}
              className="px-6 py-3 rounded-xl text-sm font-bold transition-all active:scale-[.98]"
              style={{ background: 'linear-gradient(135deg, #adc6ff, #4d8eff)', color: '#0e131f' }}>
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0e131f' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#adc6ff', borderTopColor: 'transparent' }} />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
