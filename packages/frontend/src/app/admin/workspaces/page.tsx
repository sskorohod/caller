'use client';
import { useState } from 'react';
import { useAdminQuery, api } from '../_lib/admin-api';
import { fmtCurrency, fmtDateTime } from '../_lib/format';
import { PLAN_BADGES, PLANS, SUBSCRIPTION_STATUS_STYLES } from '../_lib/constants';
import type { Workspace, Transaction } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminBadge from '../_components/AdminBadge';
import AdminModal from '../_components/AdminModal';
import AdminFormField from '../_components/AdminFormField';
import { adminInputClass, adminSelectClass } from '../_components/AdminFormField';
import AdminSplitView from '../_components/AdminSplitView';
import AdminLoadingState from '../_components/AdminLoadingState';
import AdminErrorState from '../_components/AdminErrorState';

export default function AdminWorkspaces() {
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  // Balance modal
  const [balanceModal, setBalanceModal] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceType, setBalanceType] = useState<'topup' | 'gift' | 'refund'>('topup');
  const [balanceComment, setBalanceComment] = useState('');

  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState(false);

  const { data: workspaces, loading, error, refetch } = useAdminQuery<Workspace[]>(
    () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (planFilter) params.set('plan', planFilter);
      return api.get<Workspace[]>(`/admin/workspaces?${params}`);
    },
    [search, planFilter],
  );

  const selectWorkspace = async (ws: Workspace) => {
    setSelected(ws);
    try {
      const data = await api.get<{ workspace: Workspace; transactions: Transaction[] }>(`/admin/workspaces/${ws.id}`);
      setSelected(data.workspace);
      setTransactions(data.transactions);
    } catch {
      // Keep selected workspace with basic info
    }
  };

  const adjustBalance = async () => {
    if (!selected || !balanceAmount) return;
    try {
      await api.post(`/admin/workspaces/${selected.id}/balance`, {
        amount_usd: parseFloat(balanceAmount),
        type: balanceType,
        comment: balanceComment || undefined,
      });
      setBalanceModal(false);
      setBalanceAmount('');
      setBalanceComment('');
      selectWorkspace(selected);
      refetch();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const changePlan = async (id: string, plan: string) => {
    try {
      await api.patch(`/admin/workspaces/${id}/plan`, { plan });
      refetch();
      if (selected?.id === id) selectWorkspace({ ...selected, plan });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const deleteWorkspace = async () => {
    if (!selected) return;
    try {
      await api.delete(`/admin/workspaces/${selected.id}`);
      setSelected(null);
      setDeleteModal(false);
      refetch();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const toggleTwilio = async () => {
    if (!selected) return;
    const current = selected.provider_config?.twilio || 'own';
    const next = current === 'platform' ? 'own' : 'platform';
    try {
      await api.patch(`/admin/workspaces/${selected.id}/provider-config`, { twilio: next });
      const { twilio: _, ...restConfig } = selected.provider_config || {};
      const newConfig = next === 'platform' ? { ...restConfig, twilio: next } : restConfig;
      const updated = { ...selected, provider_config: newConfig };
      setSelected(updated);
      refetch();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (loading) return <AdminLoadingState />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;

  const list = workspaces ?? [];

  const listContent = (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className={`${adminInputClass} flex-1`}
        />
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className={adminSelectClass}
          style={{ maxWidth: '160px' }}
        >
          <option value="">All Plans</option>
          {PLANS.map((p) => (
            <option key={p} value={p}>{PLAN_BADGES[p]?.label || p}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--th-card)',
          border: '1px solid var(--th-card-border-subtle)',
          boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
        }}
      >
        {list.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--th-text-muted)' }}>
            <span className="material-symbols-outlined text-3xl mb-2 block">apartment</span>
            <p className="text-sm">No workspaces found</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--th-table-divider)' }}>
            {list.map((ws) => {
              const badge = PLAN_BADGES[ws.plan] || PLAN_BADGES.translator;
              const subStatus = SUBSCRIPTION_STATUS_STYLES[ws.subscription_status];
              return (
                <button
                  key={ws.id}
                  onClick={() => selectWorkspace(ws)}
                  className="w-full text-left px-4 py-3 transition-all flex items-center justify-between gap-3"
                  style={{
                    background: selected?.id === ws.id ? 'var(--th-primary-bg)' : undefined,
                  }}
                  onMouseEnter={(e) => { if (selected?.id !== ws.id) e.currentTarget.style.background = 'var(--th-table-row-hover)'; }}
                  onMouseLeave={(e) => { if (selected?.id !== ws.id) e.currentTarget.style.background = ''; }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{ws.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <AdminBadge bg={badge.bg} color={badge.color}>{badge.label}</AdminBadge>
                      {subStatus && (
                        <span className="text-[10px] font-medium" style={{ color: subStatus.color }}>
                          {subStatus.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className="font-mono text-sm font-medium shrink-0"
                    style={{ color: ws.balance_usd < 5 ? 'var(--th-warning-text)' : 'var(--th-success-text)' }}
                  >
                    {fmtCurrency(ws.balance_usd)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const detailContent = selected ? (
    <div
      className="rounded-xl p-5 space-y-5"
      style={{
        background: 'var(--th-card)',
        border: '1px solid var(--th-card-border-subtle)',
        boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
      }}
    >
      {/* Header */}
      <div>
        <h3 className="font-headline text-lg">{selected.name}</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--th-text-secondary)' }}>
          {selected.slug} &middot; {selected.id.slice(0, 8)}
        </p>
      </div>

      {/* Balance */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)' }}
      >
        <div
          className="text-[10px] uppercase tracking-wider font-medium mb-1"
          style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
        >
          Balance
        </div>
        <div
          className="text-3xl font-headline"
          style={{ color: selected.balance_usd < 5 ? 'var(--th-warning-text)' : 'var(--th-success-text)', lineHeight: 1.1 }}
        >
          {fmtCurrency(selected.balance_usd)}
        </div>
        <button
          onClick={() => setBalanceModal(true)}
          className="mt-3 btn-primary px-4 py-1.5 text-xs font-medium"
        >
          Adjust Balance
        </button>
      </div>

      {/* Plan */}
      <div>
        <div
          className="text-[10px] uppercase tracking-wider font-medium mb-2"
          style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
        >
          Plan
        </div>
        <div className="flex flex-wrap gap-2">
          {PLANS.map((p) => {
            const badge = PLAN_BADGES[p];
            const isActive = selected.plan === p;
            return (
              <button
                key={p}
                onClick={() => changePlan(selected.id, p)}
                className="px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium transition"
                style={
                  isActive
                    ? { background: badge.bg, color: badge.color, boxShadow: `${badge.color} 0px 0px 0px 1px` }
                    : { background: 'var(--th-surface)', border: '1px solid var(--th-border)' }
                }
              >
                {badge.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Twilio Access */}
      <div>
        <div
          className="text-[10px] uppercase tracking-wider font-medium mb-2"
          style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
        >
          Twilio Access
        </div>
        <button
          onClick={toggleTwilio}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition w-full"
          style={
            selected.provider_config?.twilio === 'platform'
              ? { background: 'var(--th-success-bg)', border: '1px solid var(--th-success-border)', color: 'var(--th-success-text)' }
              : { background: 'var(--th-surface)', border: '1px solid var(--th-border)' }
          }
        >
          <span className="text-base">
            {selected.provider_config?.twilio === 'platform' ? '✓' : '○'}
          </span>
          Share platform Twilio
        </button>
        {selected.provider_config?.twilio === 'platform' && (
          <p className="text-[10px] mt-1.5" style={{ color: 'var(--th-text-secondary)' }}>
            This workspace uses your Twilio account. Costs are deducted from their balance.
          </p>
        )}
      </div>

      {/* Other Providers */}
      {Object.keys(selected.provider_config || {}).filter((k) => k !== 'twilio').length > 0 && (
        <div>
          <div
            className="text-[10px] uppercase tracking-wider font-medium mb-2"
            style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
          >
            Other Providers
          </div>
          <div className="space-y-1">
            {Object.entries(selected.provider_config)
              .filter(([k]) => k !== 'twilio')
              .map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span>{k}</span>
                  <span className="font-mono" style={{ color: v === 'own' ? 'var(--th-primary-text)' : 'var(--th-success-text)' }}>
                    {v}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Delete */}
      <button
        onClick={() => setDeleteModal(true)}
        className="w-full px-3 py-2 rounded-lg text-xs font-medium transition"
        style={{
          background: 'var(--th-error-bg)',
          border: '1px solid var(--th-error-border)',
          color: 'var(--th-error-text)',
        }}
      >
        Delete Workspace
      </button>

      {/* Recent Transactions */}
      <div>
        <div
          className="text-[10px] uppercase tracking-wider font-medium mb-2"
          style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
        >
          Recent Transactions
        </div>
        <div className="space-y-1 max-h-60 overflow-y-auto scrollbar-none">
          {transactions.map((t) => (
            <div
              key={t.id}
              className="flex justify-between items-center text-xs py-1.5"
              style={{ borderBottom: '1px solid var(--th-border)' }}
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{t.type}</span>
                <span className="ml-2" style={{ color: 'var(--th-text-secondary)' }}>
                  {t.description}
                </span>
              </div>
              <span
                className="font-mono shrink-0 ml-2"
                style={{ color: t.amount_usd >= 0 ? 'var(--th-success-text)' : 'var(--th-error-text)' }}
              >
                {t.amount_usd >= 0 ? '+' : ''}
                {t.amount_usd.toFixed(4)}
              </span>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--th-text-muted)' }}>No transactions yet</p>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div
      className="rounded-xl p-8 text-center min-h-[50vh] flex items-center justify-center"
      style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)' }}
    >
      <div>
        <span className="material-symbols-outlined text-4xl mb-2 block" style={{ color: 'var(--th-text-muted)' }}>apartment</span>
        <p className="text-sm" style={{ color: 'var(--th-text-muted)' }}>Select a workspace</p>
      </div>
    </div>
  );

  return (
    <div className="py-4 md:py-6 space-y-4">
      <AdminPageHeader
        title="Workspaces"
        subtitle="Manage workspace plans and deposits"
        icon="apartment"
      />

      <AdminSplitView
        list={listContent}
        detail={detailContent}
        hasSelection={!!selected}
        onBack={() => setSelected(null)}
        listSpan={7}
        detailSpan={5}
      />

      {/* Balance Adjustment Modal */}
      <AdminModal
        open={balanceModal && !!selected}
        onClose={() => setBalanceModal(false)}
        title="Adjust Balance"
        actions={
          <>
            <button
              onClick={() => setBalanceModal(false)}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={adjustBalance}
              className="btn-primary px-4 py-2 text-sm font-medium"
            >
              Apply
            </button>
          </>
        }
      >
        {selected && (
          <p className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>
            {selected.name} — Current: {fmtCurrency(selected.balance_usd)}
          </p>
        )}
        <AdminFormField label="Type">
          <select
            value={balanceType}
            onChange={(e) => setBalanceType(e.target.value as 'topup' | 'gift' | 'refund')}
            className={adminSelectClass}
          >
            <option value="topup">Top Up</option>
            <option value="gift">Gift</option>
            <option value="refund">Refund</option>
          </select>
        </AdminFormField>
        <AdminFormField label="Amount (USD)">
          <input
            type="number"
            step="0.01"
            value={balanceAmount}
            onChange={(e) => setBalanceAmount(e.target.value)}
            className={adminInputClass}
            placeholder="10.00"
          />
        </AdminFormField>
        <AdminFormField label="Comment">
          <input
            value={balanceComment}
            onChange={(e) => setBalanceComment(e.target.value)}
            className={adminInputClass}
            placeholder="Optional"
          />
        </AdminFormField>
      </AdminModal>

      {/* Delete Confirmation Modal */}
      <AdminModal
        open={deleteModal && !!selected}
        onClose={() => setDeleteModal(false)}
        title="Delete Workspace"
        actions={
          <>
            <button
              onClick={() => setDeleteModal(false)}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={deleteWorkspace}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ background: 'var(--th-error-bg)', color: 'var(--th-error-text)' }}
            >
              Delete
            </button>
          </>
        }
      >
        {selected && (
          <p className="text-sm" style={{ lineHeight: 1.6 }}>
            Delete workspace <strong>&ldquo;{selected.name}&rdquo;</strong>? This will remove all data
            including calls, sessions, and billing history. This cannot be undone.
          </p>
        )}
      </AdminModal>
    </div>
  );
}
