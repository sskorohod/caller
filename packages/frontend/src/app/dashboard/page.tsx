'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  total_calls: number;
  today_calls: number;
  week_calls: number;
  active_calls: number;
  success_rate: number;
  status_breakdown: Record<string, number>;
  direction_breakdown: Record<string, number>;
  sentiment_breakdown: Record<string, number>;
  avg_duration_seconds: number;
  total_minutes_30d: number;
  cost_total_30d: number;
  avg_qa_score: number;
  total_turns_30d: number;
  daily_calls: { day: string; count: number }[];
  top_agents: { agent_profile_id: string; count: number }[];
}

interface RecentCall {
  id: string;
  direction: string;
  status: string;
  phone_number_to: string;
  phone_number_from: string;
  duration_seconds: number | null;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
  is_active: boolean;
}

interface TelConnection {
  phone_number: string;
  inbound_enabled: boolean;
  outbound_enabled: boolean;
  ai_answering_enabled: boolean;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function fmtDuration(sec: number | null) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtCost(v: number) {
  return v < 0.01 ? '$0.00' : `$${v.toFixed(2)}`;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]',
  failed: 'bg-[var(--th-error-bg)] text-[var(--th-error-text)]',
  in_progress: 'bg-[var(--th-info-bg)] text-[var(--th-info-text)]',
  initiated: 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]',
  ringing: 'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]',
  cancelled: 'bg-[var(--th-surface)] text-[var(--th-text-muted)]',
  canceled: 'bg-[var(--th-surface)] text-[var(--th-text-muted)]',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  failed: 'Failed',
  in_progress: 'In Progress',
  initiated: 'Initiated',
  ringing: 'Ringing',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-[var(--th-success-icon)]',
  negative: 'bg-[var(--th-error-icon)]',
  neutral: 'bg-[var(--th-text-muted)]',
  mixed: 'bg-[var(--th-warning-icon)]',
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, trend }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean } | null;
}) {
  return (
    <div className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] p-5 shadow-[0_1px_3px_var(--th-shadow)] hover:border-[var(--th-primary-muted)] transition-colors cursor-default">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-[var(--th-text-muted)] uppercase tracking-wide">{label}</span>
        <div className="w-9 h-9 rounded-lg bg-[var(--th-surface)] flex items-center justify-center text-[var(--th-text-muted)]">
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-[var(--th-text)] leading-none">{value}</span>
        {trend && (
          <span className={`text-xs font-semibold leading-none pb-0.5 ${trend.positive ? 'text-[var(--th-success-text)]' : 'text-[var(--th-error-text)]'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      {sub && <div className="text-xs text-[var(--th-text-muted)] mt-1.5">{sub}</div>}
    </div>
  );
}

// ─── Weekly Chart ────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function WeeklyChart({ dailyCalls, t }: { dailyCalls: { day: string; count: number }[]; t: (k: string) => string }) {
  const chartData = useMemo(() => {
    const now = new Date();
    const days: { label: string; date: string; count: number; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const match = dailyCalls.find(dc => dc.day === dateStr);
      days.push({
        label: DAY_LABELS[d.getDay()],
        date: dateStr,
        count: match?.count ?? 0,
        isToday: i === 0,
      });
    }
    return days;
  }, [dailyCalls]);

  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] p-6 shadow-[0_1px_3px_var(--th-shadow)]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('dashboard.callsThisWeek')}</h3>
        <span className="text-xs text-[var(--th-text-muted)]">{t('dashboard.last7Days')}</span>
      </div>
      <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
        {chartData.map(day => {
          const barH = maxCount > 0 ? Math.max((day.count / maxCount) * 110, day.count > 0 ? 6 : 0) : 0;
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5 group">
              <span className="text-[11px] font-semibold text-[var(--th-text)] opacity-0 group-hover:opacity-100 transition-opacity">{day.count}</span>
              <div className="w-full flex justify-center">
                <div
                  className={`w-full max-w-[32px] rounded-md transition-all group-hover:opacity-80 ${day.isToday ? 'bg-[var(--th-primary)]' : ''}`}
                  style={{
                    height: barH || 3,
                    backgroundColor: day.isToday ? undefined : (day.count > 0 ? 'var(--th-primary-muted)' : 'var(--th-border)'),
                  }}
                />
              </div>
              <span className={`text-[10px] font-medium ${day.isToday ? 'text-[var(--th-primary-text)] font-semibold' : 'text-[var(--th-text-muted)]'}`}>{day.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Status Breakdown (Mini Donut) ───────────────────────────────────────────

function StatusBreakdown({ data, t }: { data: Record<string, number>; t: (k: string) => string }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const colors: Record<string, string> = {
    completed: 'var(--th-success-icon)',
    failed: 'var(--th-error-icon)',
    in_progress: 'var(--th-info-text)',
    initiated: 'var(--th-primary)',
    ringing: 'var(--th-warning-icon)',
    cancelled: 'var(--th-text-muted)',
    canceled: 'var(--th-text-muted)',
  };

  // Build conic-gradient
  let gradParts: string[] = [];
  let offset = 0;
  for (const [status, count] of entries) {
    const pct = (count / total) * 100;
    const color = colors[status] ?? 'var(--th-text-muted)';
    gradParts.push(`${color} ${offset}% ${offset + pct}%`);
    offset += pct;
  }

  return (
    <div className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] p-6 shadow-[0_1px_3px_var(--th-shadow)]">
      <h3 className="text-sm font-semibold text-[var(--th-text)] mb-5">{t('dashboard.callStatus')}</h3>
      <div className="flex items-center gap-6">
        {/* Mini Donut */}
        <div className="relative w-24 h-24 shrink-0">
          <div
            className="w-full h-full rounded-full"
            style={{ background: `conic-gradient(${gradParts.join(', ')})` }}
          />
          <div className="absolute inset-[6px] rounded-full bg-[var(--th-card)] flex items-center justify-center">
            <span className="text-lg font-bold text-[var(--th-text)]">{total}</span>
          </div>
        </div>
        {/* Legend */}
        <div className="flex-1 space-y-2">
          {entries.map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[status] ?? 'var(--th-text-muted)' }} />
                <span className="text-xs text-[var(--th-text-secondary)] capitalize">{STATUS_LABELS[status] ?? status}</span>
              </div>
              <span className="text-xs font-semibold text-[var(--th-text)]">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sentiment Bar ───────────────────────────────────────────────────────────

function SentimentBar({ data, t }: { data: Record<string, number>; t: (k: string) => string }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const order = ['positive', 'neutral', 'mixed', 'negative'];
  const labels: Record<string, string> = { positive: 'Positive', neutral: 'Neutral', mixed: 'Mixed', negative: 'Negative' };

  return (
    <div className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] p-6 shadow-[0_1px_3px_var(--th-shadow)]">
      <h3 className="text-sm font-semibold text-[var(--th-text)] mb-4">{t('dashboard.sentiment')}</h3>
      {/* Stacked bar */}
      <div className="flex w-full h-3 rounded-full overflow-hidden mb-4">
        {order.map(key => {
          const count = data[key] ?? 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return <div key={key} className={`${SENTIMENT_COLORS[key]} transition-all`} style={{ width: `${pct}%` }} />;
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {order.map(key => {
          const count = data[key] ?? 0;
          if (count === 0) return null;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${SENTIMENT_COLORS[key]}`} />
              <span className="text-xs text-[var(--th-text-secondary)]">{labels[key]}</span>
              <span className="text-xs font-semibold text-[var(--th-text)] ml-auto">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quick Actions ───────────────────────────────────────────────────────────

function QuickActions({ t }: { t: (k: string) => string }) {
  const actions = [
    { href: '/dashboard/agents', label: t('dashboard.qaNewAgent'), icon: <IconSparkle />, color: 'text-[var(--th-primary-text)]' },
    { href: '/dashboard/calls', label: t('dashboard.qaViewCalls'), icon: <IconPhone />, color: 'text-[var(--th-success-text)]' },
    { href: '/dashboard/knowledge', label: t('dashboard.qaKnowledge'), icon: <IconBook />, color: 'text-[var(--th-info-text)]' },
    { href: '/dashboard/settings', label: t('dashboard.qaSettings'), icon: <IconCog />, color: 'text-[var(--th-text-muted)]' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {actions.map(a => (
        <Link
          key={a.href}
          href={a.href}
          className="flex items-center gap-3 px-4 py-3.5 bg-[var(--th-card)] border border-[var(--th-border)] rounded-xl hover:border-[var(--th-primary-muted)] hover:bg-[var(--th-card-hover)] transition-all group"
        >
          <span className={`${a.color} group-hover:scale-110 transition-transform`}>{a.icon}</span>
          <span className="text-sm font-medium text-[var(--th-text)]">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}

// ─── System Health ───────────────────────────────────────────────────────────

function SystemHealth({ agents, connections, t }: { agents: Agent[]; connections: TelConnection[]; t: (k: string) => string }) {
  const activeAgents = agents.filter(a => a.is_active).length;
  const aiNumbers = connections.filter(c => c.ai_answering_enabled).length;
  const inbound = connections.filter(c => c.inbound_enabled).length;

  const items = [
    { label: t('dashboard.healthAgents'), value: `${activeAgents}/${agents.length}`, ok: activeAgents > 0 },
    { label: t('dashboard.healthPhones'), value: `${connections.length}`, ok: connections.length > 0 },
    { label: t('dashboard.healthAI'), value: `${aiNumbers}`, ok: aiNumbers > 0 },
    { label: t('dashboard.healthInbound'), value: `${inbound}`, ok: inbound > 0 },
  ];

  return (
    <div className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] p-6 shadow-[0_1px_3px_var(--th-shadow)]">
      <h3 className="text-sm font-semibold text-[var(--th-text)] mb-4">{t('dashboard.systemHealth')}</h3>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${item.ok ? 'bg-[var(--th-success-icon)]' : 'bg-[var(--th-text-muted)]'}`} />
              <span className="text-sm text-[var(--th-text-secondary)]">{item.label}</span>
            </div>
            <span className="text-sm font-semibold text-[var(--th-text)]">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Calls Table ──────────────────────────────────────────────────────

function RecentCallsTable({ calls, t }: { calls: RecentCall[]; t: (k: string) => string }) {
  return (
    <div className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow)]">
      <div className="px-6 py-4 border-b border-[var(--th-border)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('dashboard.recentCalls')}</h3>
        <Link href="/dashboard/calls" className="text-xs text-[var(--th-primary-text)] hover:text-[var(--th-primary-hover)] font-medium transition-colors">
          {t('dashboard.viewAll')} →
        </Link>
      </div>
      {calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14">
          <div className="w-11 h-11 bg-[var(--th-surface)] rounded-xl flex items-center justify-center mb-3">
            <IconPhone />
          </div>
          <p className="text-sm font-medium text-[var(--th-text-secondary)]">{t('dashboard.noCalls')}</p>
          <p className="text-xs text-[var(--th-text-muted)] mt-1 max-w-xs text-center">{t('dashboard.noCallsDesc')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--th-table-header)] border-b border-[var(--th-border)]">
              <tr>
                {[t('dashboard.phoneNumber'), t('dashboard.direction'), t('dashboard.status'), t('dashboard.duration'), t('dashboard.date')].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--th-border-light)]">
              {calls.map(call => (
                <tr key={call.id} className="hover:bg-[var(--th-table-row-hover)] transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-[var(--th-text)]">
                    {call.direction === 'outbound' ? call.phone_number_to : call.phone_number_from}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      call.direction === 'outbound'
                        ? 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]'
                        : 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]'
                    }`}>
                      {call.direction === 'outbound' ? '↑ Out' : '↓ In'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[call.status] ?? STATUS_COLORS.cancelled}`}>
                      {STATUS_LABELS[call.status] ?? call.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--th-text-secondary)] tabular-nums">{fmtDuration(call.duration_seconds)}</td>
                  <td className="px-5 py-3 text-sm text-[var(--th-text-muted)]">{fmtDate(call.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconPhone() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function IconCog() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconTrending() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconDollar() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconSignal() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 bg-[var(--th-skeleton)] rounded w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-[var(--th-skeleton)] rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-52 bg-[var(--th-skeleton)] rounded-xl" />
        <div className="h-52 bg-[var(--th-skeleton)] rounded-xl" />
      </div>
      <div className="h-64 bg-[var(--th-skeleton)] rounded-xl" />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { workspace } = useAuth();
  const t = useT();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [calls, setCalls] = useState<RecentCall[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connections, setConnections] = useState<TelConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>('/calls/stats').catch(() => null),
      api.get<{ calls: RecentCall[] }>('/calls?limit=6').then(r => r?.calls ?? []).catch(() => []),
      api.get<{ agents: Agent[] }>('/agents').then(r => r?.agents ?? []).catch(() => []),
      api.get<TelConnection[]>('/telephony/connections').catch(() => []),
    ]).then(([s, c, a, conn]) => {
      setStats(s);
      setCalls(c);
      setAgents(a);
      setConnections(Array.isArray(conn) ? conn : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const s = stats;
  const avgDur = s ? `${Math.floor(s.avg_duration_seconds / 60)}:${String(s.avg_duration_seconds % 60).padStart(2, '0')}` : '0:00';

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-[var(--th-text)]">
          {t('dashboard.greeting', { timeOfDay: t(`time.${getTimeOfDay()}`), name: workspace?.name ?? '' })}
        </h2>
        <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{t('dashboard.subtitle')}</p>
      </div>

      {/* Quick Actions */}
      <QuickActions t={t} />

      {/* KPI Row 1 — Primary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={t('dashboard.totalCalls')}
          value={String(s?.total_calls ?? 0)}
          sub={`${s?.today_calls ?? 0} ${t('dashboard.today')}`}
          icon={<IconPhone />}
          trend={null}
        />
        <KpiCard
          label={t('dashboard.activeNow')}
          value={String(s?.active_calls ?? 0)}
          sub={t('dashboard.liveRightNow')}
          icon={<IconSignal />}
          trend={null}
        />
        <KpiCard
          label={t('dashboard.successRate')}
          value={`${s?.success_rate ?? 0}%`}
          sub={t('dashboard.last30Days')}
          icon={<IconCheck />}
          trend={null}
        />
        <KpiCard
          label={t('dashboard.avgDuration')}
          value={avgDur}
          sub={`${s?.total_minutes_30d ?? 0} ${t('dashboard.minTotal')}`}
          icon={<IconClock />}
          trend={null}
        />
      </div>

      {/* KPI Row 2 — Secondary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={t('dashboard.qaScore')}
          value={String(s?.avg_qa_score ?? 0)}
          sub={t('dashboard.outOf10')}
          icon={<IconTrending />}
          trend={null}
        />
        <KpiCard
          label={t('dashboard.costTotal')}
          value={fmtCost(s?.cost_total_30d ?? 0)}
          sub={t('dashboard.last30Days')}
          icon={<IconDollar />}
          trend={null}
        />
        <KpiCard
          label={t('dashboard.weekCalls')}
          value={String(s?.week_calls ?? 0)}
          sub={t('dashboard.last7Days')}
          icon={<IconPhone />}
          trend={null}
        />
        <KpiCard
          label={t('dashboard.agents')}
          value={String(agents.length)}
          sub={`${agents.filter(a => a.is_active).length} ${t('dashboard.active')}`}
          icon={<IconSparkle />}
          trend={null}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <WeeklyChart dailyCalls={s?.daily_calls ?? []} t={t} />
        </div>
        <StatusBreakdown data={s?.status_breakdown ?? {}} t={t} />
      </div>

      {/* Sentiment + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SentimentBar data={s?.sentiment_breakdown ?? {}} t={t} />
        <SystemHealth agents={agents} connections={connections} t={t} />
      </div>

      {/* Recent Calls */}
      <RecentCallsTable calls={calls} t={t} />
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
