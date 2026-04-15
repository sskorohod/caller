'use client';

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  action?: React.ReactNode;
}

export default function AdminPageHeader({ title, subtitle, icon, action }: AdminPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--th-primary-bg)' }}
          >
            <span className="material-symbols-outlined text-xl" style={{ color: 'var(--th-primary-text)' }}>
              {icon}
            </span>
          </div>
        )}
        <div>
          <h1 className="text-xl md:text-2xl font-headline" style={{ lineHeight: 1.2 }}>{title}</h1>
          {subtitle && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--th-text-secondary)', lineHeight: 1.6 }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
