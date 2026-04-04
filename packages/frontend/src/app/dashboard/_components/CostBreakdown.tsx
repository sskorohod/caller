'use client';
import { fmtCost } from '../_lib/utils';

interface CostBreakdownProps {
  total: number;
  llm: number;
  tts: number;
  stt: number;
  telephony: number;
  t: (k: string) => string;
}

export function CostBreakdown({ total, llm, tts, stt, telephony, t }: CostBreakdownProps) {
  const categories = [
    { key: 'llm', label: t('dashboard.costLlm'), value: llm, color: 'var(--th-primary)' },
    { key: 'tts', label: t('dashboard.costTts'), value: tts, color: 'var(--th-success-icon)' },
    { key: 'stt', label: t('dashboard.costStt'), value: stt, color: 'var(--th-warning-icon)' },
    { key: 'telephony', label: t('dashboard.costTelephony'), value: telephony, color: 'var(--th-info-text)' },
  ];
  const maxVal = Math.max(...categories.map(c => c.value), 0.001);

  return (
    <div className="p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-semibold text-[var(--th-text)]">{t('dashboard.costBreakdown')}</h3>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-[var(--th-text)]">{fmtCost(total)}</span>
          <span className="text-[10px] text-[var(--th-text-muted)]">30d</span>
        </div>
      </div>
      <div className="space-y-2">
        {categories.map(cat => {
          const pct = total > 0 ? Math.round((cat.value / total) * 100) : 0;
          const barWidth = Math.max((cat.value / maxVal) * 100, 0);
          return (
            <div key={cat.key}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cat.color }} />
                  <span className="text-[11px] text-[var(--th-text-secondary)]">{cat.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--th-text)]">{fmtCost(cat.value)}</span>
                  <span className="text-[10px] text-[var(--th-text-muted)] w-7 text-right">{pct}%</span>
                </div>
              </div>
              <div className="h-1 rounded-full bg-[var(--th-surface)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%`, background: cat.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
