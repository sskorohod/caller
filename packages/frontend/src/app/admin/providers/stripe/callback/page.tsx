'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function StripeCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      setError('Missing authorization code or state parameter');
      return;
    }

    api.post('/admin/stripe/callback', { code, state })
      .then(() => router.push('/admin/providers?stripe=connected'))
      .catch((err) => setError((err as Error).message || 'Failed to connect Stripe account'));
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="glass-panel rounded-2xl p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(248, 113, 113, 0.1)' }}>
            <span className="material-symbols-outlined text-red-400">error</span>
          </div>
          <h2 className="text-lg font-bold mb-2">Connection Failed</h2>
          <p className="text-sm mb-6" style={{ color: '#c2c6d6' }}>{error}</p>
          <a href="/admin/providers" className="px-4 py-2 rounded-xl text-sm font-bold inline-block"
            style={{ background: '#adc6ff', color: '#002e6a' }}>
            Back to Providers
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="glass-panel rounded-2xl p-8 max-w-md text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse" style={{ background: 'rgba(173, 198, 255, 0.1)' }}>
          <span className="material-symbols-outlined" style={{ color: '#adc6ff' }}>sync</span>
        </div>
        <h2 className="text-lg font-bold mb-2">Connecting Stripe</h2>
        <p className="text-sm" style={{ color: '#c2c6d6' }}>Please wait while we complete the authorization...</p>
      </div>
    </div>
  );
}
