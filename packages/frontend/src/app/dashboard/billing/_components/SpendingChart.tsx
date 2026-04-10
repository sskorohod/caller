'use client';
import { useMemo, useState } from 'react';
import { smoothPath } from '@/lib/chart-utils';

const DAY_KEYS = ['day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat'];

interface SpendingChartProps {
  dailySpending: { day: string; amount: number }[];
  t: (k: string) => string;
}

const CHART_W = 500;
const CHART_H = 130;
const PAD_X = 30;
const PAD_Y = 16;

export function SpendingChart({ dailySpending, t }: SpendingChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const chartData = useMemo(() => {
    return dailySpending.map(d => {
      const date = new Date(d.day + 'T12:00:00');
      return {
        label: t(DAY_KEYS[date.getDay()]),
        date: d.day,
        amount: d.amount,
        isToday: d.day === new Date().toISOString().slice(0, 10),
      };
    });
  }, [dailySpending, t]);

  const maxAmount = Math.max(...chartData.map(d => d.amount), 0.01);

  const points = useMemo(() => {
    const usableW = CHART_W - PAD_X * 2;
    const usableH = CHART_H - PAD_Y * 2;
    return chartData.map((d, i) => ({
      x: PAD_X + (i / 6) * usableW,
      y: PAD_Y + usableH - (d.amount / maxAmount) * usableH,
    }));
  }, [chartData, maxAmount]);

  const curvePath = useMemo(() => smoothPath(points, PAD_Y, CHART_H - PAD_Y), [points]);
  const areaPath = useMemo(() => {
    if (!curvePath) return '';
    return `${curvePath} L ${points[points.length - 1].x} ${CHART_H} L ${points[0].x} ${CHART_H} Z`;
  }, [curvePath, points]);

  const yTicks = [0, +(maxAmount / 2).toFixed(2), +maxAmount.toFixed(2)];

  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('billing.spendingThisWeek')}</h3>
        <span className="text-[11px] text-[var(--th-text-muted)] bg-[var(--th-surface)] px-2 py-0.5 rounded-md">{t('billing.last7Days')}</span>
      </div>

      <svg viewBox={`0 0 ${CHART_W} ${CHART_H + 24}`} className="w-full" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="spendAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eab308" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#eab308" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="spendLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
          <filter id="spendGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(ratio => {
          const y = PAD_Y + (CHART_H - PAD_Y * 2) * (1 - ratio);
          return <line key={ratio} x1={PAD_X} y1={y} x2={CHART_W - PAD_X} y2={y} stroke="var(--th-border-light)" strokeWidth={1} strokeDasharray="4 4" />;
        })}

        {/* Y labels */}
        {yTicks.map((tick, i) => {
          const y = PAD_Y + (CHART_H - PAD_Y * 2) - (tick / maxAmount) * (CHART_H - PAD_Y * 2);
          return (
            <text key={i} x={PAD_X - 8} y={y + 3} textAnchor="end" fill="var(--th-text-muted)" fontSize={9} fontWeight={500}>
              ${tick}
            </text>
          );
        })}

        {/* Area + line */}
        {areaPath && <path d={areaPath} fill="url(#spendAreaGrad)" />}
        {curvePath && (
          <path d={curvePath} fill="none" stroke="url(#spendLineGrad)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" filter="url(#spendGlow)" />
        )}

        {/* Points + hover */}
        {points.map((pt, i) => {
          const isHovered = hover === i;
          const day = chartData[i];
          return (
            <g key={day.date}>
              <rect x={pt.x - CHART_W / 14} y={0} width={CHART_W / 7} height={CHART_H + 24} fill="transparent" onMouseEnter={() => setHover(i)} />
              {isHovered && <line x1={pt.x} y1={PAD_Y} x2={pt.x} y2={CHART_H} stroke="var(--th-border)" strokeWidth={1} strokeDasharray="3 3" />}
              <circle cx={pt.x} cy={pt.y} r={isHovered ? 5 : day.isToday ? 4 : 3} fill={day.isToday || isHovered ? '#eab308' : '#facc15'} stroke="var(--th-card)" strokeWidth={2} className="transition-[r,fill] duration-150" />
              {day.isToday && <circle cx={pt.x} cy={pt.y} r={7} fill="none" stroke="#eab308" strokeWidth={1} opacity={0.3} />}
              {isHovered && (() => {
                const flipBelow = pt.y < 32;
                const tooltipY = flipBelow ? pt.y + 12 : pt.y - 28;
                const textY = flipBelow ? pt.y + 25 : pt.y - 15;
                return (
                  <g>
                    <rect x={pt.x - 28} y={tooltipY} width={56} height={22} rx={8} fill="var(--th-text)" />
                    <text x={pt.x} y={textY} textAnchor="middle" fill="var(--th-page)" fontSize={11} fontWeight={700}>
                      ${day.amount.toFixed(2)}
                    </text>
                  </g>
                );
              })()}
              <text x={pt.x} y={CHART_H + 16} textAnchor="middle" fill={day.isToday ? 'var(--th-primary-text)' : 'var(--th-text-muted)'} fontSize={10} fontWeight={day.isToday ? 700 : 500}>
                {day.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
