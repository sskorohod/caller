'use client';
import { useState } from 'react';
import { useAdminQuery, api } from '../_lib/admin-api';
import { fmtDuration, fmtCurrency, fmtDateTime, fmtMinutes } from '../_lib/format';
import type { Session, TranscriptEntry } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminKpiCard from '../_components/AdminKpiCard';
import AdminTable from '../_components/AdminTable';
import AdminBadge from '../_components/AdminBadge';
import AdminLoadingState from '../_components/AdminLoadingState';
import AdminErrorState from '../_components/AdminErrorState';

interface SessionsResponse {
  sessions: Session[];
  stats: {
    avg_duration: string;
    total_sessions: number;
    total_minutes: string;
  };
}

export default function SessionsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, loading, error, refetch } = useAdminQuery<SessionsResponse>(
    () => api.get<SessionsResponse>('/admin/sessions?limit=100'),
  );

  if (loading) return <AdminLoadingState rows={5} />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const { sessions, stats } = data;

  const toggleExpand = (row: Session) => {
    setExpanded(expanded === row.id ? null : row.id);
  };

  const renderTranscript = (session: Session) => {
    const entries: TranscriptEntry[] = Array.isArray(session.transcript) ? session.transcript : [];

    return (
      <div
        className="px-4 py-3 mb-2 mx-2 rounded-lg"
        style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)' }}
      >
        <div
          className="text-[10px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
        >
          Transcript
        </div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {entries.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--th-text-muted)' }}>No transcript data</p>
          )}
          {entries.map((t, i) => (
            <div key={i} className="text-xs leading-relaxed">
              <span
                className="font-semibold"
                style={{
                  color: t.speaker === 'subscriber'
                    ? 'var(--th-primary-text)'
                    : 'var(--th-info-text)',
                }}
              >
                {t.speaker}:
              </span>{' '}
              <span style={{ color: 'var(--th-text)' }}>{t.text}</span>
              {t.translation && (
                <span className="italic ml-2" style={{ color: 'var(--th-text-secondary)' }}>
                  &rarr; {t.translation}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Date',
      render: (row: Session) => (
        <span className="text-xs">{fmtDateTime(row.created_at)}</span>
      ),
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (row: Session) => (
        <span className="text-xs font-mono">{fmtDuration(row.duration_seconds)}</span>
      ),
    },
    {
      key: 'minutes',
      label: 'Minutes',
      render: (row: Session) => (
        <span className="text-xs font-mono">{parseFloat(row.minutes_used).toFixed(1)}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'cost',
      label: 'Cost',
      render: (row: Session) => (
        <span className="text-xs font-mono" style={{ color: 'var(--th-success-text)' }}>
          {fmtCurrency(parseFloat(row.cost_usd), 3)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Session) => (
        <AdminBadge variant={row.status === 'completed' ? 'success' : 'warning'}>
          {row.status}
        </AdminBadge>
      ),
    },
    {
      key: 'expand',
      label: '',
      render: (row: Session) => (
        <span
          className="material-symbols-outlined text-sm transition-transform"
          style={{
            color: 'var(--th-text-muted)',
            transform: expanded === row.id ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          expand_more
        </span>
      ),
      className: 'w-8',
    },
  ];

  const mobileRender = (row: Session) => (
    <div>
      <div className="flex justify-between items-center">
        <span className="font-mono text-sm">{fmtDuration(row.duration_seconds)}</span>
        <span className="font-mono text-sm font-semibold" style={{ color: 'var(--th-success-text)' }}>
          {fmtCurrency(parseFloat(row.cost_usd), 3)}
        </span>
      </div>
      <div className="flex justify-between items-center mt-1.5">
        <span className="text-[11px]" style={{ color: 'var(--th-text-secondary)' }}>
          {fmtDateTime(row.created_at)}
        </span>
        <AdminBadge variant={row.status === 'completed' ? 'success' : 'warning'}>
          {row.status}
        </AdminBadge>
      </div>
      {expanded === row.id && row.transcript && (
        <div className="mt-3">{renderTranscript(row)}</div>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <AdminPageHeader
        title="Sessions"
        subtitle={`${stats.total_sessions} total sessions tracked`}
        icon="call"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <AdminKpiCard
          label="Total Sessions"
          value={stats.total_sessions.toString()}
          icon="call"
          color="var(--th-primary-text)"
        />
        <AdminKpiCard
          label="Avg Duration"
          value={`${Math.round(parseFloat(stats.avg_duration || '0') / 60)}m`}
          icon="schedule"
          color="var(--th-info-text)"
        />
        <AdminKpiCard
          label="Total Minutes"
          value={fmtMinutes(stats.total_minutes)}
          icon="timer"
          color="var(--th-success-text)"
        />
      </div>

      {/* Sessions Table */}
      <div>
        <AdminTable<Session & Record<string, unknown>>
          columns={columns as Array<{ key: string; label: string; render: (row: Session & Record<string, unknown>) => React.ReactNode; className?: string; hideOnMobile?: boolean }>}
          data={sessions as Array<Session & Record<string, unknown>>}
          keyField="id"
          pageSize={10}
          onRowClick={(row) => toggleExpand(row as unknown as Session)}
          activeRowKey={expanded ?? undefined}
          emptyIcon="call"
          emptyText="No sessions yet"
          mobileRender={(row) => mobileRender(row as unknown as Session)}
        />

        {/* Desktop expanded transcript */}
        {expanded && (
          <div className="hidden md:block">
            {sessions
              .filter((s) => s.id === expanded && Array.isArray(s.transcript) && s.transcript.length > 0)
              .map((s) => (
                <div key={`${s.id}-transcript`} className="mt-1">
                  {renderTranscript(s)}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
