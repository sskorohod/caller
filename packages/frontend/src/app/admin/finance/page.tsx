'use client';
import { useState, useMemo } from 'react';
import { useAdminQuery, api } from '../_lib/admin-api';
import { fmtCurrency, fmtPercent, fmtDateTime, fmtDate } from '../_lib/format';
import { PLAN_BADGES, FINANCE_TYPE_COLORS } from '../_lib/constants';
import type { FinanceOverview, FinanceRevenueDay, FinanceTransaction } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminKpiCard from '../_components/AdminKpiCard';
import AdminChart from '../_components/AdminChart';
import AdminTable from '../_components/AdminTable';
import AdminBadge from '../_components/AdminBadge';
import AdminFilterBar from '../_components/AdminFilterBar';
import AdminLoadingState from '../_components/AdminLoadingState';
import AdminErrorState from '../_components/AdminErrorState';

interface FinanceData {
  overview: FinanceOverview;
  chart: FinanceRevenueDay[];
  transactions: FinanceTransaction[];
}

const TX_FILTER_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'topup', label: 'Top Up' },
  { value: 'usage', label: 'Usage' },
  { value: 'refund', label: 'Refund' },
  { value: 'gift', label: 'Gift' },
  { value: 'signup_bonus', label: 'Signup Bonus' },
];

const TX_TYPE_VARIANTS: Record<string, 'success' | 'primary' | 'warning' | 'info' | 'neutral' | 'error'> = {
  topup: 'success',
  usage: 'primary',
  refund: 'warning',
  gift: 'info',
  signup_bonus: 'info',
  subscription: 'neutral',
  promo: 'info',
};

export default function AdminFinance() {
  const [txFilter, setTxFilter] = useState('');

  // Initial parallel fetch
  const { data, loading, error, refetch } = useAdminQuery<FinanceData>(
    async () => {
      const [overview, chart, transactions] = await Promise.all([
        api.get<FinanceOverview>('/admin/finance/overview'),
        api.get<FinanceRevenueDay[]>('/admin/finance/revenue-chart'),
        api.get<FinanceTransaction[]>('/admin/finance/transactions?limit=30'),
      ]);
      return { overview, chart, transactions };
    },
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

  // Chart data for AdminChart
  const chartData = useMemo(() => {
    if (!data?.chart) return [];
    return data.chart.map((day) => ({
      label: fmtDate(day.date),
      value: parseFloat(day.usage_revenue) || 0,
    }));
  }, [data?.chart]);

  if (loading) return <AdminLoadingState rows={6} />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const { overview } = data;
  const { kpi } = overview;
  const transactions = filteredTx ?? data.transactions;

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

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <AdminPageHeader
        title="Finance"
        subtitle="Revenue, costs, and margin overview"
        icon="payments"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <AdminKpiCard
          label="Usage Revenue (30d)"
          value={fmtCurrency(kpi.usage_revenue_30d)}
          icon="payments"
          color="var(--th-success-text)"
        />
        <AdminKpiCard
          label="Provider Cost (30d)"
          value={fmtCurrency(kpi.real_provider_cost_30d)}
          icon="receipt_long"
          color="var(--th-error-text)"
        />
        <AdminKpiCard
          label="Margin"
          value={fmtPercent(kpi.margin_percent)}
          icon="trending_up"
          color={kpi.margin_percent > 60 ? 'var(--th-success-text)' : 'var(--th-warning-text)'}
        />
        <AdminKpiCard
          label="Deposits (30d)"
          value={fmtCurrency(kpi.deposits_30d)}
          icon="account_balance"
          color="var(--th-primary-text)"
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

      {/* Plan Distribution */}
      <div
        className="rounded-xl p-4 md:p-5"
        style={{
          background: 'var(--th-card)',
          border: '1px solid var(--th-card-border-subtle)',
          boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
        }}
      >
        <h3
          className="text-[10px] font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
        >
          Plan Distribution
        </h3>
        <div className="flex flex-wrap gap-4 md:gap-6">
          {overview.plan_counts.map((p) => {
            const badge = PLAN_BADGES[p.plan];
            return (
              <div key={p.plan} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: badge?.color ?? 'var(--th-text-muted)' }}
                />
                <span className="text-sm font-medium" style={{ color: 'var(--th-text)' }}>
                  {badge?.label ?? p.plan}
                </span>
                <span className="text-sm font-mono" style={{ color: 'var(--th-text-secondary)' }}>
                  {p.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue Chart */}
      {chartData.length > 0 && (
        <div
          className="rounded-xl p-4 md:p-6"
          style={{
            background: 'var(--th-card)',
            border: '1px solid var(--th-card-border-subtle)',
            boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
          }}
        >
          <h3
            className="text-[10px] font-semibold uppercase tracking-wider mb-4"
            style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
          >
            Revenue by Day (30d)
          </h3>
          <AdminChart
            data={chartData}
            height={140}
            formatValue={(v) => fmtCurrency(v)}
            color="var(--th-primary)"
          />
        </div>
      )}

      {/* Transactions */}
      <div
        className="rounded-xl p-4 md:p-6"
        style={{
          background: 'var(--th-card)',
          border: '1px solid var(--th-card-border-subtle)',
          boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
        }}
      >
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
  );
}
