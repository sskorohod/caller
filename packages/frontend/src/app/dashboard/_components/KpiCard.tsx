'use client';

export function KpiCard({ label, value, sub, icon, gradient, accentColor }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
  accentColor: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[var(--th-card-border-subtle)] p-4 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] hover:shadow-[0_2px_8px_var(--th-shadow),0_12px_32px_var(--th-card-glow)] transition-shadow duration-300 group"
      style={{ background: gradient }}
    >
      {/* Subtle glow circle in background */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-30"
        style={{ background: accentColor }}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{label}</span>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${accentColor}18` }}
          >
            <span style={{ color: accentColor }}>{icon}</span>
          </div>
        </div>
        <div className="text-[22px] font-bold text-[var(--th-text)] leading-none tracking-tight">{value}</div>
        {sub && <div className="text-[11px] text-[var(--th-text-muted)] mt-2">{sub}</div>}
      </div>
    </div>
  );
}
