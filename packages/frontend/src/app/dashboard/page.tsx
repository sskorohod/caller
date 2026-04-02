'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';

interface Stats {
  total_calls: number;
  active_calls: number;
  minutes_used: number;
  agents_count: number;
}

interface SimpleAgent { id: string; }
interface SimpleProvider { provider: string; }

interface RecentCall {
  id: string;
  direction: string;
  status: string;
  phone_number_to: string;
  phone_number_from: string;
  duration_seconds: number | null;
  created_at: string;
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[#475569]">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`} />
      </div>
      <div className="text-2xl font-bold text-[#0f172a]">{value}</div>
      {sub && <div className="text-xs text-[#94a3b8] mt-1">{sub}</div>}
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    in_progress: 'bg-blue-100 text-blue-700',
    initiated: 'bg-purple-100 text-purple-700',
    ringing: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-gray-100 text-gray-600',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

function fmtDuration(sec: number | null) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CallsWeekChart({ calls, t }: { calls: RecentCall[]; t: (key: string, vars?: Record<string, string>) => string }) {
  const chartData = useMemo(() => {
    const now = new Date();
    const days: { label: string; date: string; count: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({
        label: DAY_LABELS[d.getDay()],
        date: dateStr,
        count: 0,
      });
    }

    for (const call of calls) {
      const callDate = call.created_at.slice(0, 10);
      const match = days.find(d => d.date === callDate);
      if (match) match.count++;
    }

    return days;
  }, [calls]);

  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <h2 className="text-sm font-semibold text-[#0f172a] mb-5">{t('dashboard.callsThisWeek')}</h2>
      <div className="flex items-end justify-between gap-3" style={{ height: 160 }}>
        {chartData.map(day => {
          const barHeight = maxCount > 0 ? Math.max((day.count / maxCount) * 130, day.count > 0 ? 8 : 0) : 0;
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-xs font-semibold text-[#0f172a]">{day.count}</span>
              <div className="w-full flex justify-center">
                <div
                  className="w-8 rounded-t-md transition-all"
                  style={{
                    height: barHeight,
                    backgroundColor: day.count > 0 ? '#6366f1' : '#e2e8f0',
                    minHeight: 4,
                  }}
                />
              </div>
              <span className="text-[11px] text-[#94a3b8] font-medium">{day.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { workspace } = useAuth();
  const t = useT();
  const [calls, setCalls] = useState<RecentCall[]>([]);
  const [weekCalls, setWeekCalls] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSetupBanner, setShowSetupBanner] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ agents: SimpleAgent[] }>('/agents').catch(() => ({ agents: [] })),
      api.get<SimpleProvider[]>('/auth/providers').catch(() => []),
    ]).then(([agentsRes, providers]) => {
      const agents = agentsRes?.agents ?? [];
      const provArr = Array.isArray(providers) ? providers : [];
      if (agents.length === 0 && provArr.length === 0) {
        setShowSetupBanner(true);
      }
    });
  }, []);

  function loadCalls() {
    setError('');
    // Load recent calls for table
    const tablePromise = api.get<{ calls: RecentCall[]; total: number }>('/calls?limit=8')
      .then(r => setCalls(r?.calls ?? []))
      .catch((err: any) => setError(err?.message ?? 'Failed to load calls'));

    // Load last 7 days of calls for chart
    const chartPromise = api.get<{ calls: RecentCall[]; total: number }>('/calls?limit=250')
      .then(r => setWeekCalls(r?.calls ?? []))
      .catch(() => {});

    Promise.all([tablePromise, chartPromise]).finally(() => setLoading(false));
  }

  useEffect(() => { loadCalls(); }, []);

  const totalCalls = calls.length;
  const activeCalls = calls.filter(c => c.status === 'in_progress').length;
  const totalMinutes = Math.round(calls.reduce((a, c) => a + (c.duration_seconds ?? 0), 0) / 60);

  return (
    <div className="space-y-7">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold text-[#0f172a]">{t('dashboard.greeting', { timeOfDay: t(`time.${getTimeOfDay()}`), name: workspace?.name ?? 'there' })} 👋</h2>
        <p className="text-sm text-[#94a3b8] mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {/* Setup Banner */}
      {showSetupBanner && (
        <div className="flex items-center justify-between px-5 py-4 bg-[#eef2ff] border border-[#c7d2fe] rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#6366f1] rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#3730a3]">{t('dashboard.setupBanner')}</p>
          </div>
          <Link
            href="/onboarding"
            className="px-4 py-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold rounded-lg transition-all active:scale-[.98] shrink-0"
          >
            {t('dashboard.completeSetup')}
          </Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard label={t('dashboard.totalCalls')} value={String(totalCalls)} sub={t('dashboard.allTime')} color="bg-[#eef2ff]" />
        <KpiCard label={t('dashboard.activeNow')} value={String(activeCalls)} sub={t('dashboard.inProgress')} color="bg-[#dcfce7]" />
        <KpiCard label={t('dashboard.minutesUsed')} value={String(totalMinutes)} sub={t('dashboard.thisSession')} color="bg-[#fef3c7]" />
        <KpiCard label={t('dashboard.agents')} value="—" sub={t('dashboard.configureBelow')} color="bg-[#fce7f3]" />
      </div>

      {/* Calls This Week Chart */}
      {!loading && <CallsWeekChart calls={weekCalls} t={t} />}

      {/* Recent Calls */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0f172a]">{t('dashboard.recentCalls')}</h2>
          <a href="/dashboard/calls" className="text-xs text-[#6366f1] hover:text-[#4f46e5] font-medium">{t('dashboard.viewAll')} →</a>
        </div>

        {error ? (
          <div className="p-6 text-center">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button onClick={loadCalls} className="mt-3 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 rounded-lg transition-colors">{t('common.retry')}</button>
          </div>
        ) : loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-8 h-8 bg-slate-100 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-100 rounded w-1/4" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                </div>
                <div className="h-5 bg-slate-100 rounded w-20" />
              </div>
            ))}
          </div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-[#f1f5f9] rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#475569]">{t('dashboard.noCalls')}</p>
            <p className="text-xs text-[#94a3b8] mt-1 max-w-xs">{t('dashboard.noCallsDesc')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              <tr>
                {[t('dashboard.phoneNumber'), t('dashboard.direction'), t('dashboard.status'), t('dashboard.duration'), t('dashboard.date')].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {calls.map(call => (
                <tr key={call.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-6 py-3.5 text-sm font-medium text-[#0f172a]">
                    {call.direction === 'outbound' ? call.phone_number_to : call.phone_number_from}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${call.direction === 'outbound' ? 'bg-[#eef2ff] text-[#6366f1]' : 'bg-[#f0fdf4] text-[#16a34a]'}`}>
                      {call.direction === 'outbound' ? `↑ ${t('calls.outbound')}` : `↓ ${t('calls.inbound')}`}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex text-xs px-2.5 py-0.5 rounded-full font-medium ${statusBadge(call.status)}`}>
                      {call.status}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-[#475569]">{fmtDuration(call.duration_seconds)}</td>
                  <td className="px-6 py-3.5 text-sm text-[#94a3b8]">{fmtDate(call.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
