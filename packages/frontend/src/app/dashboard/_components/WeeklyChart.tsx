'use client';
import { useMemo } from 'react';
import { DAY_LABELS } from '../_lib/constants';

interface WeeklyChartProps {
  dailyCalls: { day: string; count: number }[];
  t: (k: string) => string;
}

export function WeeklyChart({ dailyCalls, t }: WeeklyChartProps) {
  const chartData = useMemo(() => {
    const now = new Date();
    const days: { label: string; date: string; count: number; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const match = dailyCalls.find(dc => dc.day === dateStr);
      days.push({
        label: DAY_LABELS[d.getDay()],
        date: dateStr,
        count: match?.count ?? 0,
        isToday: i === 0,
      });
    }
    return days;
  }, [dailyCalls]);

  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] p-5 shadow-[0_2px_8px_var(--th-shadow)] h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('dashboard.callsThisWeek')}</h3>
        <span className="text-[11px] text-[var(--th-text-muted)]">{t('dashboard.last7Days')}</span>
      </div>
      <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
        {chartData.map(day => {
          const barH = maxCount > 0 ? Math.max((day.count / maxCount) * 95, day.count > 0 ? 6 : 0) : 0;
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5 group">
              <span className="text-[10px] font-semibold text-[var(--th-text)] opacity-0 group-hover:opacity-100 transition-opacity">{day.count}</span>
              <div className="w-full flex justify-center">
                <div
                  className={`w-full max-w-[28px] rounded-md transition-all group-hover:opacity-80 ${day.isToday ? 'bg-[var(--th-primary)]' : ''}`}
                  style={{
                    height: barH || 3,
                    backgroundColor: day.isToday ? undefined : (day.count > 0 ? 'var(--th-primary-muted)' : 'var(--th-border)'),
                  }}
                />
              </div>
              <span className={`text-[10px] font-medium ${day.isToday ? 'text-[var(--th-primary-text)] font-semibold' : 'text-[var(--th-text-muted)]'}`}>{day.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
