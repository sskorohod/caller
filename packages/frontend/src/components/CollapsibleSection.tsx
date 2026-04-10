'use client';
import { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
  badge,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 touch-target"
        style={{ color: 'var(--th-text)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="text-left min-w-0">
            <div className="text-sm font-semibold truncate">{title}</div>
            {subtitle && (
              <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--th-text-secondary)' }}>
                {subtitle}
              </div>
            )}
          </div>
          {badge}
        </div>
        <svg
          className="w-4 h-4 shrink-0 transition-transform duration-200"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--th-text-muted)',
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{
          maxHeight: open ? '2000px' : '0',
          opacity: open ? 1 : 0,
          borderTop: open ? '1px solid var(--th-card-border-subtle)' : 'none',
        }}
      >
        <div className="px-4 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
