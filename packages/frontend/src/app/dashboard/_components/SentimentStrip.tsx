'use client';
import { SENTIMENT_COLORS } from '../_lib/constants';

interface SentimentStripProps {
  data: Record<string, number>;
  t: (k: string) => string;
}

const ORDER = ['positive', 'neutral', 'mixed', 'negative'];
const LABELS: Record<string, string> = { positive: 'Positive', neutral: 'Neutral', mixed: 'Mixed', negative: 'Negative' };

export function SentimentStrip({ data, t }: SentimentStripProps) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-[var(--th-text)] mb-2.5">{t('dashboard.sentiment')}</h3>
      <div className="flex w-full h-[3px] rounded-full overflow-hidden mb-2.5">
        {ORDER.map(key => {
          const count = data[key] ?? 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return <div key={key} className={`${SENTIMENT_COLORS[key]} transition-all`} style={{ width: `${pct}%` }} />;
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {ORDER.map(key => {
          const count = data[key] ?? 0;
          if (count === 0) return null;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={key} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SENTIMENT_COLORS[key]}`} />
              <span className="text-[10px] text-[var(--th-text-secondary)]">{LABELS[key]}</span>
              <span className="text-[10px] font-semibold text-[var(--th-text)]">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
