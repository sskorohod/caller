'use client';
import { useState, useMemo } from 'react';
import { smoothPath } from '@/lib/chart-utils';

interface AdminChartProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
  formatValue?: (v: number) => string;
  color?: string;
}

export default function AdminChart({
  data,
  height = 160,
  formatValue = (v) => v.toFixed(2),
  color = 'var(--th-primary)',
}: AdminChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { path, fillPath, maxVal, points } = useMemo(() => {
    if (data.length === 0) return { path: '', fillPath: '', maxVal: 0, points: [] };

    const maxV = Math.max(...data.map((d) => d.value), 0.01);
    const padding = 24;
    const w = 100; // percentage-based
    const h = height - padding * 2;

    const pts = data.map((d, i) => ({
      x: data.length === 1 ? 50 : (i / (data.length - 1)) * w,
      y: padding + h - (d.value / maxV) * h,
    }));

    const minY = padding;
    const maxY = padding + h;
    const svgPath = smoothPath(pts, minY, maxY);
    const lastPt = pts[pts.length - 1];
    const firstPt = pts[0];
    const fill = `${svgPath} L ${lastPt.x},${height} L ${firstPt.x},${height} Z`;

    return { path: svgPath, fillPath: fill, maxVal: maxV, points: pts };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--th-text-muted)' }}>
        <span className="material-symbols-outlined text-2xl mb-1 block">show_chart</span>
        <p className="text-xs">No chart data</p>
      </div>
    );
  }

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 100 ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="admin-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>

        {/* Fill area */}
        <path d={fillPath} fill="url(#admin-chart-fill)" />

        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />

        {/* Hover zones */}
        {points.map((pt, i) => (
          <rect
            key={i}
            x={i === 0 ? 0 : (points[i - 1].x + pt.x) / 2}
            y={0}
            width={i === 0 || i === points.length - 1
              ? data.length === 1 ? 100 : 100 / (data.length - 1) / 2
              : (points[Math.min(i + 1, points.length - 1)].x - points[Math.max(i - 1, 0)].x) / 2}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
          />
        ))}

        {/* Hover dot */}
        {hoverIndex !== null && points[hoverIndex] && (
          <>
            <line
              x1={points[hoverIndex].x}
              y1={24}
              x2={points[hoverIndex].x}
              y2={height - 24}
              stroke={color}
              strokeWidth="0.15"
              strokeDasharray="0.5,0.5"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={points[hoverIndex].x}
              cy={points[hoverIndex].y}
              r="1"
              fill={color}
              vectorEffect="non-scaling-stroke"
              style={{ filter: `drop-shadow(0 0 2px ${color})` }}
            />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hoverIndex !== null && data[hoverIndex] && (
        <div
          className="absolute top-1 px-2 py-1 rounded-lg text-[10px] font-medium pointer-events-none"
          style={{
            left: `${points[hoverIndex].x}%`,
            transform: 'translateX(-50%)',
            background: 'var(--th-card)',
            border: '1px solid var(--th-border)',
            boxShadow: 'rgba(0,0,0,0.05) 0px 4px 12px',
            color: 'var(--th-text)',
          }}
        >
          <div style={{ color: 'var(--th-text-muted)' }}>{data[hoverIndex].label}</div>
          <div className="font-headline" style={{ color }}>{formatValue(data[hoverIndex].value)}</div>
        </div>
      )}

      {/* X-axis labels */}
      <div className="flex justify-between mt-1 px-0.5">
        <span className="text-[10px]" style={{ color: 'var(--th-text-muted)' }}>{data[0]?.label}</span>
        <span className="text-[10px]" style={{ color: 'var(--th-text-muted)' }}>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
