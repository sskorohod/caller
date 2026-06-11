'use client';
import type { ReactNode } from 'react';

const TINTS = {
  indigo: { bg: 'var(--th-primary-bg)', fg: 'var(--th-primary)' },
  sky: { bg: 'var(--th-info-bg)', fg: 'var(--th-info-text)' },
  violet: { bg: 'var(--th-accent-purple-bg)', fg: 'var(--th-accent-purple)' },
  red: { bg: 'var(--th-error-bg)', fg: 'var(--th-error-text)' },
} as const;

interface SectionCardProps {
  /** Anchor id used by the settings scrollspy nav. */
  id: string;
  /** Material Symbols icon name. */
  icon: string;
  tint: keyof typeof TINTS;
  title: string;
  description?: string;
  /** Rendered at the right edge of the header (e.g. a status pill). */
  badge?: ReactNode;
  /** Rendered as a separated bottom bar (e.g. a save row). */
  footer?: ReactNode;
  children: ReactNode;
}

export function SectionCard({ id, icon, tint, title, description, badge, footer, children }: SectionCardProps) {
  const c = TINTS[tint];
  return (
    <section
      id={id}
      className="scroll-mt-4 bg-[var(--th-card)] rounded-2xl border overflow-hidden shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]"
      style={{ borderColor: tint === 'red' ? 'var(--th-error-border)' : 'var(--th-card-border-subtle)' }}
    >
      <header className="flex items-start gap-3.5 px-4 md:px-6 pt-4 md:pt-5 pb-4 border-b border-[var(--th-card-border-subtle)]">
        <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
          <span className="material-symbols-outlined text-[20px] leading-none" style={{ color: c.fg }}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className="text-[15px] font-bold leading-tight"
            style={{ color: tint === 'red' ? 'var(--th-error-text)' : 'var(--th-text)' }}
          >
            {title}
          </h2>
          {description && <p className="mt-1 text-xs leading-relaxed text-[var(--th-text-muted)]">{description}</p>}
        </div>
        {badge && <div className="shrink-0 pt-0.5">{badge}</div>}
      </header>

      <div className="p-4 md:p-6">{children}</div>

      {footer && (
        <footer className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-t border-[var(--th-card-border-subtle)] bg-[var(--th-surface)]/50">
          {footer}
        </footer>
      )}
    </section>
  );
}
