'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useIsMobile } from '@/lib/useBreakpoint';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  balance_usd: number;
  subscription_status: string;
  subscription_current_period_end: string | null;
  provider_config: Record<string, string>;
  created_at: string;
}

interface Transaction {
  id: string;
  type: string;
  amount_usd: number;
  balance_after: number;
  description: string;
  created_at: string;
}

const planBadge: Record<string, { bg: string; color: string }> = {
  translator: { bg: 'rgba(173,198,255,0.1)', color: 'var(--th-primary-light)' },
  agents: { bg: 'rgba(74,222,128,0.1)', color: 'var(--th-success-text)' },
  agents_mcp: { bg: 'rgba(208,188,255,0.1)', color: 'var(--th-accent-purple)' },
};

export default function AdminWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  const isMobile = useIsMobile();

  // Balance modal
  const [balanceModal, setBalanceModal] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceType, setBalanceType] = useState<'topup' | 'gift' | 'refund'>('topup');
  const [balanceComment, setBalanceComment] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (planFilter) params.set('plan', planFilter);
    api.get<Workspace[]>(`/admin/workspaces?${params}`).then(setWorkspaces).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, planFilter]);

  const selectWorkspace = async (ws: Workspace) => {
    setSelected(ws);
    const data = await api.get<{ workspace: Workspace; transactions: Transaction[] }>(`/admin/workspaces/${ws.id}`);
    setSelected(data.workspace);
    setTransactions(data.transactions);
  };

  const adjustBalance = async () => {
    if (!selected || !balanceAmount) return;
    await api.post(`/admin/workspaces/${selected.id}/balance`, {
      amount_usd: parseFloat(balanceAmount),
      type: balanceType,
      comment: balanceComment || undefined,
    });
    setBalanceModal(false);
    setBalanceAmount('');
    setBalanceComment('');
    selectWorkspace(selected);
    load();
  };

  const changePlan = async (id: string, plan: string) => {
    await api.patch(`/admin/workspaces/${id}/plan`, { plan });
    load();
    if (selected?.id === id) selectWorkspace({ ...selected, plan });
  };

  if (loading) return <div className="p-4 md:p-8 text-center opacity-50">Loading...</div>;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-lg md:text-2xl font-headline font-bold">Workspaces</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--th-text-secondary)' }}>Manage workspace plans and deposits</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="px-3 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 flex-1 outline-none focus:border-blue-500/50"
        />
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 outline-none">
          <option value="">All Plans</option>
          <option value="translator">Translator</option>
          <option value="agents">Agents</option>
          <option value="agents_mcp">Agents + MCP</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Workspace List */}
        <div className="lg:col-span-2">
          {isMobile ? (
            <div className="space-y-2">
              {workspaces.map(ws => {
                const badge = planBadge[ws.plan] || planBadge.translator;
                return (
                  <div key={ws.id}
                    onClick={() => selectWorkspace(ws)}
                    className="glass-panel rounded-xl p-4 cursor-pointer active:scale-[0.98] transition"
                    style={{ background: selected?.id === ws.id ? 'rgba(173,198,255,0.08)' : undefined }}>
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{ws.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: badge.bg, color: badge.color }}>{ws.plan}</span>
                          {ws.subscription_status === 'active' ? <span className="text-[10px]" style={{ color: 'var(--th-success-text)' }}>Active</span> :
                           ws.subscription_status === 'canceled' ? <span className="text-[10px]" style={{ color: 'var(--th-warning-text)' }}>Canceled</span> :
                           ws.subscription_status === 'past_due' ? <span className="text-[10px]" style={{ color: '#f87171' }}>Past Due</span> : null}
                        </div>
                      </div>
                      <span className="font-mono text-sm font-bold" style={{ color: ws.balance_usd < 5 ? 'var(--th-warning-text)' : 'var(--th-success-text)' }}>
                        ${ws.balance_usd.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {workspaces.length === 0 && <div className="text-center py-8 opacity-50 text-sm">No workspaces found</div>}
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b" style={{ borderColor: 'var(--th-border)' }}>
                    <th className="px-4 py-3 font-medium" style={{ color: 'var(--th-text-secondary)' }}>Name</th>
                    <th className="px-4 py-3 font-medium" style={{ color: 'var(--th-text-secondary)' }}>Plan</th>
                    <th className="px-4 py-3 font-medium" style={{ color: 'var(--th-text-secondary)' }}>Balance</th>
                    <th className="px-4 py-3 font-medium" style={{ color: 'var(--th-text-secondary)' }}>Subscription</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map(ws => {
                    const badge = planBadge[ws.plan] || planBadge.translator;
                    return (
                      <tr key={ws.id}
                        onClick={() => selectWorkspace(ws)}
                        className="border-b cursor-pointer hover:bg-white/5 transition"
                        style={{ borderColor: 'var(--th-border)', background: selected?.id === ws.id ? 'rgba(173,198,255,0.05)' : undefined }}>
                        <td className="px-4 py-3 font-medium">{ws.name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: badge.bg, color: badge.color }}>
                            {ws.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: ws.balance_usd < 5 ? 'var(--th-warning-text)' : 'var(--th-success-text)' }}>
                          ${ws.balance_usd.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--th-text-secondary)' }}>
                          {ws.subscription_status === 'active' ? <span style={{ color: 'var(--th-success-text)' }}>Active</span> :
                           ws.subscription_status === 'canceled' ? <span style={{ color: 'var(--th-warning-text)' }}>Canceled</span> :
                           ws.subscription_status === 'past_due' ? <span style={{ color: '#f87171' }}>Past Due</span> :
                           <span>None</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {workspaces.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center opacity-50">No workspaces found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Workspace Detail */}
        <div className="glass-panel rounded-2xl p-5 space-y-5">
          {selected ? (
            <>
              <div>
                <h3 className="font-headline font-bold text-lg">{selected.name}</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--th-text-secondary)' }}>{selected.slug} &middot; {selected.id.slice(0, 8)}</p>
              </div>

              {/* Balance */}
              <div className="glass-panel rounded-xl p-4">
                <div className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--th-text-secondary)' }}>Balance</div>
                <div className="text-3xl font-headline font-bold" style={{ color: selected.balance_usd < 5 ? 'var(--th-warning-text)' : 'var(--th-success-text)' }}>
                  ${selected.balance_usd.toFixed(2)}
                </div>
                <button onClick={() => setBalanceModal(true)}
                  className="mt-3 px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 transition">
                  Adjust Balance
                </button>
              </div>

              {/* Plan */}
              <div>
                <div className="text-xs uppercase tracking-wider font-medium mb-2" style={{ color: 'var(--th-text-secondary)' }}>Plan</div>
                <div className="flex flex-wrap gap-2">
                  {['translator', 'agents', 'agents_mcp'].map(p => (
                    <button key={p} onClick={() => changePlan(selected.id, p)}
                      className="px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium transition"
                      style={selected.plan === p
                        ? { background: planBadge[p].bg, color: planBadge[p].color, border: `1px solid ${planBadge[p].color}40` }
                        : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }
                      }>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Share Twilio */}
              <div>
                <div className="text-xs uppercase tracking-wider font-medium mb-2" style={{ color: 'var(--th-text-secondary)' }}>Twilio Access</div>
                <button
                  onClick={async () => {
                    const current = selected.provider_config?.twilio || 'own';
                    const next = current === 'platform' ? 'own' : 'platform';
                    await api.patch(`/admin/workspaces/${selected.id}/provider-config`, { twilio: next });
                    const { twilio: _, ...restConfig } = selected.provider_config || {};
                    const newConfig = next === 'platform' ? { ...restConfig, twilio: next } : restConfig;
                    const updated = { ...selected, provider_config: newConfig };
                    setSelected(updated);
                    load();
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition w-full"
                  style={
                    (selected.provider_config?.twilio === 'platform')
                      ? { background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: 'var(--th-success-text)' }
                      : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }
                  }
                >
                  <span className="text-base">{selected.provider_config?.twilio === 'platform' ? '✓' : '○'}</span>
                  Share platform Twilio
                </button>
                {selected.provider_config?.twilio === 'platform' && (
                  <p className="text-[10px] mt-1.5" style={{ color: 'var(--th-text-secondary)' }}>
                    This workspace uses your Twilio account. Costs are deducted from their balance.
                  </p>
                )}
              </div>

              {/* Provider Config */}
              {Object.keys(selected.provider_config || {}).filter(k => k !== 'twilio').length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider font-medium mb-2" style={{ color: 'var(--th-text-secondary)' }}>Other Providers</div>
                  <div className="space-y-1">
                    {Object.entries(selected.provider_config).filter(([k]) => k !== 'twilio').map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span>{k}</span>
                        <span className="font-mono" style={{ color: v === 'own' ? 'var(--th-primary-light)' : 'var(--th-success-text)' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delete Workspace */}
              <button
                onClick={async () => {
                  if (!confirm(`Delete workspace "${selected.name}"? This will remove all data including calls, sessions, and billing history. This cannot be undone.`)) return;
                  await api.delete(`/admin/workspaces/${selected.id}`);
                  setSelected(null);
                  load();
                }}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium transition hover:bg-red-500/20"
                style={{ border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                Delete Workspace
              </button>

              {/* Recent Transactions */}
              <div>
                <div className="text-xs uppercase tracking-wider font-medium mb-2" style={{ color: 'var(--th-text-secondary)' }}>Recent Transactions</div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {transactions.map(t => (
                    <div key={t.id} className="flex justify-between items-center text-xs py-1 border-b" style={{ borderColor: 'var(--th-border)' }}>
                      <div>
                        <span className="font-medium">{t.type}</span>
                        <span className="ml-2" style={{ color: 'var(--th-text-secondary)' }}>{t.description}</span>
                      </div>
                      <span className="font-mono" style={{ color: t.amount_usd >= 0 ? 'var(--th-success-text)' : '#f87171' }}>
                        {t.amount_usd >= 0 ? '+' : ''}{t.amount_usd.toFixed(4)}
                      </span>
                    </div>
                  ))}
                  {transactions.length === 0 && <p className="text-xs opacity-50">No transactions yet</p>}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center opacity-50 py-12">
              <span className="material-symbols-outlined text-3xl mb-2 block">apartment</span>
              Select a workspace
            </div>
          )}
        </div>
      </div>

      {/* Balance Adjustment Modal */}
      {balanceModal && selected && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setBalanceModal(false)}>
          <div className="glass-panel rounded-t-2xl md:rounded-2xl p-6 w-full md:w-96 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-headline font-bold">Adjust Balance</h3>
            <p className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>{selected.name} — Current: ${selected.balance_usd.toFixed(2)}</p>

            <div>
              <label className="text-xs font-medium block mb-1">Type</label>
              <select value={balanceType} onChange={e => setBalanceType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10">
                <option value="topup">Top Up</option>
                <option value="gift">Gift</option>
                <option value="refund">Refund</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Amount (USD)</label>
              <input type="number" step="0.01" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 outline-none"
                placeholder="10.00" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Comment</label>
              <input value={balanceComment} onChange={e => setBalanceComment(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 outline-none"
                placeholder="Optional" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBalanceModal(false)} className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition">Cancel</button>
              <button onClick={adjustBalance} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 font-medium transition">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
