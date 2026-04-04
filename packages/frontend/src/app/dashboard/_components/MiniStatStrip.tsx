'use client';

interface MiniStatStripProps {
  items: { label: string; value: string }[];
}

export function MiniStatStrip({ items }: MiniStatStripProps) {
  return (
    <div className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] py-2.5 px-5 shadow-[0_1px_3px_var(--th-shadow)]">
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-3">
            {i > 0 && <span className="w-px h-4 bg-[var(--th-border)] hidden sm:block" />}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[var(--th-text-muted)]">{item.label}</span>
              <span className="text-sm font-semibold text-[var(--th-text)]">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
