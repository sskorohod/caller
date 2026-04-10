'use client';
import { USAGE_CATEGORIES } from '../_lib/constants';

interface UsageBreakdownBarProps {
  breakdown: { llm: number; tts: number; stt: number; telephony: number };
  t: (k: string) => string;
}

export function UsageBreakdownBar({ breakdown, t }: UsageBreakdownBarProps) {
  const categories = USAGE_CATEGORIES.map(c => ({
    ...c,
    label: t(`billing.usage.${c.key}`),
    value: breakdown[c.key as keyof typeof breakdown],
  }));
  const total = categories.reduce((s, c) => s + c.value, 0);
  const maxVal = Math.max(...categories.map(c => c.value), 0.001);

  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] h-full">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('billing.usageBreakdown')}</h3>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-[var(--th-text)]">${total.toFixed(2)}</span>
          <span className="text-[10px] text-[var(--th-text-muted)]">{t('billing.thisMonth')}</span>
        </div>
      </div>

      <div className="space-y-3">
        {categories.map((cat, i) => {
          const pct = total > 0 ? Math.round((cat.value / total) * 100) : 0;
          const barWidth = Math.max((cat.value / maxVal) * 100, 0);
          return (
            <div key={cat.key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.dot }} />
                  <span className="text-[11px] text-[var(--th-text-secondary)]">{cat.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--th-text)] tabular-nums">${cat.value.toFixed(2)}</span>
                  <span className="text-[10px] text-[var(--th-text-muted)] w-7 text-right">{pct}%</span>
                </div>
              </div>
              <div className="h-[5px] rounded-full bg-[var(--th-surface)] overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${barWidth}%`, background: cat.gradient }} />
              </div>
            </div>
          );
        })}
      </div>

      {total === 0 && (
        <div className="text-center py-4">
          <p className="text-[12px] text-[var(--th-text-muted)]">{t('billing.noUsageData')}</p>
        </div>
      )}
    </div>
  );
}
