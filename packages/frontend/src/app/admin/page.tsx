'use client';
import { useState } from 'react';
import { useIsMobile } from '@/lib/useBreakpoint';
import { useAdminQuery, api } from './_lib/admin-api';
import { fmtCurrency, fmtDuration, fmtDateTime } from './_lib/format';
import type { DashboardData, DashboardLiveData, Period, KpiWindow } from './_lib/types';
import AdminPageHeader from './_components/AdminPageHeader';
import AdminKpiCard from './_components/AdminKpiCard';
import AdminChart from './_components/AdminChart';
import AdminTable from './_components/AdminTable';
import AdminLoadingState from './_components/AdminLoadingState';
import AdminErrorState from './_components/AdminErrorState';
import AdminPeriodFilter from './_components/AdminPeriodFilter';
import AdminLivePanel from './_components/AdminLivePanel';
import AdminFunnel from './_components/AdminFunnel';
import AdminHealthBlock from './_components/AdminHealthBlock';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  year: 'Last 12 months',
  all: 'All time',
};

// % delta vs the previous window; null → no trend (e.g. All time or empty base)
function deltaPct(w: KpiWindow): number | null {
  if (w.previous == null) return null;
  if (w.previous === 0) return w.current > 0 ? 100 : null;
  return ((w.current - w.previous) / w.previous) * 100;
}

function bucketLabel(bucket: string, granularity: DashboardData['granularity']): string {
  const d = new Date(bucket);
  if (granularity === 'hour') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  // Day/month buckets are UTC calendar units (date_trunc in a UTC database) —
  // format them in UTC or every label shifts a day/month back west of UTC.
  if (granularity === 'day') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default function AdminDashboard() {
  const isMobile = useIsMobile();
  const [period, setPeriod] = useState<Period>('30d');

  const { data, loading, error, refetch } = useAdminQuery<DashboardData>(
    () => api.get<DashboardData>(`/admin/dashboard?period=${period}`),
    [period],
  );
  const { data: live } = useAdminQuery<DashboardLiveData>(
    () => api.get<DashboardLiveData>('/admin/dashboard/live'),
    [],
    { pollMs: 30_000 },
  );

  if (loading && !data) return <AdminLoadingState />;
  if (error || !data) return <AdminErrorState error={error || 'Failed to load dashboard'} onRetry={refetch} />;

  const { kpi } = data;
  const marginDelta = kpi.margin_percent.previous != null
    ? kpi.margin_percent.current - kpi.margin_percent.previous
    : null;

  const kpiCards = [
    {
      label: 'Revenue', value: fmtCurrency(kpi.revenue.current), icon: 'payments',
      color: 'var(--th-primary-text)', trend: { deltaPct: deltaPct(kpi.revenue) },
    },
    {
      label: 'Margin', value: `${kpi.margin_percent.current.toFixed(0)}%`, icon: 'trending_up',
      color: kpi.margin_percent.current > 50 ? 'var(--th-success-text)' : 'var(--th-warning-text)',
      // Margin trend is a percentage-POINT delta, not a relative %
      trend: { deltaPct: marginDelta, suffix: ' pp' },
    },
    {
      label: 'Sessions', value: String(kpi.sessions.current), icon: 'call',
      color: 'var(--th-info-text)', trend: { deltaPct: deltaPct(kpi.sessions) },
    },
    {
      label: 'Minutes', value: kpi.minutes.current.toFixed(0), icon: 'schedule',
      color: 'var(--th-success-text)', trend: { deltaPct: deltaPct(kpi.minutes) },
    },
    {
      label: 'Signups', value: String(kpi.signups.current), icon: 'person_add',
      color: 'var(--th-primary-text)', trend: { deltaPct: deltaPct(kpi.signups) },
    },
    {
      label: 'Active users', value: String(kpi.active_users.current), icon: 'group',
      color: 'var(--th-info-text)', trend: { deltaPct: deltaPct(kpi.active_users) },
    },
  ];

  const revenueChart = data.revenue_by_bucket.map(b => ({ label: bucketLabel(b.bucket, data.granularity), value: b.value }));
  const signupsChart = data.signups_by_bucket.map(b => ({ label: bucketLabel(b.bucket, data.granularity), value: b.value }));

  const sessionColumns = [
    { key: 'date', label: 'Date', render: (r: Record<string, unknown>) => <span className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>{fmtDateTime(r.created_at as string)}</span> },
    { key: 'duration', label: 'Duration', render: (r: Record<string, unknown>) => <span className="font-mono text-xs">{fmtDuration(r.duration_seconds as number)}</span> },
    { key: 'cost', label: 'Cost', render: (r: Record<string, unknown>) => <span className="font-mono text-xs" style={{ color: 'var(--th-success-text)' }}>{fmtCurrency(parseFloat(r.cost_usd as string), 3)}</span> },
  ];

  return (
    <div className="py-4 md:py-6 space-y-5 md:space-y-6">
      <AdminPageHeader
        title="Dashboard"
        subtitle={PERIOD_LABELS[period]}
        icon="dashboard"
      />

      <AdminPeriodFilter value={period} onChange={setPeriod} />

      {/* Live now */}
      <AdminLivePanel data={live} />

      {/* While a period switch is in flight, dim the stale data so the
          numbers aren't misread as belonging to the new period. */}
      <div className={`space-y-5 md:space-y-6 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>

      {/* KPI cards with trends vs previous period */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((card) => (
          <AdminKpiCard key={card.label} {...card} />
        ))}
      </div>

      {/* Charts: revenue + signups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4 md:p-5"
          style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)', boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px' }}
        >
          <h3 className="text-[10px] font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
            Revenue
          </h3>
          <AdminChart data={revenueChart} formatValue={(v) => fmtCurrency(v)} height={isMobile ? 120 : 150} />
        </div>
        <div
          className="rounded-xl p-4 md:p-5"
          style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)', boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px' }}
        >
          <h3 className="text-[10px] font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
            Signups
          </h3>
          <AdminChart data={signupsChart} formatValue={(v) => v.toFixed(0)} height={isMobile ? 120 : 150} color="#22c55e" />
        </div>
      </div>

      {/* Funnel + Health side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <AdminFunnel funnel={data.funnel} />
        <AdminHealthBlock health={data.health} />
      </div>

      {/* Repeat $2-gift attempts */}
      {(data.repeat_bonus_attempts?.length ?? 0) > 0 && (
        <div
          className="rounded-xl p-4 md:p-5"
          style={{
            background: 'var(--th-warning-bg)',
            border: '1px solid var(--th-warning-border)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--th-warning-text)' }}>warning</span>
            <h3 className="text-xs font-semibold" style={{ color: 'var(--th-warning-text)' }}>
              Repeat $2-gift attempts
            </h3>
          </div>
          <div className="space-y-2">
            {data.repeat_bonus_attempts!.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--th-text-secondary)' }}>
                <span className="font-mono font-medium" style={{ color: 'var(--th-text)' }}>{a.phone_number}</span>
                <span>{a.workspace_name ?? 'deleted workspace'}</span>
                {a.claimed_by_name && <span>originally claimed by {a.claimed_by_name}</span>}
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: 'var(--th-warning-bg)', color: 'var(--th-warning-text)', border: '1px solid var(--th-warning-border)' }}
                >
                  {a.source === 'phone_update' ? 'phone added' : a.source === 'magic_link' ? 'magic link' : 'register'}
                </span>
                <span style={{ color: 'var(--th-text-muted)' }}>{fmtDateTime(a.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div>
        <h3
          className="text-[10px] font-medium uppercase tracking-wider mb-3"
          style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
        >
          Recent Sessions
        </h3>
        <AdminTable
          columns={sessionColumns}
          data={data.recent_sessions as unknown as Record<string, unknown>[]}
          keyField="id"
          pageSize={5}
          emptyText="No sessions yet"
          emptyIcon="call"
          mobileRender={(sess) => (
            <div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs">{fmtDuration(sess.duration_seconds as number)}</span>
                <span className="font-mono text-xs font-medium" style={{ color: 'var(--th-success-text)' }}>
                  {fmtCurrency(parseFloat(sess.cost_usd as string), 3)}
                </span>
              </div>
              <div className="text-[10px] mt-1" style={{ color: 'var(--th-text-secondary)' }}>
                {fmtDateTime(sess.created_at as string)}
              </div>
            </div>
          )}
        />
      </div>

      </div>
    </div>
  );
}
