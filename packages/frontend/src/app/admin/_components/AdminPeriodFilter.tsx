'use client';
import type { Period } from '../_lib/types';

const OPTIONS: Array<{ value: Period; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
];

export default function AdminPeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {OPTIONS.map(o => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap"
            style={on
              ? { background: 'var(--th-primary-bg)', color: 'var(--th-primary-text)', border: '1px solid var(--th-primary)' }
              : { background: 'var(--th-card)', color: 'var(--th-text-secondary)', border: '1px solid var(--th-border)' }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
