'use client';

interface SentimentStripProps {
  data: Record<string, number>;
  t: (k: string) => string;
}

const ORDER = ['positive', 'neutral', 'mixed', 'negative'];
const LABEL_KEYS: Record<string, string> = { positive: 'sentiment.positive', neutral: 'sentiment.neutral', mixed: 'sentiment.mixed', negative: 'sentiment.negative' };
const COLORS: Record<string, { bar: string; dot: string }> = {
  positive: { bar: '#22c55e', dot: '#4ade80' },
  neutral: { bar: '#64748b', dot: '#94a3b8' },
  mixed: { bar: '#eab308', dot: '#facc15' },
  negative: { bar: '#ef4444', dot: '#f87171' },
};

export function SentimentStrip({ data, t }: SentimentStripProps) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-3">{t('dashboard.sentiment')}</h3>
      {/* Stacked bar with rounded ends */}
      <div className="flex w-full h-[6px] rounded-full overflow-hidden gap-px mb-3">
        {ORDER.map(key => {
          const count = data[key] ?? 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={key}
              className="transition-all duration-500 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${pct}%`, background: COLORS[key].bar }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {ORDER.map(key => {
          const count = data[key] ?? 0;
          if (count === 0) return null;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLORS[key].dot }} />
              <span className="text-[10px] text-[var(--th-text-secondary)]">{t(LABEL_KEYS[key])}</span>
              <span className="text-[10px] font-bold text-[var(--th-text)]">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
