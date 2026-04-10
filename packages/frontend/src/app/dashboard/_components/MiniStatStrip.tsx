'use client';

interface MiniStatStripProps {
  items: { label: string; value: string; icon?: React.ReactNode }[];
}

export function MiniStatStrip({ items }: MiniStatStripProps) {
  return (
    <div className="bg-[var(--th-glass)] backdrop-blur-sm rounded-2xl border border-[var(--th-glass-border)] py-2 px-3 md:py-3 md:px-5 shadow-[0_1px_3px_var(--th-shadow)]">
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-2 md:gap-3">
            {i > 0 && <span className="w-px h-4 bg-[var(--th-border)] hidden sm:block" />}
            <div className="flex items-center gap-2">
              {item.icon && <span className="text-[var(--th-text-muted)]">{item.icon}</span>}
              <span className="text-[11px] font-medium text-[var(--th-text-muted)] uppercase tracking-wide">{item.label}</span>
              <span className="text-sm font-bold text-[var(--th-text)] tabular-nums">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
