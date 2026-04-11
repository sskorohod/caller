/**
 * Generate a smooth cubic bezier SVG path through a set of points.
 * Uses monotone cubic interpolation — prevents overshoots and gives
 * a clean, professional look similar to D3's curveMonotoneX.
 */
export function smoothPath(
  points: { x: number; y: number }[],
  minY: number,
  maxY: number,
): string {
  const n = points.length;
  if (n < 2) return '';
  if (n === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  const clamp = (v: number) => Math.min(Math.max(v, minY), maxY);

  // 1. Compute slopes (finite differences)
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    dy.push(points[i + 1].y - points[i].y);
    m.push(dy[i] / dx[i]);
  }

  // 2. Monotone tangents (Fritsch–Carlson)
  const tangents: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      // Sign change or zero — flat tangent prevents overshoot
      tangents.push(0);
    } else {
      // Harmonic mean preserves monotonicity
      tangents.push(2 / (1 / m[i - 1] + 1 / m[i]));
    }
  }
  tangents.push(m[n - 2]);

  // 3. Build cubic bezier segments
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const seg = dx[i] / 3;
    const cp1x = points[i].x + seg;
    const cp1y = clamp(points[i].y + tangents[i] * seg);
    const cp2x = points[i + 1].x - seg;
    const cp2y = clamp(points[i + 1].y - tangents[i + 1] * seg);
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i + 1].x} ${points[i + 1].y}`;
  }
  return d;
}
