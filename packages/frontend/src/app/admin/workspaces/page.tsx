'use client';
import { useState } from 'react';
import { useAdminQuery, api } from '../_lib/admin-api';
import { fmtCurrency } from '../_lib/format';
import type { Workspace, Transaction, RepeatBonusAttempt, AdminPersonalNumber, WorkspacesListResponse, WorkspaceUsage } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminKpiCard from '../_components/AdminKpiCard';
import AdminModal from '../_components/AdminModal';
import AdminFormField from '../_components/AdminFormField';
import { adminInputClass, adminSelectClass } from '../_components/AdminFormField';
import AdminSplitView from '../_components/AdminSplitView';
import AdminLoadingState from '../_components/AdminLoadingState';
import AdminErrorState from '../_components/AdminErrorState';

function fmtPhone(p?: string | null) {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return p;
}

const fmtShortDate = (d?: string | null) => d
  ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—';

type ListFlag = '' | 'repeat_phone' | 'low_balance' | 'has_number';
type ListSort = 'newest' | 'balance' | 'spent' | 'last_active';

const FLAG_OPTIONS: Array<{ value: ListFlag; label: string }> = [
  { value: '', label: 'All' },
  { value: 'repeat_phone', label: '⚑ Repeat phone' },
  { value: 'low_balance', label: 'Low balance' },
  { value: 'has_number', label: 'Has number' },
];

const SORT_OPTIONS: Array<{ value: ListSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'balance', label: 'Balance' },
  { value: 'spent', label: 'Spent' },
  { value: 'last_active', label: 'Last active' },
];

export default function AdminSubscribers() {
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [repeatAttempts, setRepeatAttempts] = useState<RepeatBonusAttempt[]>([]);
  const [personalNumbers, setPersonalNumbers] = useState<AdminPersonalNumber[]>([]);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const [search, setSearch] = useState('');
  const [flag, setFlag] = useState<ListFlag>('');
  const [sort, setSort] = useState<ListSort>('newest');

  // Balance modal
  const [balanceModal, setBalanceModal] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceType, setBalanceType] = useState<'topup' | 'gift' | 'refund' | 'deduction'>('topup');
  const [balanceComment, setBalanceComment] = useState('');

  // Stripe refund modal
  const [refundModal, setRefundModal] = useState<Transaction | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState<'requested_by_customer' | 'duplicate' | 'fraudulent'>('requested_by_customer');
  const [refundComment, setRefundComment] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);

  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState(false);

  const { data, loading, error, refetch } = useAdminQuery<WorkspacesListResponse>(
    () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (flag) params.set('flag', flag);
      if (sort !== 'newest') params.set('sort', sort);
      return api.get<WorkspacesListResponse>(`/admin/workspaces?${params}`);
    },
    [search, flag, sort],
  );

  const selectWorkspace = async (ws: Workspace) => {
    setSelected(ws);
    setRepeatAttempts([]);
    setPersonalNumbers([]);
    setOwnerEmail(ws.owner_email ?? null);
    setUsage(null);
    try {
      const data = await api.get<{
        workspace: Workspace;
        owner_email?: string | null;
        usage?: WorkspaceUsage;
        transactions: Transaction[];
        repeat_phone_attempts?: RepeatBonusAttempt[];
        personal_numbers?: AdminPersonalNumber[];
      }>(`/admin/workspaces/${ws.id}`);
      setSelected({ ...data.workspace, repeat_phone_attempts: ws.repeat_phone_attempts });
      setOwnerEmail(data.owner_email ?? ws.owner_email ?? null);
      setUsage(data.usage ?? null);
      setTransactions(data.transactions);
      setRepeatAttempts(data.repeat_phone_attempts ?? []);
      setPersonalNumbers(data.personal_numbers ?? []);
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

  const issueStripeRefund = async () => {
    if (!selected || !refundModal) return;
    setRefundBusy(true);
    try {
      const body: any = { transaction_id: refundModal.id, reason: refundReason };
      const amt = parseFloat(refundAmount || '');
      if (!isNaN(amt) && amt > 0) body.amount_usd = amt;
      if (refundComment.trim()) body.comment = refundComment.trim();
      const res = await api.post<{ refund_id: string; status: string; new_balance: number }>(
        `/admin/workspaces/${selected.id}/refund-stripe`, body);
      alert(`Refund ${res.status}: ${res.refund_id}\nNew balance: $${res.new_balance.toFixed(2)}`);
      setRefundModal(null);
      setRefundAmount('');
      setRefundComment('');
      selectWorkspace(selected);
      refetch();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRefundBusy(false);
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

  if (loading && !data) return <AdminLoadingState />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;

  const list = data?.workspaces ?? [];
  const stats = data?.stats;

  const listContent = (
    <div className={`space-y-3 transition-opacity ${loading ? 'opacity-50' : ''}`}>
      {/* Search + sort */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, owner, phone, email…"
          className={`${adminInputClass} flex-1`}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as ListSort)}
          className={adminSelectClass}
          style={{ width: 'auto' }}
          title="Sort"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {FLAG_OPTIONS.map(o => {
          const on = flag === o.value;
          return (
            <button
              key={o.value}
              onClick={() => setFlag(o.value)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition whitespace-nowrap"
              style={on
                ? { background: 'var(--th-primary-bg)', color: 'var(--th-primary-text)', border: '1px solid var(--th-primary)' }
                : { background: 'var(--th-card)', color: 'var(--th-text-secondary)', border: '1px solid var(--th-border)' }}
            >
              {o.label}
            </button>
          );
        })}
        {data && (
          <span className="ml-auto self-center text-[11px]" style={{ color: 'var(--th-text-muted)' }}>
            {data.total > list.length ? `showing ${list.length} of ${data.total}` : `${data.total} ${data.total === 1 ? 'subscriber' : 'subscribers'}`}
          </span>
        )}
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
            <span className="material-symbols-outlined text-3xl mb-2 block">person_off</span>
            <p className="text-sm">No subscribers found</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--th-table-divider)' }}>
            {list.map((ws) => {
              const phone = ws.phone_numbers?.[0];
              const owner = ws.owner_name || ws.name;
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
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-sm font-medium truncate">{owner}</div>
                      {ws.has_personal_number && (
                        <span className="material-symbols-outlined text-[14px] shrink-0" style={{ color: '#8b5cf6' }} title="Has a personal number">
                          sim_card
                        </span>
                      )}
                      {(ws.repeat_phone_attempts ?? 0) > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                          style={{ background: 'var(--th-warning-bg)', color: 'var(--th-warning-text)', border: '1px solid var(--th-warning-border)' }}
                        >
                          repeat phone
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--th-text-muted)' }}>
                      <span className="font-mono tabular-nums">{phone ? fmtPhone(phone) : ws.owner_email || 'no phone'}</span>
                      {' · '}joined {fmtShortDate(ws.created_at)}
                      {ws.last_session_at && <> · active {fmtShortDate(ws.last_session_at)}</>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className="font-mono text-sm font-medium tabular-nums"
                      style={{ color: ws.balance_usd < 5 ? 'var(--th-warning-text)' : 'var(--th-success-text)' }}
                    >
                      {fmtCurrency(ws.balance_usd)}
                    </div>
                    {(ws.spent_total ?? 0) > 0 && (
                      <div className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--th-text-muted)' }}>
                        spent {fmtCurrency(ws.spent_total!)}
                      </div>
                    )}
                  </div>
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
        <div className="flex items-center gap-2">
          <h3 className="font-headline text-lg">{selected.owner_name || selected.name}</h3>
          {repeatAttempts.length > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: 'var(--th-warning-bg)', color: 'var(--th-warning-text)', border: '1px solid var(--th-warning-border)' }}
            >
              repeat phone
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--th-text-secondary)' }}>
          <span className="font-mono tabular-nums">{selected.id.slice(0, 8)}</span>
          {' · '}joined {fmtShortDate(selected.created_at)}
        </p>
      </div>

      {/* Contacts */}
      <div className="space-y-1.5">
        {(selected.phone_numbers || []).filter(Boolean).map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--th-text-muted)' }}>call</span>
            <a href={`tel:${p}`} className="font-mono tabular-nums hover:underline">{fmtPhone(p)}</a>
          </div>
        ))}
        {ownerEmail && (
          <div className="flex items-center gap-2 text-xs">
            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--th-text-muted)' }}>mail</span>
            <a href={`mailto:${ownerEmail}`} className="hover:underline">{ownerEmail}</a>
          </div>
        )}
      </div>

      {/* Usage */}
      {usage && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)' }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
              Usage
            </div>
            {usage.bonus_granted && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: 'var(--th-success-bg)', color: 'var(--th-success-text)' }}>
                $2 gift granted
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
            {[
              { label: 'Sessions', value: String(usage.sessions_total) },
              { label: 'Minutes', value: usage.minutes_total.toFixed(0) },
              { label: 'Spent', value: fmtCurrency(usage.spent_total) },
              { label: 'Spent 30d', value: fmtCurrency(usage.spent_30d) },
              { label: 'Top-ups', value: fmtCurrency(usage.topup_total) },
              { label: 'Languages', value: usage.languages ?? '—' },
            ].map(item => (
              <div key={item.label}>
                <div className="text-[10px]" style={{ color: 'var(--th-text-muted)' }}>{item.label}</div>
                <div className="text-sm font-headline mt-0.5" style={{ color: 'var(--th-text)' }}>{item.value}</div>
              </div>
            ))}
          </div>
          {usage.last_session_at && (
            <div className="text-[11px] mt-2.5" style={{ color: 'var(--th-text-muted)' }}>
              Last session: {fmtShortDate(usage.last_session_at)}
            </div>
          )}
        </div>
      )}

      {/* Personal numbers */}
      {personalNumbers.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-medium mb-2"
            style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
            Personal number
          </div>
          <div className="space-y-1.5">
            {personalNumbers.map((pn) => (
              <div key={pn.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono tabular-nums">{fmtPhone(pn.phone_number)}</span>
                <span className="flex items-center gap-2">
                  <span style={{ color: 'var(--th-text-muted)' }}>
                    ${pn.monthly_price_usd.toFixed(2)}/mo
                    {pn.status === 'active'
                      ? ` · renews ${pn.next_renewal_at ? new Date(pn.next_renewal_at).toLocaleDateString() : '—'}`
                      : ` · released ${pn.released_at ? new Date(pn.released_at).toLocaleDateString() : ''}`}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={pn.status === 'active'
                      ? { background: 'var(--th-success-bg)', color: 'var(--th-success-text)' }
                      : { background: 'var(--th-surface)', color: 'var(--th-text-muted)' }}>
                    {pn.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Repeat $2-gift attempts */}
      {repeatAttempts.length > 0 && (
        <div
          className="rounded-xl p-3 space-y-1.5"
          style={{ background: 'var(--th-warning-bg)', border: '1px solid var(--th-warning-border)' }}
        >
          <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--th-warning-text)', letterSpacing: '0.5px' }}>
            Repeat $2-gift attempts
          </div>
          {repeatAttempts.map((a) => (
            <div key={a.id} className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>
              <span className="font-mono" style={{ color: 'var(--th-text)' }}>{fmtPhone(a.phone_number)}</span>
              {a.claimed_by_name && <> — claimed by {a.claimed_by_name}</>}
              <span style={{ color: 'var(--th-text-muted)' }}> · {new Date(a.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

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
          className="text-3xl font-headline tabular-nums"
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

      {/* Recent Transactions */}
      <div>
        <div
          className="text-[10px] uppercase tracking-wider font-medium mb-2"
          style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
        >
          Recent Transactions
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-none">
          {transactions.map((t) => {
            const isStripeTopup = t.type === 'topup' && t.reference_type === 'stripe_checkout';
            return (
              <div
                key={t.id}
                className="flex justify-between items-center gap-2 text-xs py-1.5"
                style={{ borderBottom: '1px solid var(--th-border)' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{t.type}</span>
                    {isStripeTopup && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)', color: 'var(--th-text-muted)' }}>
                        Stripe
                      </span>
                    )}
                  </div>
                  <div className="truncate" style={{ color: 'var(--th-text-secondary)' }}>
                    {t.description}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className="font-mono tabular-nums"
                    style={{ color: t.amount_usd >= 0 ? 'var(--th-success-text)' : 'var(--th-error-text)' }}
                  >
                    {t.amount_usd >= 0 ? '+' : ''}${Math.abs(t.amount_usd).toFixed(2)}
                  </span>
                  {isStripeTopup && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setRefundModal(t); setRefundAmount(String(Math.abs(t.amount_usd).toFixed(2))); }}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded hover:opacity-80 transition-all"
                      style={{ background: 'var(--th-error-bg)', color: 'var(--th-error-text)', border: '1px solid var(--th-error-border)' }}
                    >
                      Refund
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {transactions.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--th-text-muted)' }}>No transactions yet</p>
          )}
        </div>
      </div>

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
        Delete Subscriber
      </button>
    </div>
  ) : (
    <div
      className="rounded-xl p-8 text-center min-h-[50vh] flex items-center justify-center"
      style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)' }}
    >
      <div>
        <span className="material-symbols-outlined text-4xl mb-2 block" style={{ color: 'var(--th-text-muted)' }}>person</span>
        <p className="text-sm" style={{ color: 'var(--th-text-muted)' }}>Select a subscriber</p>
      </div>
    </div>
  );

  return (
    <div className="py-4 md:py-6 space-y-4">
      <AdminPageHeader
        title="Subscribers"
        subtitle="Translator accounts — balance, usage, transactions, refunds"
        icon="person"
      />

      {/* KPI summary (admin workspace excluded) */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AdminKpiCard label="Subscribers" value={String(stats.total_subscribers)} icon="group" color="var(--th-primary-text)" />
          <AdminKpiCard label="New (30d)" value={String(stats.new_30d)} icon="person_add" color="var(--th-success-text)" />
          <AdminKpiCard label="Active (30d)" value={String(stats.active_30d)} icon="call" color="var(--th-info-text)" />
          <AdminKpiCard label="With balance" value={String(stats.with_balance)} icon="account_balance_wallet" color="var(--th-text-secondary)" />
        </div>
      )}

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
            onChange={(e) => setBalanceType(e.target.value as 'topup' | 'gift' | 'refund' | 'deduction')}
            className={adminSelectClass}
          >
            <option value="topup">Top Up (+)</option>
            <option value="gift">Gift (+)</option>
            <option value="refund">Refund (+)</option>
            <option value="deduction">Deduct (−)</option>
          </select>
        </AdminFormField>
        <AdminFormField label="Amount (USD)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={balanceAmount}
            onChange={(e) => setBalanceAmount(e.target.value)}
            className={adminInputClass}
            placeholder="10.00"
          />
        </AdminFormField>
        {selected && balanceAmount && !isNaN(parseFloat(balanceAmount)) && (() => {
          const amt = parseFloat(balanceAmount);
          const newBal = selected.balance_usd + (balanceType === 'deduction' ? -amt : amt);
          return (
            <p className="text-xs" style={{ color: newBal < 0 ? 'var(--th-error-text)' : 'var(--th-text-secondary)' }}>
              New balance: <span className="font-mono font-medium">{fmtCurrency(newBal)}</span>
              {newBal < 0 && ' — goes negative'}
            </p>
          );
        })()}
        <AdminFormField label="Comment">
          <input
            value={balanceComment}
            onChange={(e) => setBalanceComment(e.target.value)}
            className={adminInputClass}
            placeholder="Optional"
          />
        </AdminFormField>
      </AdminModal>

      {/* Stripe Refund Modal */}
      <AdminModal
        open={!!refundModal && !!selected}
        onClose={() => { if (!refundBusy) setRefundModal(null); }}
        title="Refund via Stripe"
        actions={
          <>
            <button onClick={() => setRefundModal(null)} disabled={refundBusy} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button onClick={issueStripeRefund} disabled={refundBusy}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ background: 'var(--th-error-bg)', color: 'var(--th-error-text)', border: '1px solid var(--th-error-border)' }}>
              {refundBusy ? 'Refunding…' : 'Issue refund'}
            </button>
          </>
        }
      >
        {refundModal && (
          <>
            <p className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>
              Original topup: <strong>${Math.abs(refundModal.amount_usd).toFixed(2)}</strong> · {refundModal.description}
            </p>
            <AdminFormField label="Reason">
              <select value={refundReason} onChange={(e) => setRefundReason(e.target.value as any)} className={adminSelectClass}>
                <option value="requested_by_customer">Requested by customer</option>
                <option value="duplicate">Duplicate</option>
                <option value="fraudulent">Fraudulent</option>
              </select>
            </AdminFormField>
            <AdminFormField label="Amount (USD) — leave full to refund the whole transaction">
              <input type="number" step="0.01" min="0.01"
                max={Math.abs(refundModal.amount_usd)}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className={adminInputClass}
                placeholder={Math.abs(refundModal.amount_usd).toFixed(2)} />
            </AdminFormField>
            <AdminFormField label="Internal comment">
              <input value={refundComment} onChange={(e) => setRefundComment(e.target.value)} className={adminInputClass} placeholder="Optional" />
            </AdminFormField>
            <p className="text-[11px]" style={{ color: 'var(--th-warning-text)' }}>
              ⚠ This will issue a real refund through Stripe and debit the subscriber's balance.
            </p>
          </>
        )}
      </AdminModal>

      {/* Delete Confirmation Modal */}
      <AdminModal
        open={deleteModal && !!selected}
        onClose={() => setDeleteModal(false)}
        title="Delete Subscriber"
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
            Delete subscriber <strong>&ldquo;{selected.owner_name || selected.name}&rdquo;</strong>? This will remove all data
            including sessions, transactions, and billing history. This cannot be undone.
          </p>
        )}
      </AdminModal>
    </div>
  );
}
