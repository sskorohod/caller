'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAdminQuery, api } from '../_lib/admin-api';
import type { StripeStatus } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminModal from '../_components/AdminModal';
import AdminFormField, { adminInputClass } from '../_components/AdminFormField';
import AdminBadge from '../_components/AdminBadge';
import AdminLoadingState from '../_components/AdminLoadingState';

const PROVIDER_CONFIG: Record<string, { label: string; icon: string; fields: { key: string; label: string; type?: string }[] }> = {
  stripe: { label: 'Stripe', icon: 'payments', fields: [{ key: 'secret_key', label: 'Secret Key' }, { key: 'webhook_secret', label: 'Webhook Secret' }] },
  twilio: { label: 'Twilio', icon: 'phone_in_talk', fields: [{ key: 'account_sid', label: 'Account SID' }, { key: 'auth_token', label: 'Auth Token' }, { key: 'phone_number', label: 'Phone Number' }] },
  deepgram: { label: 'Deepgram (STT)', icon: 'mic', fields: [{ key: 'api_key', label: 'API Key' }] },
  elevenlabs: { label: 'ElevenLabs (TTS)', icon: 'record_voice_over', fields: [{ key: 'api_key', label: 'API Key' }] },
  openai: { label: 'OpenAI', icon: 'psychology', fields: [{ key: 'api_key', label: 'API Key' }] },
  xai: { label: 'xAI Grok', icon: 'auto_awesome', fields: [{ key: 'api_key', label: 'API Key' }] },
  telegram: { label: 'Telegram', icon: 'send', fields: [{ key: 'bot_token', label: 'Bot Token' }, { key: 'chat_id', label: 'Chat ID' }] },
};

export default function ProvidersPage() {
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<Record<string, { connected: boolean; masked_key?: string }>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ name: string; ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeSuccess, setStripeSuccess] = useState(false);

  const load = async () => {
    try {
      const r = await api.get<{ providers: typeof providers }>('/admin/providers');
      setProviders(r.providers);
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  };

  const loadStripeStatus = async () => {
    try {
      const status = await api.get<StripeStatus>('/admin/stripe/status');
      setStripeStatus(status);
    } catch (err) {
      console.error('Failed to load Stripe status:', err);
      setStripeStatus({ connected: false });
    }
  };

  const { loading } = useAdminQuery(
    async () => {
      await Promise.all([load(), loadStripeStatus()]);
      return true;
    },
    [],
  );

  useEffect(() => {
    if (searchParams.get('stripe') === 'connected') {
      setStripeSuccess(true);
      setTimeout(() => setStripeSuccess(false), 5000);
    }
  }, [searchParams]);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.put(`/admin/providers/${editing}`, form);
      setEditing(null);
      setForm({});
      await load();
      if (editing === 'stripe') await loadStripeStatus();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  };

  const handleTest = async (name: string) => {
    setTesting(name);
    try {
      const r = await api.post<{ ok: boolean; message: string }>(`/admin/providers/${name}/test`, {});
      setTestResult({ name, ...r });
    } catch (err) {
      setTestResult({ name, ok: false, message: err instanceof Error ? err.message : 'Test failed' });
    }
    setTesting(null);
  };

  const handleStripeConnect = async () => {
    setStripeLoading(true);
    try {
      const r = await api.get<{ url: string }>('/admin/stripe/connect');
      window.location.href = r.url;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to connect Stripe');
      setStripeLoading(false);
    }
  };

  const handleStripeDisconnect = async () => {
    if (!confirm('Disconnect Stripe account? This will remove the OAuth connection.')) return;
    setStripeLoading(true);
    try {
      await api.delete('/admin/stripe/connect');
      setStripeStatus({ connected: false });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to disconnect Stripe');
    }
    setStripeLoading(false);
  };

  if (loading) return <AdminLoadingState rows={5} />;

  const renderStripeCard = () => {
    const cfg = PROVIDER_CONFIG.stripe;
    const p = providers.stripe;
    const isOAuth = stripeStatus?.connected && stripeStatus?.stripe_user_id;

    return (
      <div key="stripe" className="glass-panel rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--th-primary-bg)' }}
            >
              <span className="material-symbols-outlined" style={{ color: 'var(--th-primary-text)' }}>{cfg.icon}</span>
            </div>
            <div>
              <div className="font-bold text-sm">{cfg.label}</div>
              {isOAuth && stripeStatus.business_name && (
                <div className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>{stripeStatus.business_name}</div>
              )}
              {isOAuth && !stripeStatus.business_name && stripeStatus.stripe_user_id && (
                <div className="text-xs font-mono" style={{ color: 'var(--th-text-secondary)' }}>{stripeStatus.stripe_user_id}</div>
              )}
              {!isOAuth && p?.masked_key && (
                <div className="text-xs font-mono" style={{ color: 'var(--th-text-secondary)' }}>{p.masked_key}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOAuth && stripeStatus.livemode !== undefined && (
              <AdminBadge variant={stripeStatus.livemode ? 'success' : 'warning'}>
                {stripeStatus.livemode ? 'Live' : 'Test'}
              </AdminBadge>
            )}
            <AdminBadge variant={(isOAuth || p?.connected) ? 'success' : 'neutral'}>
              {isOAuth ? 'OAuth Connected' : p?.connected ? 'Connected' : 'Not Connected'}
            </AdminBadge>
          </div>
        </div>

        {isOAuth && stripeStatus.email && (
          <div className="text-xs mb-3" style={{ color: 'var(--th-text-secondary)' }}>{stripeStatus.email}</div>
        )}

        {stripeSuccess && (
          <div className="text-xs mb-3 p-2 rounded" style={{ background: 'var(--th-success-bg)', color: 'var(--th-success-text)' }}>
            Stripe account connected successfully!
          </div>
        )}

        {testResult?.name === 'stripe' && (
          <div
            className="text-xs mb-3 p-2 rounded"
            style={{
              background: testResult.ok ? 'var(--th-success-bg)' : 'var(--th-error-bg)',
              color: testResult.ok ? 'var(--th-success-text)' : 'var(--th-error-text)',
            }}
          >
            {testResult.message}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {isOAuth ? (
            <button
              onClick={handleStripeDisconnect}
              disabled={stripeLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--th-error-bg)', color: 'var(--th-error-text)' }}
            >
              {stripeLoading ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <>
              <button
                onClick={handleStripeConnect}
                disabled={stripeLoading}
                className="btn-primary px-4 py-1.5 rounded-lg text-xs font-bold"
              >
                {stripeLoading ? 'Redirecting...' : 'Connect with Stripe'}
              </button>
              <button
                onClick={() => { setEditing('stripe'); setForm({}); setSaveError(null); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'var(--th-surface)', color: 'var(--th-text-secondary)' }}
              >
                Enter keys manually
              </button>
            </>
          )}
          {(isOAuth || p?.connected) && (
            <button
              onClick={() => handleTest('stripe')}
              disabled={testing === 'stripe'}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--th-primary-bg)', color: 'var(--th-primary-text)' }}
            >
              {testing === 'stripe' ? 'Testing...' : 'Test'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-3 py-4 md:p-6 space-y-4 md:space-y-6">
      <AdminPageHeader
        title="Providers"
        subtitle="Manage API keys and connections for all services"
        icon="hub"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderStripeCard()}
        {Object.entries(PROVIDER_CONFIG).filter(([name]) => name !== 'stripe').map(([name, cfg]) => {
          const p = providers[name];
          return (
            <div key={name} className="glass-panel rounded-2xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--th-primary-bg)' }}
                  >
                    <span className="material-symbols-outlined" style={{ color: 'var(--th-primary-text)' }}>{cfg.icon}</span>
                  </div>
                  <div>
                    <div className="font-bold text-sm">{cfg.label}</div>
                    {p?.masked_key && <div className="text-xs font-mono" style={{ color: 'var(--th-text-secondary)' }}>{p.masked_key}</div>}
                  </div>
                </div>
                <AdminBadge variant={p?.connected ? 'success' : 'neutral'}>
                  {p?.connected ? 'Connected' : 'Not Connected'}
                </AdminBadge>
              </div>

              {testResult?.name === name && (
                <div
                  className="text-xs mb-3 p-2 rounded"
                  style={{
                    background: testResult.ok ? 'var(--th-success-bg)' : 'var(--th-error-bg)',
                    color: testResult.ok ? 'var(--th-success-text)' : 'var(--th-error-text)',
                  }}
                >
                  {testResult.message}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(name); setForm({}); setSaveError(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--th-surface)' }}
                >
                  Update Keys
                </button>
                {p?.connected && (
                  <button
                    onClick={() => handleTest(name)}
                    disabled={testing === name}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: 'var(--th-primary-bg)', color: 'var(--th-primary-text)' }}
                  >
                    {testing === name ? 'Testing...' : 'Test'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AdminModal
        open={!!editing}
        onClose={() => { setEditing(null); setSaveError(null); }}
        title={`Update ${editing ? PROVIDER_CONFIG[editing]?.label : ''}`}
        actions={
          <>
            <button
              onClick={() => { setEditing(null); setSaveError(null); }}
              className="px-4 py-2 min-h-[44px] md:min-h-0 text-sm"
              style={{ color: 'var(--th-text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary px-4 py-2 min-h-[44px] md:min-h-0 rounded-xl text-sm font-bold"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        {editing && PROVIDER_CONFIG[editing]?.fields.map(f => (
          <AdminFormField key={f.key} label={f.label}>
            <input
              value={form[f.key] ?? ''}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              className={adminInputClass}
            />
          </AdminFormField>
        ))}
        {saveError && (
          <div
            className="text-xs p-2 rounded"
            style={{ background: 'var(--th-error-bg)', color: 'var(--th-error-text)' }}
          >
            {saveError}
          </div>
        )}
      </AdminModal>
    </div>
  );
}
