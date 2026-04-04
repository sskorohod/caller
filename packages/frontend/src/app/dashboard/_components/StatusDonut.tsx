'use client';
import { DONUT_COLORS, STATUS_LABELS } from '../_lib/constants';

interface StatusDonutProps {
  data: Record<string, number>;
  t: (k: string) => string;
}

export function StatusDonut({ data, t }: StatusDonutProps) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

  let gradParts: string[] = [];
  let offset = 0;
  for (const [status, count] of entries) {
    const pct = (count / total) * 100;
    const color = DONUT_COLORS[status] ?? 'var(--th-text-muted)';
    gradParts.push(`${color} ${offset}% ${offset + pct}%`);
    offset += pct;
  }

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-[var(--th-text)] mb-3">{t('dashboard.callStatus')}</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <div
            className="w-full h-full rounded-full"
            style={{ background: `conic-gradient(${gradParts.join(', ')})` }}
          />
          <div className="absolute inset-[5px] rounded-full bg-[var(--th-card)] flex items-center justify-center">
            <span className="text-sm font-bold text-[var(--th-text)]">{total}</span>
          </div>
        </div>
        <div className="flex-1 space-y-1">
          {entries.slice(0, 4).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[status] ?? 'var(--th-text-muted)' }} />
                <span className="text-[11px] text-[var(--th-text-secondary)] capitalize">{STATUS_LABELS[status] ?? status}</span>
              </div>
              <span className="text-[11px] font-semibold text-[var(--th-text)]">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
