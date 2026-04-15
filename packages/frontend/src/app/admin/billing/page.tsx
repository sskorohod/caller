'use client';
import { useState } from 'react';
import { useAdminQuery, api } from '../_lib/admin-api';
import type { BillingSettings } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminFormField, { adminInputClass } from '../_components/AdminFormField';
import AdminLoadingState from '../_components/AdminLoadingState';

export default function AdminBillingConfig() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [markup, setMarkup] = useState('3.0');
  const [threshold, setThreshold] = useState('5.00');
  const [bonus, setBonus] = useState('2.00');
  const [agentsPrice, setAgentsPrice] = useState('49.00');
  const [agentsMcpPrice, setAgentsMcpPrice] = useState('99.00');

  const { loading } = useAdminQuery<BillingSettings>(
    async () => {
      const data = await api.get<BillingSettings>('/admin/billing-settings');
      if (data.billing_markup) setMarkup(data.billing_markup);
      if (data.billing_low_balance_threshold) setThreshold(data.billing_low_balance_threshold);
      if (data.billing_signup_bonus_usd) setBonus(data.billing_signup_bonus_usd);
      if (data.billing_agents_monthly_price) setAgentsPrice(data.billing_agents_monthly_price);
      if (data.billing_agents_mcp_monthly_price) setAgentsMcpPrice(data.billing_agents_mcp_monthly_price);
      return data;
    },
    [],
  );

  const save = async () => {
    const markupNum = parseFloat(markup);
    if (isNaN(markupNum) || markupNum < 1) {
      alert('Markup multiplier must be at least 1');
      return;
    }
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

  if (loading) return <AdminLoadingState rows={4} />;

  const exampleCost = 0.05;
  const clientCost = exampleCost * parseFloat(markup || '3');

  return (
    <div className="px-3 py-4 md:p-6 space-y-6 md:space-y-8">
      <AdminPageHeader
        title="Billing Configuration"
        subtitle="Platform pricing, markup, and thresholds"
        icon="receipt_long"
      />

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

          <AdminFormField label="Markup Multiplier">
            <input
              type="number"
              step="0.1"
              min="1"
              value={markup}
              onChange={e => setMarkup(e.target.value)}
              className={adminInputClass}
            />
          </AdminFormField>

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

          <AdminFormField label="Agents Plan ($/month)">
            <input
              type="number"
              step="1"
              min="0"
              value={agentsPrice}
              onChange={e => setAgentsPrice(e.target.value)}
              className={adminInputClass}
            />
          </AdminFormField>

          <AdminFormField label="Agents + MCP Plan ($/month)">
            <input
              type="number"
              step="1"
              min="0"
              value={agentsMcpPrice}
              onChange={e => setAgentsMcpPrice(e.target.value)}
              className={adminInputClass}
            />
          </AdminFormField>

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

          <AdminFormField label="Low Balance Alert Threshold ($)" hint="Alert workspace owners when balance drops below this amount.">
            <input
              type="number"
              step="0.5"
              min="0"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              className={adminInputClass}
            />
          </AdminFormField>
        </div>

        {/* Signup Bonus */}
        <div className="glass-panel rounded-2xl p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-lg" style={{ color: 'var(--th-accent-purple)' }}>redeem</span>
            <h3 className="font-headline font-bold">Signup Bonus</h3>
          </div>

          <AdminFormField label="Translator Signup Bonus ($)" hint="Free deposit credited to new Translator plan signups.">
            <input
              type="number"
              step="0.5"
              min="0"
              value={bonus}
              onChange={e => setBonus(e.target.value)}
              className={adminInputClass}
            />
          </AdminFormField>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary px-6 py-2.5 min-h-[44px] md:min-h-0 rounded-xl text-sm font-bold disabled:opacity-50 transition"
        >
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
