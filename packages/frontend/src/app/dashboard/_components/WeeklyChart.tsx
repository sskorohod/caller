'use client';
import { useMemo, useState } from 'react';
import { DAY_LABELS } from '../_lib/constants';

interface WeeklyChartProps {
  dailyCalls: { day: string; count: number }[];
  t: (k: string) => string;
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const CHART_W = 500;
const CHART_H = 130;
const PAD_X = 30;
const PAD_Y = 16;

export function WeeklyChart({ dailyCalls, t }: WeeklyChartProps) {
  const [hover, setHover] = useState<number | null>(null);

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

  const points = useMemo(() => {
    const usableW = CHART_W - PAD_X * 2;
    const usableH = CHART_H - PAD_Y * 2;
    return chartData.map((d, i) => ({
      x: PAD_X + (i / 6) * usableW,
      y: PAD_Y + usableH - (d.count / maxCount) * usableH,
    }));
  }, [chartData, maxCount]);

  const curvePath = useMemo(() => smoothPath(points), [points]);
  const areaPath = useMemo(() => {
    if (!curvePath) return '';
    return `${curvePath} L ${points[points.length - 1].x} ${CHART_H} L ${points[0].x} ${CHART_H} Z`;
  }, [curvePath, points]);

  // Y-axis labels
  const yTicks = [0, Math.round(maxCount / 2), maxCount];

  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('dashboard.callsThisWeek')}</h3>
        <span className="text-[11px] text-[var(--th-text-muted)] bg-[var(--th-surface)] px-2 py-0.5 rounded-md">{t('dashboard.last7Days')}</span>
      </div>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H + 24}`}
        className="w-full"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75, 1].map(ratio => {
          const y = PAD_Y + (CHART_H - PAD_Y * 2) * (1 - ratio);
          return (
            <line
              key={ratio}
              x1={PAD_X} y1={y} x2={CHART_W - PAD_X} y2={y}
              stroke="var(--th-border-light)" strokeWidth={1} strokeDasharray="4 4"
            />
          );
        })}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => {
          const y = PAD_Y + (CHART_H - PAD_Y * 2) - (tick / maxCount) * (CHART_H - PAD_Y * 2);
          return (
            <text
              key={i}
              x={PAD_X - 8} y={y + 3}
              textAnchor="end"
              fill="var(--th-text-muted)"
              fontSize={9}
              fontWeight={500}
            >
              {tick}
            </text>
          );
        })}

        {/* Area fill */}
        {areaPath && (
          <path d={areaPath} fill="url(#curveGrad)" />
        )}

        {/* Curve line */}
        {curvePath && (
          <path
            d={curvePath}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />
        )}

        {/* Data points + hover zones */}
        {points.map((pt, i) => {
          const isHovered = hover === i;
          const day = chartData[i];
          return (
            <g key={day.date}>
              {/* Invisible hover zone */}
              <rect
                x={pt.x - (CHART_W / 14)}
                y={0}
                width={CHART_W / 7}
                height={CHART_H + 24}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />

              {/* Vertical guide line on hover */}
              {isHovered && (
                <line
                  x1={pt.x} y1={PAD_Y} x2={pt.x} y2={CHART_H}
                  stroke="var(--th-border)" strokeWidth={1} strokeDasharray="3 3"
                />
              )}

              {/* Dot */}
              <circle
                cx={pt.x} cy={pt.y}
                r={isHovered ? 5 : (day.isToday ? 4 : 3)}
                fill={day.isToday || isHovered ? '#6366f1' : '#818cf8'}
                stroke="var(--th-card)"
                strokeWidth={2}
                className="transition-all duration-150"
              />

              {/* Outer glow for today */}
              {day.isToday && (
                <circle
                  cx={pt.x} cy={pt.y}
                  r={7}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={1}
                  opacity={0.3}
                />
              )}

              {/* Tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={pt.x - 18} y={pt.y - 28}
                    width={36} height={20}
                    rx={6}
                    fill="var(--th-text)"
                  />
                  <text
                    x={pt.x} y={pt.y - 15}
                    textAnchor="middle"
                    fill="var(--th-page)"
                    fontSize={11}
                    fontWeight={700}
                  >
                    {day.count}
                  </text>
                </g>
              )}

              {/* Day label */}
              <text
                x={pt.x} y={CHART_H + 16}
                textAnchor="middle"
                fill={day.isToday ? 'var(--th-primary-text)' : 'var(--th-text-muted)'}
                fontSize={10}
                fontWeight={day.isToday ? 700 : 500}
              >
                {day.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
