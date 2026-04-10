'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface BillingSettings {
  billing_markup?: string;
  billing_low_balance_threshold?: string;
  billing_signup_bonus_usd?: string;
  billing_agents_monthly_price?: string;
  billing_agents_mcp_monthly_price?: string;
}

export default function AdminBillingConfig() {
  const [settings, setSettings] = useState<BillingSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [markup, setMarkup] = useState('3.0');
  const [threshold, setThreshold] = useState('5.00');
  const [bonus, setBonus] = useState('2.00');
  const [agentsPrice, setAgentsPrice] = useState('49.00');
  const [agentsMcpPrice, setAgentsMcpPrice] = useState('99.00');

  useEffect(() => {
    api.get<BillingSettings>('/admin/billing-settings').then(data => {
      setSettings(data);
      if (data.billing_markup) setMarkup(data.billing_markup);
      if (data.billing_low_balance_threshold) setThreshold(data.billing_low_balance_threshold);
      if (data.billing_signup_bonus_usd) setBonus(data.billing_signup_bonus_usd);
      if (data.billing_agents_monthly_price) setAgentsPrice(data.billing_agents_monthly_price);
      if (data.billing_agents_mcp_monthly_price) setAgentsMcpPrice(data.billing_agents_mcp_monthly_price);
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/admin/billing-settings', {
        billing_markup: markup,
        billing_low_balance_threshold: threshold,
        billing_signup_bonus_usd: bonus,
        billing_agents_monthly_price: agentsPrice,
        billing_agents_mcp_monthly_price: agentsMcpPrice,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center opacity-50">Loading...</div>;

  const exampleCost = 0.05; // example provider cost per minute
  const clientCost = exampleCost * parseFloat(markup || '3');

  return (
    <div className="px-3 py-4 md:p-6 space-y-6 md:space-y-8">
      <div>
        <h1 className="text-xl md:text-2xl font-headline font-bold">Billing Configuration</h1>
        <p className="text-xs md:text-sm mt-1" style={{ color: 'var(--th-text-secondary)' }}>Platform pricing, markup, and thresholds</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Markup */}
        <div className="glass-panel rounded-2xl p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-lg" style={{ color: 'var(--th-success-text)' }}>trending_up</span>
            <h3 className="font-headline font-bold">Platform Markup</h3>
          </div>
          <p className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>
            Client pays: provider cost x markup. Default x3 means if a call costs us $0.05, client pays $0.15.
          </p>

          <div>
            <label className="text-xs font-medium block mb-1">Markup Multiplier</label>
            <input type="number" step="0.1" min="1" value={markup} onChange={e => setMarkup(e.target.value)}
              className="w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded-lg text-sm bg-white/5 border border-white/10 outline-none focus:border-blue-500/50" />
          </div>

          <div className="glass-panel rounded-xl p-3" style={{ borderLeft: '3px solid var(--th-success-text)' }}>
            <div className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>Example: $0.05 provider cost</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs">$0.05</span>
              <span className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>x {markup}</span>
              <span className="text-xs">=</span>
              <span className="font-mono font-bold" style={{ color: 'var(--th-success-text)' }}>${clientCost.toFixed(4)}</span>
              <span className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>client pays</span>
            </div>
          </div>
        </div>

        {/* Subscription Prices */}
        <div className="glass-panel rounded-2xl p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-lg" style={{ color: 'var(--th-primary-light)' }}>loyalty</span>
            <h3 className="font-headline font-bold">Subscription Prices</h3>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">Agents Plan ($/month)</label>
            <input type="number" step="1" min="0" value={agentsPrice} onChange={e => setAgentsPrice(e.target.value)}
              className="w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded-lg text-sm bg-white/5 border border-white/10 outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Agents + MCP Plan ($/month)</label>
            <input type="number" step="1" min="0" value={agentsMcpPrice} onChange={e => setAgentsMcpPrice(e.target.value)}
              className="w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded-lg text-sm bg-white/5 border border-white/10 outline-none focus:border-blue-500/50" />
          </div>
          <div className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>
            Translator plan has no subscription fee (deposit-only).
          </div>
        </div>

        {/* Thresholds */}
        <div className="glass-panel rounded-2xl p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-lg" style={{ color: 'var(--th-warning-text)' }}>warning</span>
            <h3 className="font-headline font-bold">Alerts & Thresholds</h3>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">Low Balance Alert Threshold ($)</label>
            <input type="number" step="0.5" min="0" value={threshold} onChange={e => setThreshold(e.target.value)}
              className="w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded-lg text-sm bg-white/5 border border-white/10 outline-none focus:border-blue-500/50" />
            <p className="text-xs mt-1" style={{ color: 'var(--th-text-secondary)' }}>Alert workspace owners when balance drops below this amount.</p>
          </div>
        </div>

        {/* Signup Bonus */}
        <div className="glass-panel rounded-2xl p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-lg" style={{ color: 'var(--th-accent-purple)' }}>redeem</span>
            <h3 className="font-headline font-bold">Signup Bonus</h3>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">Translator Signup Bonus ($)</label>
            <input type="number" step="0.5" min="0" value={bonus} onChange={e => setBonus(e.target.value)}
              className="w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded-lg text-sm bg-white/5 border border-white/10 outline-none focus:border-blue-500/50" />
            <p className="text-xs mt-1" style={{ color: 'var(--th-text-secondary)' }}>Free deposit credited to new Translator plan signups.</p>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="px-6 py-2.5 min-h-[44px] md:min-h-0 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && (
          <span className="text-sm font-medium" style={{ color: 'var(--th-success-text)' }}>
            <span className="material-symbols-outlined text-sm align-middle">check_circle</span> Saved
          </span>
        )}
      </div>
    </div>
  );
}
