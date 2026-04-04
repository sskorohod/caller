'use client';

export function KpiCard({ label, value, sub, icon, accent }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className={`bg-[var(--th-card)] rounded-xl border-l-[3px] border-r border-t border-b border-r-[var(--th-border)] border-t-[var(--th-border)] border-b-[var(--th-border)] p-4 shadow-[0_2px_8px_var(--th-shadow)] hover:shadow-[0_4px_12px_var(--th-shadow)] transition-shadow`}
      style={{ borderLeftColor: accent ?? 'var(--th-primary)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[var(--th-text-muted)]">{icon}</span>
        <span className="text-[11px] font-medium text-[var(--th-text-muted)] uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl font-bold text-[var(--th-text)] leading-none">{value}</div>
      {sub && <div className="text-[11px] text-[var(--th-text-muted)] mt-1.5">{sub}</div>}
    </div>
  );
}
