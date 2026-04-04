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

const COST_COLORS = [
  { gradient: 'linear-gradient(90deg, #6366f1, #818cf8)', dot: '#818cf8' },
  { gradient: 'linear-gradient(90deg, #22c55e, #4ade80)', dot: '#4ade80' },
  { gradient: 'linear-gradient(90deg, #eab308, #facc15)', dot: '#facc15' },
  { gradient: 'linear-gradient(90deg, #3b82f6, #60a5fa)', dot: '#60a5fa' },
];

export function CostBreakdown({ total, llm, tts, stt, telephony, t }: CostBreakdownProps) {
  const categories = [
    { key: 'llm', label: t('dashboard.costLlm'), value: llm },
    { key: 'tts', label: t('dashboard.costTts'), value: tts },
    { key: 'stt', label: t('dashboard.costStt'), value: stt },
    { key: 'telephony', label: t('dashboard.costTelephony'), value: telephony },
  ];
  const maxVal = Math.max(...categories.map(c => c.value), 0.001);

  return (
    <div className="p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{t('dashboard.costBreakdown')}</h3>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-[var(--th-text)]">{fmtCost(total)}</span>
          <span className="text-[10px] text-[var(--th-text-muted)]">30d</span>
        </div>
      </div>
      <div className="space-y-2.5">
        {categories.map((cat, i) => {
          const pct = total > 0 ? Math.round((cat.value / total) * 100) : 0;
          const barWidth = Math.max((cat.value / maxVal) * 100, 0);
          return (
            <div key={cat.key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COST_COLORS[i].dot }} />
                  <span className="text-[11px] text-[var(--th-text-secondary)]">{cat.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--th-text)]">{fmtCost(cat.value)}</span>
                  <span className="text-[10px] text-[var(--th-text-muted)] w-7 text-right">{pct}%</span>
                </div>
              </div>
              <div className="h-[5px] rounded-full bg-[var(--th-surface)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${barWidth}%`, background: COST_COLORS[i].gradient }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
