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
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] h-full">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('dashboard.callsThisWeek')}</h3>
        <span className="text-[11px] text-[var(--th-text-muted)] bg-[var(--th-surface)] px-2 py-0.5 rounded-md">{t('dashboard.last7Days')}</span>
      </div>

      {/* Y-axis grid lines */}
      <div className="relative" style={{ height: 130 }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(ratio => (
          <div
            key={ratio}
            className="absolute left-0 right-0 border-t border-dashed border-[var(--th-border-light)]"
            style={{ bottom: `${ratio * 100}%` }}
          />
        ))}

        {/* Bars */}
        <div className="relative flex items-end justify-between gap-2.5 h-full">
          {chartData.map(day => {
            const barH = maxCount > 0 ? Math.max((day.count / maxCount) * 115, day.count > 0 ? 8 : 0) : 0;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                {/* Tooltip on hover */}
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[var(--th-text)] text-[var(--th-page)] text-[10px] font-bold px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {day.count}
                </div>
                <div className="w-full flex justify-center">
                  <div
                    className={`w-full max-w-[28px] rounded-lg transition-all duration-300 group-hover:scale-[1.08] group-hover:brightness-110 ${day.isToday ? 'shadow-[0_0_12px_rgba(99,102,241,0.3)]' : ''}`}
                    style={{
                      height: barH || 3,
                      background: day.isToday
                        ? 'var(--th-bar-primary)'
                        : (day.count > 0 ? 'var(--th-bar-muted)' : 'var(--th-border)'),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day labels */}
      <div className="flex justify-between gap-2.5 mt-2">
        {chartData.map(day => (
          <div key={day.date} className="flex-1 text-center">
            <span className={`text-[10px] font-medium ${day.isToday ? 'text-[var(--th-primary-text)] font-bold' : 'text-[var(--th-text-muted)]'}`}>{day.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
