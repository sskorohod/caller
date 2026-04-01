'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';

interface ClientInfo {
  client_name: string;
  client_id: string;
  redirect_uri: string;
}

function OAuthConsentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, isLoading, user, workspace } = useAuth();
  const t = useT();

  const clientId    = searchParams.get('client_id') ?? '';
  const redirectUri = searchParams.get('redirect_uri') ?? '';
  const state       = searchParams.get('state') ?? '';
  const responseType = searchParams.get('response_type') ?? '';

  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [pageError, setPageError]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !token) {
      router.replace(`/login?return=${encodeURIComponent(window.location.href)}`);
    }
  }, [token, isLoading, router]);

  // Validate params and fetch client info
  useEffect(() => {
    if (!clientId || !redirectUri || responseType !== 'code') {
      setPageError(t('oauth.invalidRequest'));
      return;
    }
    const url = `/api/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
    fetch(url)
      .then(r => r.json())
      .then((data: any) => {
        if (data.error) throw new Error(data.error_description ?? data.error);
        setClientInfo(data as ClientInfo);
      })
      .catch(e => setPageError(e.message));
  }, [clientId, redirectUri, responseType]);

  async function handleDecision(approved: boolean) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ client_id: clientId, redirect_uri: redirectUri, state, approved }),
      });
      const data = await res.json();
      if (data.redirect_to) {
        window.location.href = data.redirect_to;
      } else {
        setPageError(data.error_description ?? data.error ?? t('oauth.authFailed'));
      }
    } catch (e: any) {
      setPageError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Spinner while checking auth
  if (isLoading || (!token && !pageError)) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Error state
  if (pageError) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-10 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-[#0f172a] mb-2">{t('oauth.authError')}</h2>
          <p className="text-sm text-[#94a3b8] leading-relaxed">{pageError}</p>
        </div>
      </div>
    );
  }

  // Loading client info
  if (!clientInfo) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = user?.email?.slice(0, 1).toUpperCase() ?? '?';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] to-[#eef2ff] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-[0_8px_40px_rgba(99,102,241,.12)] w-full max-w-[380px]">

        {/* Header: app logos */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-[#f1f5f9]">
          <div className="flex items-center justify-center gap-4 mb-5">
            {/* External app icon */}
            <div className="w-14 h-14 bg-[#10a37f]/10 rounded-2xl flex items-center justify-center shadow-sm border border-[#10a37f]/20">
              <span className="text-lg font-bold text-[#10a37f]">
                {clientInfo.client_name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            {/* Arrow */}
            <svg className="w-5 h-5 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            {/* Caller icon */}
            <div className="w-14 h-14 bg-[#6366f1]/10 rounded-2xl flex items-center justify-center shadow-sm border border-[#6366f1]/20">
              <svg className="w-7 h-7 text-[#6366f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
          </div>
          <h1 className="text-lg font-bold text-[#0f172a]">{clientInfo.client_name}</h1>
          <p className="text-sm text-[#64748b] mt-1">
            {t('oauth.wantsToConnect')}{' '}
            <span className="font-semibold text-[#0f172a]">{workspace?.name ?? t('oauth.yourWorkspace')}</span>
          </p>
        </div>

        {/* Permissions list */}
        <div className="px-8 py-5">
          <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest mb-3">
            {t('oauth.thisAppWillBeAbleTo')}
          </p>
          <ul className="space-y-2.5">
            {[
              { icon: '📞', text: t('oauth.perm.calls') },
              { icon: '📋', text: t('oauth.perm.history') },
              { icon: '🤖', text: t('oauth.perm.agents') },
              { icon: '🧠', text: t('oauth.perm.memory') },
            ].map(item => (
              <li key={item.text} className="flex items-center gap-3">
                <span className="w-6 text-center text-sm">{item.icon}</span>
                <span className="text-sm text-[#334155]">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Logged-in account */}
        <div className="px-8 pb-4">
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl">
            <div className="w-7 h-7 bg-[#6366f1]/15 rounded-full flex items-center justify-center shrink-0">
              <span className="text-[#6366f1] text-xs font-bold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#334155] truncate">{user?.email}</p>
              <p className="text-[10px] text-[#94a3b8] truncate">{workspace?.name}</p>
            </div>
            <svg className="w-3 h-3 text-[#10b981] shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-8 pb-6 flex gap-3">
          <button
            onClick={() => handleDecision(false)}
            disabled={submitting}
            className="flex-1 py-2.5 border border-[#e2e8f0] rounded-xl text-sm font-medium text-[#475569] hover:bg-[#f8fafc] transition-colors disabled:opacity-50"
          >
            {t('oauth.deny')}
          </button>
          <button
            onClick={() => handleDecision(true)}
            disabled={submitting}
            className="flex-1 py-2.5 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl text-sm font-semibold transition-all active:scale-[.98] disabled:opacity-50 shadow-lg shadow-[#6366f1]/25"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('oauth.authorizing')}
              </span>
            ) : t('oauth.allowAccess')}
          </button>
        </div>

        <p className="text-center text-[10px] text-[#94a3b8] pb-5 px-8">
          {t('oauth.consentNotice', { appName: clientInfo.client_name })}
        </p>
      </div>
    </div>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OAuthConsentContent />
    </Suspense>
  );
}
