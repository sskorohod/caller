'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface FinanceOverview {
  kpi: {
    total_deposit_balance: number;
    deposits_30d: number;
    usage_revenue_30d: number;
    real_provider_cost_30d: number;
    margin_percent: number;
    active_subscriptions: number;
    total_sessions_30d: number;
  };
  plan_counts: Array<{ plan: string; count: number }>;
}

interface RevenueDay {
  date: string;
  deposits: string;
  usage_revenue: string;
}

interface Transaction {
  id: string;
  workspace_id: string;
  workspace_name: string;
  type: string;
  amount_usd: number;
  balance_after: number;
  description: string;
  created_at: string;
}

const typeColors: Record<string, string> = {
  topup: '#4ade80',
  usage: '#f87171',
  refund: '#fbbf24',
  gift: '#adc6ff',
  signup_bonus: '#d0bcff',
  promo: '#67e8f9',
};

export default function AdminFinance() {
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [chart, setChart] = useState<RevenueDay[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txFilter, setTxFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<FinanceOverview>('/admin/finance/overview'),
      api.get<RevenueDay[]>('/admin/finance/revenue-chart'),
      api.get<Transaction[]>('/admin/finance/transactions?limit=30'),
    ]).then(([o, c, t]) => {
      setOverview(o);
      setChart(c);
      setTransactions(t);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ limit: '30' });
    if (txFilter) params.set('type', txFilter);
    api.get<Transaction[]>(`/admin/finance/transactions?${params}`).then(setTransactions);
  }, [txFilter]);

  if (loading || !overview) return <div className="p-8 text-center opacity-50">Loading...</div>;

  const kpiCards = [
    { label: 'Usage Revenue (30d)', value: `$${overview.kpi.usage_revenue_30d.toFixed(2)}`, color: '#4ade80', icon: 'payments' },
    { label: 'Provider Cost (30d)', value: `$${overview.kpi.real_provider_cost_30d.toFixed(2)}`, color: '#f87171', icon: 'receipt_long' },
    { label: 'Margin', value: `${overview.kpi.margin_percent}%`, color: overview.kpi.margin_percent > 60 ? '#4ade80' : '#fbbf24', icon: 'trending_up' },
    { label: 'Deposits (30d)', value: `$${overview.kpi.deposits_30d.toFixed(2)}`, color: '#adc6ff', icon: 'account_balance' },
    { label: 'Total On Deposit', value: `$${overview.kpi.total_deposit_balance.toFixed(2)}`, color: '#d0bcff', icon: 'savings' },
    { label: 'Active Subs', value: String(overview.kpi.active_subscriptions), color: '#67e8f9', icon: 'loyalty' },
  ];

  const maxRev = Math.max(...chart.map(d => parseFloat(d.usage_revenue) || 0.01), 0.01);

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-headline font-bold">Finance</h1>
        <p className="text-sm mt-1" style={{ color: '#c2c6d6' }}>Revenue, costs, and margin overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map(card => (
          <div key={card.label} className="glass-panel rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="material-symbols-outlined text-lg" style={{ color: card.color, opacity: 0.4 }}>{card.icon}</span>
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#c2c6d6' }}>{card.label}</div>
            <div className="text-xl font-headline font-bold" style={{ color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Plan Distribution */}
      <div className="glass-panel rounded-2xl p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#c2c6d6' }}>Plan Distribution</h3>
        <div className="flex gap-6">
          {overview.plan_counts.map(p => (
            <div key={p.plan} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{
                background: p.plan === 'translator' ? '#adc6ff' : p.plan === 'agents' ? '#4ade80' : '#d0bcff'
              }} />
              <span className="text-sm font-medium">{p.plan}</span>
              <span className="text-sm font-mono" style={{ color: '#c2c6d6' }}>{p.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Chart */}
      {chart.length > 0 && (
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#c2c6d6' }}>Revenue by Day (30d)</h3>
          <div className="flex items-end gap-1 h-32">
            {chart.map((day, i) => {
              const rev = parseFloat(day.usage_revenue) || 0;
              const dep = parseFloat(day.deposits) || 0;
              const height = (rev / maxRev) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5"
                  title={`${day.date}\nRevenue: $${rev.toFixed(2)}\nDeposits: $${dep.toFixed(2)}`}>
                  <div className="w-full rounded-t transition-all" style={{
                    height: `${Math.max(height, 2)}%`,
                    background: 'linear-gradient(to top, #4ade80, #67e8f9)',
                    minHeight: '2px',
                  }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px]" style={{ color: '#c2c6d6' }}>
            <span>{chart[0]?.date}</span>
            <span>{chart[chart.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#c2c6d6' }}>Recent Transactions</h3>
          <select value={txFilter} onChange={e => setTxFilter(e.target.value)}
            className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10">
            <option value="">All Types</option>
            <option value="topup">Top Up</option>
            <option value="usage">Usage</option>
            <option value="refund">Refund</option>
            <option value="gift">Gift</option>
            <option value="signup_bonus">Signup Bonus</option>
          </select>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: '#c2c6d6' }}>
              <th className="pb-2 font-medium">Workspace</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Amount</th>
              <th className="pb-2 font-medium">Balance After</th>
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id} className="border-t" style={{ borderColor: 'rgba(66,71,84,0.15)' }}>
                <td className="py-2 text-xs">{t.workspace_name || t.workspace_id?.slice(0, 8)}</td>
                <td className="py-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{
                    background: `${typeColors[t.type] || '#6b7280'}15`,
                    color: typeColors[t.type] || '#6b7280',
                  }}>
                    {t.type}
                  </span>
                </td>
                <td className="py-2 font-mono text-xs" style={{ color: t.amount_usd >= 0 ? '#4ade80' : '#f87171' }}>
                  {t.amount_usd >= 0 ? '+' : ''}{t.amount_usd.toFixed(4)}
                </td>
                <td className="py-2 font-mono text-xs" style={{ color: '#c2c6d6' }}>${t.balance_after.toFixed(2)}</td>
                <td className="py-2 text-xs" style={{ color: '#c2c6d6' }}>{t.description}</td>
                <td className="py-2 text-xs" style={{ color: '#c2c6d6' }}>{new Date(t.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {transactions.length === 0 && <tr><td colSpan={6} className="py-4 text-center opacity-50">No transactions</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
