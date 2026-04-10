'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

const PROVIDER_CONFIG: Record<string, { label: string; icon: string; fields: { key: string; label: string; type?: string }[] }> = {
  stripe: { label: 'Stripe', icon: 'payments', fields: [{ key: 'secret_key', label: 'Secret Key' }, { key: 'webhook_secret', label: 'Webhook Secret' }] },
  twilio: { label: 'Twilio', icon: 'phone_in_talk', fields: [{ key: 'account_sid', label: 'Account SID' }, { key: 'auth_token', label: 'Auth Token' }, { key: 'phone_number', label: 'Phone Number' }] },
  deepgram: { label: 'Deepgram (STT)', icon: 'mic', fields: [{ key: 'api_key', label: 'API Key' }] },
  elevenlabs: { label: 'ElevenLabs (TTS)', icon: 'record_voice_over', fields: [{ key: 'api_key', label: 'API Key' }] },
  openai: { label: 'OpenAI', icon: 'psychology', fields: [{ key: 'api_key', label: 'API Key' }] },
  xai: { label: 'xAI Grok', icon: 'auto_awesome', fields: [{ key: 'api_key', label: 'API Key' }] },
  telegram: { label: 'Telegram', icon: 'send', fields: [{ key: 'bot_token', label: 'Bot Token' }, { key: 'chat_id', label: 'Chat ID' }] },
};

interface StripeStatus {
  connected: boolean;
  stripe_user_id?: string;
  business_name?: string;
  email?: string;
  livemode?: boolean;
}

export default function ProvidersPage() {
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<Record<string, { connected: boolean; masked_key?: string }>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ name: string; ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeSuccess, setStripeSuccess] = useState(false);

  const load = () => api.get<{ providers: typeof providers }>('/admin/providers').then(r => setProviders(r.providers)).catch(() => {});

  const loadStripeStatus = () => api.get<StripeStatus>('/admin/stripe/status').then(setStripeStatus).catch(() => setStripeStatus({ connected: false }));

  useEffect(() => {
    load();
    loadStripeStatus();
    if (searchParams.get('stripe') === 'connected') {
      setStripeSuccess(true);
      setTimeout(() => setStripeSuccess(false), 5000);
    }
  }, []);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/admin/providers/${editing}`, form);
      setEditing(null);
      setForm({});
      await load();
      if (editing === 'stripe') await loadStripeStatus();
    } catch (err) { alert((err as Error).message); }
    setSaving(false);
  };

  const handleTest = async (name: string) => {
    setTesting(name);
    try {
      const r = await api.post<{ ok: boolean; message: string }>(`/admin/providers/${name}/test`, {});
      setTestResult({ name, ...r });
    } catch { setTestResult({ name, ok: false, message: 'Test failed' }); }
    setTesting(null);
  };

  const handleStripeConnect = async () => {
    setStripeLoading(true);
    try {
      const r = await api.get<{ url: string }>('/admin/stripe/connect');
      window.location.href = r.url;
    } catch (err) {
      alert((err as Error).message);
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
    } catch (err) { alert((err as Error).message); }
    setStripeLoading(false);
  };

  const renderStripeCard = () => {
    const cfg = PROVIDER_CONFIG.stripe;
    const p = providers.stripe;
    const isOAuth = stripeStatus?.connected && stripeStatus?.stripe_user_id;

    return (
      <div key="stripe" className="glass-panel rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(173, 198, 255, 0.1)' }}>
              <span className="material-symbols-outlined" style={{ color: '#adc6ff' }}>{cfg.icon}</span>
            </div>
            <div>
              <div className="font-bold text-sm">{cfg.label}</div>
              {isOAuth && stripeStatus.business_name && (
                <div className="text-xs" style={{ color: '#c2c6d6' }}>{stripeStatus.business_name}</div>
              )}
              {isOAuth && !stripeStatus.business_name && stripeStatus.stripe_user_id && (
                <div className="text-xs font-mono" style={{ color: '#c2c6d6' }}>{stripeStatus.stripe_user_id}</div>
              )}
              {!isOAuth && p?.masked_key && (
                <div className="text-xs font-mono" style={{ color: '#c2c6d6' }}>{p.masked_key}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOAuth && stripeStatus.livemode !== undefined && (
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${stripeStatus.livemode ? 'text-green-400' : 'text-yellow-400'}`}
                style={{ background: stripeStatus.livemode ? 'rgba(74, 222, 128, 0.1)' : 'rgba(250, 204, 21, 0.1)' }}>
                {stripeStatus.livemode ? 'Live' : 'Test'}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${(isOAuth || p?.connected) ? 'text-green-400' : 'text-gray-500'}`}
              style={(isOAuth || p?.connected) ? { background: 'rgba(74, 222, 128, 0.1)' } : { background: 'rgba(107, 114, 128, 0.1)' }}>
              {isOAuth ? 'OAuth Connected' : p?.connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>

        {isOAuth && stripeStatus.email && (
          <div className="text-xs mb-3" style={{ color: '#c2c6d6' }}>{stripeStatus.email}</div>
        )}

        {stripeSuccess && (
          <div className="text-xs mb-3 p-2 rounded text-green-400" style={{ background: 'rgba(74, 222, 128, 0.1)' }}>
            Stripe account connected successfully!
          </div>
        )}

        {testResult?.name === 'stripe' && (
          <div className={`text-xs mb-3 p-2 rounded ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}
            style={{ background: testResult.ok ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)' }}>
            {testResult.message}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {isOAuth ? (
            <button onClick={handleStripeDisconnect} disabled={stripeLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400"
              style={{ background: 'rgba(248, 113, 113, 0.1)' }}>
              {stripeLoading ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <>
              <button onClick={handleStripeConnect} disabled={stripeLoading}
                className="px-4 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: '#635bff', color: '#fff' }}>
                {stripeLoading ? 'Redirecting...' : 'Connect with Stripe'}
              </button>
              <button onClick={() => { setEditing('stripe'); setForm({}); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: '#2f3542', color: '#c2c6d6' }}>
                Enter keys manually
              </button>
            </>
          )}
          {(isOAuth || p?.connected) && (
            <button onClick={() => handleTest('stripe')} disabled={testing === 'stripe'}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(173, 198, 255, 0.1)', color: '#adc6ff' }}>
              {testing === 'stripe' ? 'Testing...' : 'Test'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-3 py-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-headline font-bold">Providers</h1>
      <p className="text-xs md:text-sm" style={{ color: '#c2c6d6' }}>Manage API keys and connections for all services</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderStripeCard()}
        {Object.entries(PROVIDER_CONFIG).filter(([name]) => name !== 'stripe').map(([name, cfg]) => {
          const p = providers[name];
          return (
            <div key={name} className="glass-panel rounded-2xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(173, 198, 255, 0.1)' }}>
                    <span className="material-symbols-outlined" style={{ color: '#adc6ff' }}>{cfg.icon}</span>
                  </div>
                  <div>
                    <div className="font-bold text-sm">{cfg.label}</div>
                    {p?.masked_key && <div className="text-xs font-mono" style={{ color: '#c2c6d6' }}>{p.masked_key}</div>}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${p?.connected ? 'text-green-400' : 'text-gray-500'}`}
                  style={p?.connected ? { background: 'rgba(74, 222, 128, 0.1)' } : { background: 'rgba(107, 114, 128, 0.1)' }}>
                  {p?.connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              {testResult?.name === name && (
                <div className={`text-xs mb-3 p-2 rounded ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}
                  style={{ background: testResult.ok ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)' }}>
                  {testResult.message}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setEditing(name); setForm({}); }} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#2f3542' }}>Update Keys</button>
                {p?.connected && (
                  <button onClick={() => handleTest(name)} disabled={testing === name} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(173, 198, 255, 0.1)', color: '#adc6ff' }}>
                    {testing === name ? 'Testing...' : 'Test'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-0 md:p-4" onClick={() => setEditing(null)}>
          <div className="glass-panel rounded-t-2xl md:rounded-2xl p-5 md:p-6 w-full md:max-w-md" style={{ background: '#1a202c' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Update {PROVIDER_CONFIG[editing]?.label}</h2>
            <div className="space-y-3">
              {PROVIDER_CONFIG[editing]?.fields.map(f => (
                <div key={f.key}>
                  <label className="block text-xs mb-1" style={{ color: '#c2c6d6' }}>{f.label}</label>
                  <input value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded-xl text-sm" style={{ background: '#2f3542', color: '#dde2f3', border: 'none', outline: 'none' }} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 min-h-[44px] md:min-h-0 text-sm" style={{ color: '#c2c6d6' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 min-h-[44px] md:min-h-0 rounded-xl text-sm font-bold" style={{ background: '#adc6ff', color: '#002e6a' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
