'use client';

interface AdminKpiCardProps {
  label: string;
  value: string;
  icon: string;
  color?: string;
}

export default function AdminKpiCard({ label, value, icon, color }: AdminKpiCardProps) {
  const accentColor = color || 'var(--th-primary-text)';

  return (
    <div
      className="rounded-xl p-4 md:p-5 relative overflow-hidden"
      style={{
        background: 'var(--th-card)',
        border: '1px solid var(--th-card-border-subtle)',
        boxShadow: `var(--th-card-border-subtle) 0px 0px 0px 1px, rgba(0,0,0,0.05) 0px 4px 24px`,
      }}
    >
      <div className="absolute top-3 right-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${accentColor}12` }}
        >
          <span className="material-symbols-outlined text-base" style={{ color: accentColor }}>
            {icon}
          </span>
        </div>
      </div>
      <div
        className="text-[10px] font-medium uppercase tracking-wider mb-2"
        style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px', lineHeight: 1.6 }}
      >
        {label}
      </div>
      <div
        className="text-xl md:text-2xl font-headline"
        style={{ color: accentColor, lineHeight: 1.1 }}
      >
        {value}
      </div>
    </div>
  );
}
