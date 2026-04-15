'use client';
import Link from 'next/link';
import { useIsMobile } from '@/lib/useBreakpoint';
import { useAdminQuery, api } from './_lib/admin-api';
import { fmtCurrency, fmtDuration, fmtDateTime } from './_lib/format';
import type { DashboardData } from './_lib/types';
import AdminPageHeader from './_components/AdminPageHeader';
import AdminKpiCard from './_components/AdminKpiCard';
import AdminChart from './_components/AdminChart';
import AdminTable from './_components/AdminTable';
import AdminLoadingState from './_components/AdminLoadingState';
import AdminErrorState from './_components/AdminErrorState';

export default function AdminDashboard() {
  const isMobile = useIsMobile();
  const { data, loading, error, refetch } = useAdminQuery<DashboardData>(
    () => api.get<DashboardData>('/admin/dashboard'),
    [],
  );

  if (loading) return <AdminLoadingState />;
  if (error || !data) return <AdminErrorState error={error || 'Failed to load dashboard'} onRetry={refetch} />;

  const kpiCards = [
    { label: 'Total Revenue', value: fmtCurrency(data.kpi.total_revenue ?? 0), icon: 'payments', color: 'var(--th-primary-text)' },
    { label: 'Minutes Used', value: (data.kpi.minutes_used ?? 0).toFixed(0), icon: 'schedule', color: 'var(--th-success-text)' },
    { label: 'Margin', value: `${data.kpi.margin ?? 0}%`, icon: 'trending_up', color: (data.kpi.margin ?? 0) > 70 ? 'var(--th-success-text)' : 'var(--th-warning-text)' },
    { label: 'Sessions', value: (data.kpi.total_sessions ?? 0).toString(), icon: 'call', color: 'var(--th-info-text)' },
  ];

  const chartData = data.revenue_by_day.map((d) => ({
    label: d.date,
    value: parseFloat(d.revenue),
  }));

  const sessionColumns = [
    { key: 'date', label: 'Date', render: (r: Record<string, unknown>) => <span className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>{fmtDateTime(r.created_at as string)}</span> },
    { key: 'duration', label: 'Duration', render: (r: Record<string, unknown>) => <span className="font-mono text-xs">{fmtDuration(r.duration_seconds as number)}</span> },
    { key: 'cost', label: 'Cost', render: (r: Record<string, unknown>) => <span className="font-mono text-xs" style={{ color: 'var(--th-success-text)' }}>{fmtCurrency(parseFloat(r.cost_usd as string), 3)}</span> },
  ];

  return (
    <div className="py-4 md:py-6 space-y-5 md:space-y-6">
      <AdminPageHeader
        title="Dashboard"
        subtitle="Last 30 days overview"
        icon="dashboard"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiCards.map((card) => (
          <AdminKpiCard key={card.label} {...card} />
        ))}
      </div>

      {/* Revenue Chart */}
      {chartData.length > 0 && (
        <div
          className="rounded-xl p-4 md:p-5"
          style={{
            background: 'var(--th-card)',
            border: '1px solid var(--th-card-border-subtle)',
            boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
          }}
        >
          <h3
            className="text-[10px] font-medium uppercase tracking-wider mb-4"
            style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
          >
            Revenue by Day
          </h3>
          <AdminChart
            data={chartData}
            formatValue={(v) => fmtCurrency(v)}
            height={isMobile ? 120 : 160}
          />
        </div>
      )}

      {/* Recent Sessions */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3
            className="text-[10px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
          >
            Recent Sessions
          </h3>
          <Link
            href="/admin/sessions"
            className="text-xs font-medium min-h-[44px] flex items-center"
            style={{ color: 'var(--th-primary-text)' }}
          >
            View all
          </Link>
        </div>
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
  );
}
