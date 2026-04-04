'use client';
import type { Agent, TelConnection } from '../_lib/types';

interface SystemHealthStripProps {
  agents: Agent[];
  connections: TelConnection[];
  t: (k: string) => string;
}

export function SystemHealthStrip({ agents, connections, t }: SystemHealthStripProps) {
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
    <div className="flex items-center gap-4 flex-wrap">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.ok ? 'bg-[var(--th-success-icon)]' : 'bg-[var(--th-text-muted)]'}`} />
          <span className="text-[11px] text-[var(--th-text-muted)]">{item.label}</span>
          <span className="text-[11px] font-semibold text-[var(--th-text)]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
