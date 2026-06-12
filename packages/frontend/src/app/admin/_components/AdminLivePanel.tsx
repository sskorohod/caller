'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fmtCurrency } from '../_lib/format';
import type { DashboardLiveData } from '../_lib/types';

const TYPE_LABELS: Record<string, string> = {
  translator: 'Translator',
  conference: 'Translator',
  voice_translate: 'Dialer',
  manual: 'Dialer',
  orchestrator: 'Agent',
};

function LiveDuration({ startedAt }: { startedAt: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return <span className="font-mono tabular-nums">{m}:{s.toString().padStart(2, '0')}</span>;
}

function MiniStat({ label, value, href, accent }: { label: string; value: string; href?: string; accent?: boolean }) {
  const body = (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div className="text-lg font-headline mt-0.5" style={{ color: accent ? 'var(--th-warning-text)' : 'var(--th-text)' }}>
        {value}
      </div>
    </div>
  );
  return href ? <Link href={href} className="hover:opacity-80 transition-opacity">{body}</Link> : body;
}

export default function AdminLivePanel({ data }: { data: DashboardLiveData | null }) {
  if (!data) {
    return <div className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--th-surface)' }} />;
  }

  const busy = data.active_count > 0;

  return (
    <div
      className="rounded-xl p-4 md:p-5"
      style={{
        background: 'var(--th-card)',
        border: '1px solid var(--th-card-border-subtle)',
        boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
      }}
    >
      <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
        {/* Active calls */}
        <div className="md:w-64 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${busy ? 'animate-pulse' : ''}`}
              style={{ background: busy ? '#22c55e' : 'var(--th-text-muted)', boxShadow: busy ? '0 0 6px #22c55e' : 'none' }}
            />
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
              Live now
            </span>
          </div>
          <div className="text-lg font-headline mt-0.5" style={{ color: busy ? 'var(--th-success-text)' : 'var(--th-text)' }}>
            {data.active_count} {data.active_count === 1 ? 'active call' : 'active calls'}
          </div>
          {data.active.length > 0 && (
            <div className="mt-2 space-y-1">
              {data.active.slice(0, 4).map(s => (
                <div key={s.call_id} className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--th-text-secondary)' }}>
                  <span className="truncate">
                    {s.workspace_name ?? s.workspace_id.slice(0, 8)}
                    {s.is_admin && <span className="ml-1 text-[10px]" style={{ color: 'var(--th-text-muted)' }}>(admin)</span>}
                  </span>
                  <span className="flex items-center gap-2 shrink-0" style={{ color: 'var(--th-text-muted)' }}>
                    <span className="text-[10px]">{TYPE_LABELS[s.type] ?? s.type}</span>
                    <LiveDuration startedAt={s.started_at} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today + needs attention */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 flex-1">
          <MiniStat label="Revenue today" value={fmtCurrency(data.today.revenue)} />
          <MiniStat label="Sessions today" value={String(data.today.sessions)} />
          <MiniStat label="Signups today" value={String(data.today.signups)} />
          <MiniStat label="Open tickets" value={String(data.open_tickets)} href="/admin/tickets" accent={data.open_tickets > 0} />
          <MiniStat label="New messages" value={String(data.new_contacts)} href="/admin/contacts" accent={data.new_contacts > 0} />
        </div>
      </div>
    </div>
  );
}
