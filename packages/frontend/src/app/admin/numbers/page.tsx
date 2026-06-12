'use client';
import { useState } from 'react';
import { useAdminQuery, api } from '../_lib/admin-api';
import { fmtCurrency } from '../_lib/format';
import type { AdminPersonalNumber } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminKpiCard from '../_components/AdminKpiCard';
import AdminTable from '../_components/AdminTable';
import AdminBadge from '../_components/AdminBadge';
import AdminLoadingState from '../_components/AdminLoadingState';
import AdminErrorState from '../_components/AdminErrorState';

interface NumbersResponse {
  numbers: AdminPersonalNumber[];
  stats: { active_count: number; released_count: number; mrr: number };
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'released', label: 'Released' },
] as const;

function fmtPhone(p?: string | null) {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return p;
}

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function AdminNumbers() {
  const [status, setStatus] = useState<string>('');

  const { data, loading, error, refetch } = useAdminQuery<NumbersResponse>(
    () => api.get<NumbersResponse>(`/admin/personal-numbers?limit=200${status ? `&status=${status}` : ''}`),
    [status],
  );

  if (loading) return <AdminLoadingState rows={5} />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const { numbers, stats } = data;

  const lowBalance = (row: AdminPersonalNumber) =>
    row.status === 'active' && row.balance_usd != null && row.balance_usd < row.monthly_price_usd;

  const columns = [
    {
      key: 'phone_number',
      label: 'Number',
      render: (row: AdminPersonalNumber) => (
        <span className="text-xs font-mono tabular-nums font-medium">{fmtPhone(row.phone_number)}</span>
      ),
    },
    {
      key: 'subscriber',
      label: 'Subscriber',
      render: (row: AdminPersonalNumber) => (
        <span className="text-xs">{row.owner_name || row.workspace_name || '—'}</span>
      ),
    },
    {
      key: 'price',
      label: 'Price',
      render: (row: AdminPersonalNumber) => (
        <span className="text-xs font-mono" style={{ color: 'var(--th-success-text)' }}>
          {fmtCurrency(row.monthly_price_usd)}/mo
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'purchased_at',
      label: 'Purchased',
      render: (row: AdminPersonalNumber) => (
        <span className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>{fmtDate(row.purchased_at)}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'renewal',
      label: 'Renewal',
      render: (row: AdminPersonalNumber) => row.status === 'active' ? (
        <span className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--th-text-secondary)' }}>
          {fmtDate(row.next_renewal_at)}
          {lowBalance(row) && <AdminBadge variant="warning">low balance</AdminBadge>}
        </span>
      ) : (
        <span className="text-xs" style={{ color: 'var(--th-text-muted)' }}>released {fmtDate(row.released_at)}</span>
      ),
    },
    {
      key: 'auto_renew',
      label: 'Auto-renew',
      render: (row: AdminPersonalNumber) => row.status === 'active' ? (
        <AdminBadge variant={row.auto_renew ? 'success' : 'neutral'}>{row.auto_renew ? 'on' : 'off'}</AdminBadge>
      ) : <span className="text-xs" style={{ color: 'var(--th-text-muted)' }}>—</span>,
      hideOnMobile: true,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: AdminPersonalNumber) => (
        <AdminBadge variant={row.status === 'active' ? 'success' : 'neutral'}>{row.status}</AdminBadge>
      ),
    },
  ];

  const mobileRender = (row: AdminPersonalNumber) => (
    <div>
      <div className="flex justify-between items-center">
        <span className="font-mono text-sm font-medium">{fmtPhone(row.phone_number)}</span>
        <AdminBadge variant={row.status === 'active' ? 'success' : 'neutral'}>{row.status}</AdminBadge>
      </div>
      <div className="flex justify-between items-center mt-1.5">
        <span className="text-[11px]" style={{ color: 'var(--th-text-secondary)' }}>
          {row.owner_name || row.workspace_name || '—'}
        </span>
        <span className="text-[11px] font-mono" style={{ color: 'var(--th-text-muted)' }}>
          {fmtCurrency(row.monthly_price_usd)}/mo
          {row.status === 'active' ? ` · ${fmtDate(row.next_renewal_at)}` : ''}
        </span>
      </div>
      {lowBalance(row) && (
        <div className="mt-1.5"><AdminBadge variant="warning">low balance</AdminBadge></div>
      )}
    </div>
  );

  return (
    <div className="py-4 md:py-6 space-y-5 md:space-y-6">
      <AdminPageHeader
        title="Personal Numbers"
        subtitle="Rented numbers — owner, renewal, status"
        icon="sim_card"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <AdminKpiCard
          label="Active Numbers"
          value={stats.active_count.toString()}
          icon="sim_card"
          color="var(--th-success-text)"
        />
        <AdminKpiCard
          label="Monthly Revenue"
          value={fmtCurrency(stats.mrr)}
          icon="payments"
          color="var(--th-primary-text)"
        />
        <AdminKpiCard
          label="Released"
          value={stats.released_count.toString()}
          icon="sim_card_download"
          color="var(--th-text-muted)"
        />
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {STATUS_FILTERS.map(f => {
          const on = status === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
              style={on
                ? { background: 'var(--th-primary-bg)', color: 'var(--th-primary-text)', border: '1px solid var(--th-primary)' }
                : { background: 'var(--th-card)', color: 'var(--th-text-secondary)', border: '1px solid var(--th-border)' }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <AdminTable<AdminPersonalNumber & Record<string, unknown>>
        columns={columns as Array<{ key: string; label: string; render: (row: AdminPersonalNumber & Record<string, unknown>) => React.ReactNode; className?: string; hideOnMobile?: boolean }>}
        data={numbers as Array<AdminPersonalNumber & Record<string, unknown>>}
        keyField="id"
        pageSize={20}
        emptyIcon="sim_card"
        emptyText="No personal numbers yet"
        mobileRender={(row) => mobileRender(row as unknown as AdminPersonalNumber)}
      />
    </div>
  );
}
