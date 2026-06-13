'use client';
import { useState, useMemo } from 'react';
import { useAdminQuery, api } from '../_lib/admin-api';
import { fmtCurrency, fmtDateTime, fmtDate } from '../_lib/format';
import { PLAN_BADGES } from '../_lib/constants';
import type { FinanceOverview, FinanceRevenueChart, FinanceTransaction, Period, KpiWindow } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminKpiCard from '../_components/AdminKpiCard';
import AdminChart from '../_components/AdminChart';
import AdminTable from '../_components/AdminTable';
import AdminBadge from '../_components/AdminBadge';
import AdminFilterBar from '../_components/AdminFilterBar';
import AdminLoadingState from '../_components/AdminLoadingState';
import AdminErrorState from '../_components/AdminErrorState';
import AdminPeriodFilter from '../_components/AdminPeriodFilter';

interface FinanceData {
  overview: FinanceOverview;
  chart: FinanceRevenueChart;
  transactions: FinanceTransaction[];
}

const TX_FILTER_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'topup', label: 'Top Up' },
  { value: 'usage', label: 'Usage' },
  { value: 'refund', label: 'Refund' },
  { value: 'gift', label: 'Gift' },
  { value: 'signup_bonus', label: 'Signup Bonus' },
  { value: 'number_rental', label: 'Number Rental' },
  { value: 'deduction', label: 'Deduction' },
];

const TX_TYPE_VARIANTS: Record<string, 'success' | 'primary' | 'warning' | 'info' | 'neutral' | 'error'> = {
  topup: 'success',
  usage: 'primary',
  refund: 'warning',
  gift: 'info',
  signup_bonus: 'info',
  subscription: 'neutral',
  promo: 'info',
  number_rental: 'primary',
  deduction: 'error',
};

function deltaPct(w: KpiWindow): number | null {
  if (w.previous == null) return null;
  if (w.previous === 0) return w.current > 0 ? 100 : null;
  return ((w.current - w.previous) / w.previous) * 100;
}

function bucketLabel(date: string, granularity: FinanceRevenueChart['granularity']): string {
  const d = new Date(date);
  if (granularity === 'hour') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  // Day/month buckets are UTC calendar units (date_trunc in a UTC database) —
  // format them in UTC or every label shifts a day/month back west of UTC.
  if (granularity === 'day') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default function AdminFinance() {
  const [period, setPeriod] = useState<Period>('30d');
  const [txFilter, setTxFilter] = useState('');

  const { data, loading, error, refetch } = useAdminQuery<FinanceData>(
    async () => {
      const [overview, chart, transactions] = await Promise.all([
        api.get<FinanceOverview>(`/admin/finance/overview?period=${period}`),
        api.get<FinanceRevenueChart>(`/admin/finance/revenue-chart?period=${period}`),
        api.get<FinanceTransaction[]>('/admin/finance/transactions?limit=30'),
      ]);
      return { overview, chart, transactions };
    },
    [period],
  );

  // Filtered transactions fetch
  const { data: filteredTx } = useAdminQuery<FinanceTransaction[]>(
    () => {
      if (!txFilter) return Promise.resolve(data?.transactions ?? []);
      const params = new URLSearchParams({ limit: '30', type: txFilter });
      return api.get<FinanceTransaction[]>(`/admin/finance/transactions?${params}`);
    },
    [txFilter, data?.transactions],
  );

  const revenueChart = useMemo(() => {
    if (!data?.chart) return [];
    return data.chart.rows.map((r) => ({
      label: bucketLabel(r.date, data.chart.granularity),
      value: r.usage_revenue || 0,
    }));
  }, [data?.chart]);

  const depositsChart = useMemo(() => {
    if (!data?.chart) return [];
    return data.chart.rows.map((r) => ({
      label: bucketLabel(r.date, data.chart.granularity),
      value: r.deposits || 0,
    }));
  }, [data?.chart]);

  if (loading && !data) return <AdminLoadingState rows={6} />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const { overview } = data;
  const { kpi } = overview;
  const transactions = filteredTx ?? data.transactions;
  const marginDelta = kpi.margin_percent.previous != null
    ? kpi.margin_percent.current - kpi.margin_percent.previous
    : null;
  const breakdownTotal = overview.revenue_breakdown.usage + overview.revenue_breakdown.number_rental;

  const txColumns = [
    {
      key: 'workspace',
      label: 'Workspace',
      render: (row: FinanceTransaction) => (
        <span className="text-xs font-medium">
          {row.workspace_name || row.workspace_id?.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row: FinanceTransaction) => (
        <AdminBadge variant={TX_TYPE_VARIANTS[row.type] ?? 'neutral'}>
          {row.type}
        </AdminBadge>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row: FinanceTransaction) => (
        <span
          className="text-xs font-mono"
          style={{ color: row.amount_usd >= 0 ? 'var(--th-success-text)' : 'var(--th-error-text)' }}
        >
          {row.amount_usd >= 0 ? '+' : ''}{fmtCurrency(row.amount_usd, 4)}
        </span>
      ),
    },
    {
      key: 'balance',
      label: 'Balance After',
      render: (row: FinanceTransaction) => (
        <span className="text-xs font-mono" style={{ color: 'var(--th-text-secondary)' }}>
          {fmtCurrency(row.balance_after)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'description',
      label: 'Description',
      render: (row: FinanceTransaction) => (
        <span className="text-xs truncate max-w-[200px] block" style={{ color: 'var(--th-text-secondary)' }}>
          {row.description}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'date',
      label: 'Date',
      render: (row: FinanceTransaction) => (
        <span className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>
          {fmtDateTime(row.created_at)}
        </span>
      ),
    },
  ];

  const txMobileRender = (row: FinanceTransaction) => (
    <div>
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate">
            {row.workspace_name || row.workspace_id?.slice(0, 8)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <AdminBadge variant={TX_TYPE_VARIANTS[row.type] ?? 'neutral'}>
              {row.type}
            </AdminBadge>
            <span className="text-[10px]" style={{ color: 'var(--th-text-muted)' }}>
              {fmtDate(row.created_at)}
            </span>
          </div>
        </div>
        <span
          className="font-mono text-sm font-semibold ml-2 shrink-0"
          style={{ color: row.amount_usd >= 0 ? 'var(--th-success-text)' : 'var(--th-error-text)' }}
        >
          {row.amount_usd >= 0 ? '+' : ''}{fmtCurrency(row.amount_usd, 4)}
        </span>
      </div>
      {row.description && (
        <div className="text-[10px] mt-1.5 truncate" style={{ color: 'var(--th-text-secondary)' }}>
          {row.description}
        </div>
      )}
    </div>
  );

  const cardStyle = {
    background: 'var(--th-card)',
    border: '1px solid var(--th-card-border-subtle)',
    boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
  } as const;

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <AdminPageHeader
        title="Finance"
        subtitle="Revenue, costs, and margin — admin account excluded"
        icon="payments"
      />

      <AdminPeriodFilter value={period} onChange={setPeriod} />

      {/* While a period switch is in flight, dim the stale data so the
          numbers aren't misread as belonging to the new period. */}
      <div className={`space-y-5 md:space-y-6 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>

      {/* KPI Cards with trends vs previous period */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <AdminKpiCard
          label="Usage Revenue"
          value={fmtCurrency(kpi.usage_revenue.current)}
          icon="payments"
          color="var(--th-success-text)"
          trend={{ deltaPct: deltaPct(kpi.usage_revenue) }}
        />
        <AdminKpiCard
          label="Provider Cost"
          value={fmtCurrency(kpi.provider_cost.current)}
          icon="receipt_long"
          color="var(--th-error-text)"
          trend={{ deltaPct: deltaPct(kpi.provider_cost), invert: true }}
        />
        <AdminKpiCard
          label="Margin"
          value={`${kpi.margin_percent.current.toFixed(0)}%`}
          icon="trending_up"
          color={kpi.margin_percent.current > 60 ? 'var(--th-success-text)' : 'var(--th-warning-text)'}
          trend={{ deltaPct: marginDelta, suffix: ' pp' }}
        />
        <AdminKpiCard
          label="Deposits"
          value={fmtCurrency(kpi.deposits.current)}
          icon="account_balance"
          color="var(--th-primary-text)"
          trend={{ deltaPct: deltaPct(kpi.deposits) }}
        />
        <AdminKpiCard
          label="Total On Deposit"
          value={fmtCurrency(kpi.total_deposit_balance)}
          icon="savings"
          color="var(--th-info-text)"
        />
        <AdminKpiCard
          label="Active Subs"
          value={String(kpi.active_subscriptions)}
          icon="loyalty"
          color="var(--th-text-secondary)"
        />
      </div>

      {/* Charts: usage revenue + deposits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-4 md:p-5" style={cardStyle}>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
            Usage Revenue
          </h3>
          <AdminChart data={revenueChart} height={140} formatValue={(v) => fmtCurrency(v)} color="var(--th-primary)" />
        </div>
        <div className="rounded-xl p-4 md:p-5" style={cardStyle}>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
            Deposits (Stripe top-ups)
          </h3>
          <AdminChart data={depositsChart} height={140} formatValue={(v) => fmtCurrency(v)} color="#22c55e" />
        </div>
      </div>

      {/* Revenue breakdown + top spenders + plans */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Breakdown */}
        <div className="rounded-xl p-4 md:p-5" style={cardStyle}>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
            Revenue Breakdown
          </h3>
          {breakdownTotal === 0 ? (
            <p className="text-xs py-2" style={{ color: 'var(--th-text-muted)' }}>No revenue in this period</p>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Translator calls', value: overview.revenue_breakdown.usage, color: 'var(--th-primary)' },
                { label: 'Number rental', value: overview.revenue_breakdown.number_rental, color: '#8b5cf6' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--th-text)' }}>{item.label}</span>
                    <span className="font-mono" style={{ color: 'var(--th-text-secondary)' }}>
                      {fmtCurrency(item.value)} · {((item.value / breakdownTotal) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--th-surface)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(item.value / breakdownTotal) * 100}%`, background: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top spenders */}
        <div className="rounded-xl p-4 md:p-5" style={cardStyle}>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
            Top Spenders
          </h3>
          {overview.top_spenders.length === 0 ? (
            <p className="text-xs py-2" style={{ color: 'var(--th-text-muted)' }}>No spending in this period</p>
          ) : (
            <div className="space-y-2">
              {overview.top_spenders.map((s, i) => (
                <div key={s.workspace_id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 w-4 text-center font-mono" style={{ color: 'var(--th-text-muted)' }}>{i + 1}</span>
                    <span className="truncate" style={{ color: 'var(--th-text)' }}>{s.owner_name || s.workspace_name || s.workspace_id.slice(0, 8)}</span>
                  </span>
                  <span className="font-mono shrink-0" style={{ color: 'var(--th-success-text)' }}>{fmtCurrency(s.spent)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plan distribution */}
        <div className="rounded-xl p-4 md:p-5" style={cardStyle}>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
            Plan Distribution
          </h3>
          <div className="space-y-2">
            {overview.plan_counts.map((p) => {
              const badge = PLAN_BADGES[p.plan];
              return (
                <div key={p.plan} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: badge?.color ?? 'var(--th-text-muted)' }} />
                    <span style={{ color: 'var(--th-text)' }}>{badge?.label ?? p.plan}</span>
                  </span>
                  <span className="font-mono" style={{ color: 'var(--th-text-secondary)' }}>{p.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded-xl p-4 md:p-6" style={cardStyle}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <h3
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
          >
            Recent Transactions
          </h3>
          <AdminFilterBar
            options={TX_FILTER_OPTIONS}
            value={txFilter}
            onChange={setTxFilter}
          />
        </div>

        <AdminTable<FinanceTransaction & Record<string, unknown>>
          columns={txColumns as Array<{ key: string; label: string; render: (row: FinanceTransaction & Record<string, unknown>) => React.ReactNode; className?: string; hideOnMobile?: boolean }>}
          data={transactions as Array<FinanceTransaction & Record<string, unknown>>}
          keyField="id"
          pageSize={10}
          emptyIcon="receipt_long"
          emptyText="No transactions"
          mobileRender={(row) => txMobileRender(row as unknown as FinanceTransaction)}
        />
      </div>

      </div>
    </div>
  );
}
