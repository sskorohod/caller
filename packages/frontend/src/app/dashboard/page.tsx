'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';

import type { DashboardStats, RecentCall, Agent, TelConnection } from './_lib/types';
import { fmtCost, getTimeOfDay } from './_lib/utils';
import { IconPhone, IconSignal, IconCheck, IconDollar } from './_lib/icons';

import { DashboardSkeleton } from './_components/DashboardSkeleton';
import { KpiCard } from './_components/KpiCard';
import { MiniStatStrip } from './_components/MiniStatStrip';
import { WeeklyChart } from './_components/WeeklyChart';
import { StatusDonut } from './_components/StatusDonut';
import { CostBreakdown } from './_components/CostBreakdown';
import { SentimentStrip } from './_components/SentimentStrip';
import { SystemHealthStrip } from './_components/SystemHealthStrip';
import { RecentCallsTable } from './_components/RecentCallsTable';

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
      api.get<{ calls: RecentCall[] }>('/calls?limit=5').then(r => r?.calls ?? []).catch(() => []),
      api.get<{ agents: Agent[] }>('/agents').then(r => (r?.agents ?? []).filter(Boolean)).catch(() => []),
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
  const avgDur = s ? `${Math.floor(s.avg_duration_seconds / 60)}:${String(Math.round(s.avg_duration_seconds) % 60).padStart(2, '0')}` : '0:00';

  return (
    <div className="space-y-4">
      {/* Row 1: Greeting + System Health */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-[var(--th-text)]">
            {t('dashboard.greeting', { timeOfDay: t(`time.${getTimeOfDay()}`), name: workspace?.name ?? '' })}
          </h2>
          <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{t('dashboard.subtitle')}</p>
        </div>
        <SystemHealthStrip agents={agents} connections={connections} t={t} />
      </div>

      {/* Row 2: Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={t('dashboard.totalCalls')}
          value={String(s?.total_calls ?? 0)}
          sub={`${s?.today_calls ?? 0} ${t('dashboard.today')}`}
          icon={<IconPhone />}
          accent="var(--th-primary)"
        />
        <KpiCard
          label={t('dashboard.activeNow')}
          value={String(s?.active_calls ?? 0)}
          sub={t('dashboard.liveRightNow')}
          icon={<IconSignal />}
          accent="var(--th-success-icon)"
        />
        <KpiCard
          label={t('dashboard.successRate')}
          value={`${s?.success_rate ?? 0}%`}
          sub={t('dashboard.last30Days')}
          icon={<IconCheck />}
          accent="var(--th-info-text)"
        />
        <KpiCard
          label={t('dashboard.costTotal')}
          value={fmtCost(s?.cost_total_30d ?? 0)}
          sub={t('dashboard.last30Days')}
          icon={<IconDollar />}
          accent="var(--th-warning-icon)"
        />
      </div>

      {/* Row 3: Charts + Right Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <WeeklyChart dailyCalls={s?.daily_calls ?? []} t={t} />
        </div>
        <div className="lg:col-span-5 bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] shadow-[0_2px_8px_var(--th-shadow)] divide-y divide-[var(--th-border-light)]">
          <StatusDonut data={s?.status_breakdown ?? {}} t={t} />
          <CostBreakdown
            total={s?.cost_total_30d ?? 0}
            llm={s?.cost_llm_30d ?? 0}
            tts={s?.cost_tts_30d ?? 0}
            stt={s?.cost_stt_30d ?? 0}
            telephony={s?.cost_telephony_30d ?? 0}
            t={t}
          />
          <SentimentStrip data={s?.sentiment_breakdown ?? {}} t={t} />
        </div>
      </div>

      {/* Row 4: Secondary Stats */}
      <MiniStatStrip items={[
        { label: t('dashboard.qaScore'), value: String(s?.avg_qa_score ?? 0) },
        { label: t('dashboard.weekCalls'), value: String(s?.week_calls ?? 0) },
        { label: t('dashboard.agents'), value: `${agents.filter(a => a.is_active).length}/${agents.length}` },
        { label: t('dashboard.avgDuration'), value: avgDur },
      ]} />

      {/* Row 5: Recent Calls */}
      <RecentCallsTable calls={calls} t={t} />
    </div>
  );
}
