'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';

import type { DashboardStats, RecentCall, Agent, TelConnection } from './_lib/types';
import { fmtCost, getTimeOfDay } from './_lib/utils';
import { IconPhone, IconSignal, IconCheck, IconDollar, IconWallet } from './_lib/icons';

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
  const [balanceUsd, setBalanceUsd] = useState<number>(0);
  const [plan, setPlan] = useState<string>('');
  const [subStatus, setSubStatus] = useState<string>('none');
  const [subEnd, setSubEnd] = useState<string | null>(null);
  const [translatorPhone, setTranslatorPhone] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>('/calls/stats').catch(() => null),
      api.get<{ calls: RecentCall[] }>('/calls?limit=5').then(r => r?.calls ?? []).catch(() => []),
      api.get<{ agents: Agent[] }>('/agents').then(r => (r?.agents ?? []).filter(Boolean)).catch(() => []),
      api.get<TelConnection[]>('/telephony/connections').catch(() => []),
      api.get<{ balance_usd: number; plan: string; subscription_status: string; subscription_current_period_end: string | null }>('/billing/balance').catch(() => ({ balance_usd: 0, plan: '', subscription_status: 'none', subscription_current_period_end: null })),
      api.get<{ phone_number: string | null }>('/translator/phone').catch(() => ({ phone_number: null })),
    ]).then(([s, c, a, conn, billing, phone]) => {
      setStats(s);
      setCalls(c);
      setAgents(a);
      setConnections(Array.isArray(conn) ? conn : []);
      const b = billing as any;
      setBalanceUsd(b?.balance_usd ?? 0);
      setPlan(b?.plan ?? '');
      setSubStatus(b?.subscription_status ?? 'none');
      setSubEnd(b?.subscription_current_period_end ?? null);
      setTranslatorPhone((phone as any)?.phone_number ?? null);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const s = stats;
  const avgDur = s ? `${Math.floor(s.avg_duration_seconds / 60)}:${String(Math.round(s.avg_duration_seconds) % 60).padStart(2, '0')}` : '0:00';
  const isTranslatorOnly = plan === 'translator';

  return (
    <div className="space-y-4">
      {/* Row 1: Greeting + Translator Phone */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-[var(--th-text)]">
            {t('dashboard.greeting', { timeOfDay: t(`time.${getTimeOfDay()}`), name: workspace?.name ?? '' })}
          </h2>
          <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{isTranslatorOnly ? 'Live Translator Service' : t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          {translatorPhone && (
            <div className="text-right">
              <a href={`tel:${translatorPhone}`}
                className="text-2xl md:text-3xl font-extrabold tracking-wide"
                style={{
                  background: 'linear-gradient(135deg, #a855f7, #7c3aed, #6d28d9)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 12px rgba(139,92,246,0.5)) drop-shadow(0 0 24px rgba(139,92,246,0.25))',
                }}>
                {translatorPhone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 ($1) $2-$3')}
              </a>
              <p className="text-[11px] text-[var(--th-text-muted)] mt-0.5">Call to connect live translator</p>
            </div>
          )}
          {!isTranslatorOnly && <SystemHealthStrip agents={agents} connections={connections} t={t} />}
        </div>
      </div>

      {/* Row 2: Primary KPIs */}
      <div className={`grid grid-cols-2 ${isTranslatorOnly ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-3`}>
        <KpiCard
          label={isTranslatorOnly ? 'Sessions' : t('dashboard.totalCalls')}
          value={String(s?.total_calls ?? 0)}
          sub={`${s?.today_calls ?? 0} ${t('dashboard.today')}`}
          icon={<IconPhone />}
          gradient="var(--th-gradient-indigo)"
          accentColor="#6366f1"
        />
        <KpiCard
          label={isTranslatorOnly ? 'Active' : t('dashboard.activeNow')}
          value={String(s?.active_calls ?? 0)}
          sub={t('dashboard.liveRightNow')}
          icon={<IconSignal />}
          gradient="var(--th-gradient-emerald)"
          accentColor="#22c55e"
        />
        <KpiCard
          label={t('dashboard.costTotal')}
          value={fmtCost(s?.cost_total_30d ?? 0)}
          sub={t('dashboard.last30Days')}
          icon={<IconDollar />}
          gradient="var(--th-gradient-amber)"
          accentColor="#eab308"
        />
        <KpiCard
          label={t('dashboard.balance') || 'Balance'}
          value={`$${balanceUsd.toFixed(2)}`}
          sub={
            (plan === 'translator' ? 'Translator' : plan === 'agents' ? 'Agents' : plan === 'agents_mcp' ? 'Agents + MCP' : '')
            + (subStatus === 'active' && subEnd ? ` · until ${new Date(subEnd).toLocaleDateString()}` : '')
            + (subStatus === 'canceled' ? ' · canceled' : '')
            + (subStatus === 'past_due' ? ' · past due' : '')
          }
          icon={<IconWallet />}
          gradient="var(--th-gradient-emerald)"
          accentColor="#10b981"
        />
        {!isTranslatorOnly && (
          <KpiCard
            label={t('dashboard.successRate')}
            value={`${s?.success_rate ?? 0}%`}
            sub={t('dashboard.last30Days')}
            icon={<IconCheck />}
            gradient="var(--th-gradient-blue)"
            accentColor="#3b82f6"
          />
        )}
      </div>

      {/* Row 3: Charts + Right Panel (hide AI-specific for translator) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className={isTranslatorOnly ? 'lg:col-span-12' : 'lg:col-span-7'}>
          <WeeklyChart dailyCalls={s?.daily_calls ?? []} t={t} />
        </div>
        {!isTranslatorOnly && (
          <div className="lg:col-span-5 bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] divide-y divide-[var(--th-border-light)]">
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
        )}
      </div>

      {/* Row 4: Secondary Stats (simplified for translator) */}
      <MiniStatStrip items={isTranslatorOnly
        ? [
          { label: 'Avg Duration', value: avgDur },
          { label: 'This Week', value: String(s?.week_calls ?? 0) },
        ]
        : [
          { label: t('dashboard.qaScore'), value: String(s?.avg_qa_score ?? 0) },
          { label: t('dashboard.weekCalls'), value: String(s?.week_calls ?? 0) },
          { label: t('dashboard.agents'), value: `${agents.filter(a => a.is_active).length}/${agents.length}` },
          { label: t('dashboard.avgDuration'), value: avgDur },
        ]
      } />

      {/* Row 5: Recent Calls */}
      <RecentCallsTable calls={calls} t={t} />
    </div>
  );
}
