'use client';
import { useState } from 'react';
import { useAdminQuery, api } from '../_lib/admin-api';
import { fmtCurrency } from '../_lib/format';
import type { Workspace, Transaction, RepeatBonusAttempt, AdminPersonalNumber } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
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

export default function AdminSubscribers() {
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [repeatAttempts, setRepeatAttempts] = useState<RepeatBonusAttempt[]>([]);
  const [personalNumbers, setPersonalNumbers] = useState<AdminPersonalNumber[]>([]);
  const [search, setSearch] = useState('');
  const [flagRepeat, setFlagRepeat] = useState(false);

  // Balance modal
  const [balanceModal, setBalanceModal] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceType, setBalanceType] = useState<'topup' | 'gift' | 'refund'>('topup');
  const [balanceComment, setBalanceComment] = useState('');

  // Stripe refund modal
  const [refundModal, setRefundModal] = useState<Transaction | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState<'requested_by_customer' | 'duplicate' | 'fraudulent'>('requested_by_customer');
  const [refundComment, setRefundComment] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);

  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState(false);

  const { data: workspaces, loading, error, refetch } = useAdminQuery<Workspace[]>(
    () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (flagRepeat) params.set('flag', 'repeat_phone');
      return api.get<Workspace[]>(`/admin/workspaces?${params}`);
    },
    [search, flagRepeat],
  );

  const selectWorkspace = async (ws: Workspace) => {
    setSelected(ws);
    setRepeatAttempts([]);
    setPersonalNumbers([]);
    try {
      const data = await api.get<{ workspace: Workspace; transactions: Transaction[]; repeat_phone_attempts?: RepeatBonusAttempt[]; personal_numbers?: AdminPersonalNumber[] }>(`/admin/workspaces/${ws.id}`);
      setSelected({ ...data.workspace, repeat_phone_attempts: ws.repeat_phone_attempts });
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

  if (loading) return <AdminLoadingState />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;

  const list = workspaces ?? [];

  const listContent = (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, owner, phone…"
          className={`${adminInputClass} flex-1`}
        />
        <button
          onClick={() => setFlagRepeat(v => !v)}
          className="px-3 rounded-lg text-xs font-medium whitespace-nowrap transition"
          style={flagRepeat
            ? { background: 'var(--th-warning-bg)', color: 'var(--th-warning-text)', border: '1px solid var(--th-warning-border)' }
            : { background: 'var(--th-card)', color: 'var(--th-text-secondary)', border: '1px solid var(--th-border)' }}
          title="Show only accounts that tried to re-use a phone that already claimed the $2 gift"
        >
          ⚑ Repeat phone
        </button>
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
                      {(ws.repeat_phone_attempts ?? 0) > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                          style={{ background: 'var(--th-warning-bg)', color: 'var(--th-warning-text)', border: '1px solid var(--th-warning-border)' }}
                        >
                          repeat phone
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] mt-0.5 font-mono tabular-nums" style={{ color: 'var(--th-text-muted)' }}>
                      {phone ? fmtPhone(phone) : <span className="italic">no phone registered</span>}
                    </div>
                  </div>
                  <span
                    className="font-mono text-sm font-medium shrink-0 tabular-nums"
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
        <p className="text-xs mt-0.5 font-mono tabular-nums" style={{ color: 'var(--th-text-secondary)' }}>
          {selected.id.slice(0, 8)}
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
        {selected.email && (
          <div className="flex items-center gap-2 text-xs">
            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--th-text-muted)' }}>mail</span>
            <a href={`mailto:${selected.email}`} className="hover:underline">{selected.email}</a>
          </div>
        )}
      </div>

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
        subtitle="Translator accounts — balance, transactions, refunds"
        icon="person"
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
