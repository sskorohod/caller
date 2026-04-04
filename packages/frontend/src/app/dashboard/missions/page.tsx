'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';

interface Mission {
  id: string;
  title: string | null;
  status: string;
  agent_profile_id: string | null;
  target_phone: string | null;
  goal: string | null;
  fallback_action: string;
  call_id: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  outcome: Record<string, unknown> | null;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  draft: { color: 'var(--th-text-muted)', bg: 'var(--th-surface)', label: 'Draft' },
  ready: { color: 'var(--th-primary-text)', bg: 'var(--th-primary-bg)', label: 'Ready' },
  scheduled: { color: 'var(--th-info-text)', bg: 'var(--th-info-bg)', label: 'Scheduled' },
  calling: { color: 'var(--th-warning-text)', bg: 'var(--th-warning-bg)', label: 'Calling...' },
  in_progress: { color: 'var(--th-warning-text)', bg: 'var(--th-warning-bg)', label: 'In Progress' },
  on_hold: { color: 'var(--th-error-text)', bg: 'var(--th-error-bg)', label: 'On Hold' },
  completed: { color: 'var(--th-success-text)', bg: 'var(--th-success-bg)', label: 'Completed' },
  failed: { color: 'var(--th-error-text)', bg: 'var(--th-error-bg)', label: 'Failed' },
  cancelled: { color: 'var(--th-text-muted)', bg: 'var(--th-surface)', label: 'Cancelled' },
};

export default function MissionsPage() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  function loadMissions() {
    const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    api.get<{ missions: Mission[] }>(`/missions${params}`)
      .then(r => setMissions(r?.missions ?? []))
      .catch(() => toast.error('Failed to load missions'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadMissions(); }, [statusFilter]);

  async function createNew() {
    try {
      const r = await api.post<{ mission: Mission }>('/missions', {});
      router.push(`/dashboard/missions/${r.mission.id}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const statusOptions = ['all', 'draft', 'ready', 'scheduled', 'calling', 'completed', 'failed', 'on_hold'];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--th-text)]">{t('missions.title')}</h2>
          <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{t('missions.subtitle')}</p>
        </div>
        <button
          onClick={createNew}
          className="px-4 py-2.5 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-sm font-semibold rounded-xl transition-all active:scale-[.98] flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('missions.newMission')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto p-1 bg-[var(--th-surface)] rounded-xl">
        {statusOptions.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3.5 py-1.5 text-[10px] font-semibold rounded-lg transition-all whitespace-nowrap ${
              statusFilter === s
                ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white shadow-[0_2px_8px_rgba(99,102,241,0.25)]'
                : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-card)] hover:text-[var(--th-text)]'
            }`}
          >
            {s === 'all' ? t('missions.all') : (STATUS_CONFIG[s]?.label ?? s)}
          </button>
        ))}
      </div>

      {/* Mission cards */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 animate-pulse shadow-[0_1px_3px_var(--th-shadow)]">
              <div className="h-4 bg-[var(--th-skeleton)] rounded-lg w-1/3 mb-3" />
              <div className="h-3 bg-[var(--th-skeleton)] rounded-lg w-2/3 mb-2" />
              <div className="h-3 bg-[var(--th-skeleton)] rounded-lg w-1/4" />
            </div>
          ))}
        </div>
      ) : missions.length === 0 ? (
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] flex flex-col items-center justify-center py-20 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <div className="w-14 h-14 bg-[var(--th-primary-bg)] rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--th-text-secondary)]">{t('missions.noMissions')}</p>
          <p className="text-xs text-[var(--th-text-muted)] mt-1 mb-4">{t('missions.noMissionsDesc')}</p>
          <button onClick={createNew} className="px-4 py-2 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white text-sm font-semibold rounded-xl hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all">
            {t('missions.newMission')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {missions.map(m => {
            const cfg = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.draft;
            const isLive = (m.status === 'calling' || m.status === 'in_progress') && m.call_id;
            return (
              <Link
                key={m.id}
                href={`/dashboard/missions/${m.id}`}
                className="block bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 hover:border-[var(--th-border)] hover:shadow-[0_4px_16px_var(--th-card-glow)] transition-all group shadow-[0_1px_3px_var(--th-shadow)] relative overflow-hidden"
              >
                {isLive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-400 to-emerald-500" />}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-[var(--th-text)] text-sm truncate group-hover:text-[var(--th-primary-text)] transition-colors">
                        {m.title || m.goal || t('missions.untitled')}
                      </h3>
                      <span
                        className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold shrink-0"
                        style={{ color: cfg.color, background: cfg.bg }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--th-text-muted)]">
                      {m.target_phone && (
                        <span className="flex items-center gap-1 tabular-nums">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                          {m.target_phone}
                        </span>
                      )}
                      {m.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {new Date(m.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      <span>{new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {m.outcome && (m.outcome as any).summary && (
                      <p className="text-xs text-[var(--th-text-secondary)] mt-2 line-clamp-1">{(m.outcome as any).summary}</p>
                    )}
                  </div>
                  {isLive ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--th-success-text)] shrink-0">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                      Live
                    </span>
                  ) : (
                    <svg className="w-4 h-4 text-[var(--th-text-muted)] group-hover:text-[var(--th-primary-text)] transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
