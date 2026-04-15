'use client';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface AdminBadgeProps {
  variant?: BadgeVariant;
  bg?: string;
  color?: string;
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; color: string }> = {
  primary: { bg: 'var(--th-primary-bg)', color: 'var(--th-primary-text)' },
  success: { bg: 'var(--th-success-bg)', color: 'var(--th-success-text)' },
  warning: { bg: 'var(--th-warning-bg)', color: 'var(--th-warning-text)' },
  error: { bg: 'var(--th-error-bg)', color: 'var(--th-error-text)' },
  info: { bg: 'var(--th-info-bg)', color: 'var(--th-info-text)' },
  neutral: { bg: 'var(--th-surface)', color: 'var(--th-text-muted)' },
};

export default function AdminBadge({ variant = 'neutral', bg, color, children }: AdminBadgeProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{
        background: bg || styles.bg,
        color: color || styles.color,
      }}
    >
      {children}
    </span>
  );
}
