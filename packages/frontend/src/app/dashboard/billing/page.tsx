'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface BillingInfo {
  balance_usd: number;
  plan: string;
  plan_name: string;
  subscription_status: string;
  subscription_current_period_end: string | null;
  provider_config: Record<string, string>;
  features: {
    liveTranslator: boolean;
    aiAgents: boolean;
    mcpAccess: boolean;
    maxAgentProfiles: number;
    maxTelephonyConnections: number;
  };
}

interface Transaction {
  id: string;
  type: string;
  amount_usd: number;
  balance_after: number;
  description: string;
  created_at: string;
}

interface PlanInfo {
  id: string;
  name: string;
  has_subscription: boolean;
  features: Record<string, boolean | number>;
}

const PROVIDERS = ['twilio', 'deepgram', 'openai', 'anthropic', 'elevenlabs', 'xai'];

export default function BillingPage() {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);

  const load = () => {
    Promise.all([
      api.get<BillingInfo>('/billing/balance'),
      api.get<Transaction[]>('/billing/transactions?limit=20'),
      api.get<PlanInfo[]>('/billing/plans'),
    ]).then(([b, t, p]) => {
      setInfo(b);
      setTransactions(t);
      setPlans(p);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const topUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount < 1) return;
    const result = await api.post<{ url: string }>('/billing/deposit/checkout', { amount_usd: amount });
    if (result.url) window.location.href = result.url;
  };

  const subscribe = async (planId: string) => {
    const result = await api.post<{ url: string }>('/billing/subscription', { plan: planId });
    if (result.url) window.location.href = result.url;
  };

  const cancelSub = async () => {
    if (!confirm('Cancel subscription at end of billing period?')) return;
    await api.delete('/billing/subscription');
    load();
  };

  const toggleProvider = async (provider: string, mode: 'platform' | 'own') => {
    setTogglingProvider(provider);
    const updated = await api.patch<Record<string, string>>('/billing/provider-config', { [provider]: mode });
    setInfo(prev => prev ? { ...prev, provider_config: updated } : prev);
    setTogglingProvider(null);
  };

  if (loading || !info) return <div className="p-8 text-center opacity-50">Loading billing info...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your plan, deposit, and providers</p>
      </div>

      {/* Plan + Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Plan */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Current Plan</div>
              <div className="text-2xl font-bold mt-1">{info.plan_name}</div>
            </div>
            {info.subscription_status === 'active' && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">Active</span>
            )}
          </div>

          <div className="space-y-1 text-sm">
            {info.features.liveTranslator && <div className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Live Translator</div>}
            {info.features.aiAgents && <div className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> AI Agents</div>}
            {info.features.mcpAccess && <div className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> MCP Access</div>}
            {!info.features.aiAgents && <div className="flex items-center gap-2"><span className="text-gray-400">&#10007;</span> <span className="text-gray-400">AI Agents</span></div>}
            {!info.features.mcpAccess && <div className="flex items-center gap-2"><span className="text-gray-400">&#10007;</span> <span className="text-gray-400">MCP Access</span></div>}
          </div>

          {info.subscription_status === 'active' && (
            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-800">
              <span className="text-xs text-gray-500">
                Next billing: {info.subscription_current_period_end ? new Date(info.subscription_current_period_end).toLocaleDateString() : 'N/A'}
              </span>
              <button onClick={cancelSub} className="text-xs text-red-500 hover:text-red-400">Cancel</button>
            </div>
          )}

          {/* Upgrade buttons */}
          {info.plan !== 'agents_mcp' && (
            <div className="flex gap-2 pt-2">
              {info.plan === 'translator' && (
                <button onClick={() => subscribe('agents')}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition">
                  Upgrade to Agents
                </button>
              )}
              <button onClick={() => subscribe('agents_mcp')}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition">
                {info.plan === 'translator' ? 'Upgrade to Agents + MCP' : 'Upgrade to MCP'}
              </button>
            </div>
          )}
        </div>

        {/* Balance */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Deposit Balance</div>
            <div className="text-3xl font-bold mt-1" style={{ color: info.balance_usd < 5 ? '#f59e0b' : '#10b981' }}>
              ${info.balance_usd.toFixed(2)}
            </div>
          </div>

          <div className="flex gap-2">
            <input type="number" min="5" step="5" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)}
              placeholder="Amount ($)" className="flex-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-900 dark:border-gray-700 outline-none" />
            <button onClick={topUp}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition whitespace-nowrap">
              Top Up
            </button>
          </div>

          <div className="flex gap-2">
            {[10, 25, 50, 100].map(amt => (
              <button key={amt} onClick={() => setTopUpAmount(String(amt))}
                className="flex-1 py-1.5 text-xs font-medium border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition dark:border-gray-700">
                ${amt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Provider Toggle */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="font-bold mb-1">Provider Configuration</h3>
        <p className="text-xs text-gray-500 mb-4">
          Use <strong>Platform</strong> providers (costs deducted from deposit) or <strong>Own</strong> keys (free, you pay the provider directly).
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PROVIDERS.map(provider => {
            const mode = info.provider_config[provider] || 'platform';
            const isOwn = mode === 'own';
            return (
              <div key={provider} className="flex items-center justify-between p-3 rounded-lg border dark:border-gray-700">
                <span className="text-sm font-medium capitalize">{provider}</span>
                <button
                  onClick={() => toggleProvider(provider, isOwn ? 'platform' : 'own')}
                  disabled={togglingProvider === provider}
                  className="relative w-16 h-7 rounded-full transition-colors"
                  style={{ background: isOwn ? '#3b82f6' : '#10b981' }}>
                  <div className="absolute top-1 transition-all w-5 h-5 rounded-full bg-white shadow"
                    style={{ left: isOwn ? '2.25rem' : '0.25rem' }} />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                    {isOwn ? 'OWN' : 'OURS'}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="font-bold mb-4">Transaction History</h3>
        <div className="space-y-0">
          {transactions.map(t => (
            <div key={t.id} className="flex justify-between items-center py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div>
                <div className="text-sm font-medium">{t.description || t.type}</div>
                <div className="text-xs text-gray-500">{new Date(t.created_at).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono font-bold" style={{ color: t.amount_usd >= 0 ? '#10b981' : '#ef4444' }}>
                  {t.amount_usd >= 0 ? '+' : ''}{t.amount_usd.toFixed(4)}
                </div>
                <div className="text-[10px] text-gray-400 font-mono">${t.balance_after.toFixed(2)}</div>
              </div>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No transactions yet</p>}
        </div>
      </div>
    </div>
  );
}
