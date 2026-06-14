'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminPeriodFilter from '../_components/AdminPeriodFilter';
import AdminKpiCard from '../_components/AdminKpiCard';
import AdminChart from '../_components/AdminChart';
import AdminTable from '../_components/AdminTable';

type Period = 'today' | '7d' | '30d' | 'year' | 'all';
const DAYS: Record<Period, number> = { today: 1, '7d': 7, '30d': 30, year: 365, all: 365 };

interface Overview { pageviews: number; visitors: number; sessions: number; active_now: number; avg_time_ms: number; avg_session_ms: number }
interface SeriesPt { day: string; pageviews: number; visitors: number }
type PageRow = { path: string; views: number; visitors: number; avg_time_ms: number; avg_scroll: number };
type ClickRow = { element_label: string; path: string; clicks: number; k: string };
type SourceRow = { source: string; visitors: number };
type DeviceRow = { device: string; visitors: number };
interface Funnel { visitors: number; reached_login: number; signed_up: number }
interface PathRow { path: string; views: number }
interface HeatPoint { x_pct: number; y_px: number }
interface ScrollRow { scroll_pct: number; c: number }

const card = 'rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] shadow-[0_1px_3px_var(--th-shadow)]';

function fmtMs(ms: number): string {
  const s = Math.round((ms || 0) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

type Tab = 'pages' | 'clicks' | 'sources' | 'funnel' | 'heatmaps';

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const days = DAYS[period];
  const [tab, setTab] = useState<Tab>('pages');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [series, setSeries] = useState<SeriesPt[]>([]);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [clicks, setClicks] = useState<ClickRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);

  useEffect(() => {
    const q = `?days=${days}`;
    api.get<Overview>(`/admin/analytics/overview${q}`).then(setOverview).catch(() => {});
    api.get<{ series: SeriesPt[] }>(`/admin/analytics/timeseries${q}`).then(r => setSeries(r.series || [])).catch(() => {});
    api.get<{ pages: PageRow[] }>(`/admin/analytics/pages${q}`).then(r => setPages(r.pages || [])).catch(() => {});
    api.get<{ clicks: Omit<ClickRow, 'k'>[] }>(`/admin/analytics/clicks${q}`).then(r => setClicks((r.clicks || []).map((c, i) => ({ ...c, k: `${c.path}|${c.element_label}|${i}` })))).catch(() => {});
    api.get<{ sources: SourceRow[] }>(`/admin/analytics/sources${q}`).then(r => setSources(r.sources || [])).catch(() => {});
    api.get<{ devices: DeviceRow[] }>(`/admin/analytics/devices${q}`).then(r => setDevices(r.devices || [])).catch(() => {});
    api.get<Funnel>(`/admin/analytics/funnel${q}`).then(setFunnel).catch(() => {});
  }, [days]);

  const chartData = useMemo(() => series.map(s => ({ label: s.day.slice(5), value: s.pageviews })), [series]);

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'pages', label: 'Pages', icon: 'description' },
    { key: 'clicks', label: 'Clicks', icon: 'ads_click' },
    { key: 'sources', label: 'Sources & devices', icon: 'travel_explore' },
    { key: 'funnel', label: 'Funnel', icon: 'filter_alt' },
    { key: 'heatmaps', label: 'Heatmaps', icon: 'thermostat' },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Analytics"
        subtitle="Behavior on the public site & landing (first-party, in-house)"
        icon="insights"
        action={<AdminPeriodFilter value={period} onChange={setPeriod} />}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <AdminKpiCard label="Pageviews" value={String(overview?.pageviews ?? '—')} icon="visibility" color="99,102,241" />
        <AdminKpiCard label="Unique visitors" value={String(overview?.visitors ?? '—')} icon="group" color="14,165,233" />
        <AdminKpiCard label="Active now" value={String(overview?.active_now ?? '—')} icon="bolt" color="34,197,94" />
        <AdminKpiCard label="Sessions" value={String(overview?.sessions ?? '—')} icon="timeline" color="139,92,246" />
        <AdminKpiCard label="Avg time / page" value={overview ? fmtMs(overview.avg_time_ms) : '—'} icon="schedule" color="244,114,182" />
        <AdminKpiCard label="Avg session" value={overview ? fmtMs(overview.avg_session_ms) : '—'} icon="hourglass_bottom" color="234,179,8" />
      </div>

      {/* Visits chart */}
      <div className={`${card} p-4`}>
        <div className="text-sm font-bold text-[var(--th-text)] mb-3">Pageviews over time</div>
        {chartData.length > 0
          ? <AdminChart data={chartData} height={180} formatValue={(v) => String(Math.round(v))} color="99,102,241" />
          : <div className="text-sm text-[var(--th-text-muted)] py-8 text-center">No data yet for this period.</div>}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tb => {
          const on = tab === tb.key;
          return (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={on
                ? { background: 'var(--th-primary)', color: '#fff' }
                : { background: 'var(--th-card)', color: 'var(--th-text-secondary)', border: '1px solid var(--th-border)' }}>
              <span className="material-symbols-outlined text-[15px]">{tb.icon}</span>{tb.label}
            </button>
          );
        })}
      </div>

      {tab === 'pages' && (
        <div className={card}>
          <AdminTable<PageRow>
            columns={[
              { key: 'path', label: 'Page', render: r => <span className="font-medium text-[var(--th-text)]">{r.path}</span> },
              { key: 'views', label: 'Views', render: r => <span className="tabular-nums">{r.views}</span> },
              { key: 'visitors', label: 'Visitors', render: r => <span className="tabular-nums">{r.visitors}</span> },
              { key: 'avg_time', label: 'Avg time', render: r => <span className="tabular-nums">{fmtMs(r.avg_time_ms)}</span> },
              { key: 'scroll', label: 'Avg scroll (attention)', render: r => (
                <div className="flex items-center gap-2 min-w-[120px]">
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--th-surface)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.avg_scroll)}%`, background: 'var(--th-primary)' }} />
                  </div>
                  <span className="tabular-nums text-xs">{r.avg_scroll}%</span>
                </div>
              ) },
            ]}
            data={pages}
            keyField="path"
            emptyIcon="description"
            emptyText="No page data for this period."
          />
        </div>
      )}

      {tab === 'clicks' && (
        <div className={card}>
          <AdminTable<ClickRow>
            columns={[
              { key: 'label', label: 'Button / link', render: r => <span className="font-medium text-[var(--th-text)]">{r.element_label}</span> },
              { key: 'path', label: 'On page', render: r => <span className="text-[var(--th-text-muted)]">{r.path}</span> },
              { key: 'clicks', label: 'Clicks', render: r => <span className="tabular-nums font-bold">{r.clicks}</span> },
            ]}
            data={clicks}
            keyField="k"
            emptyIcon="ads_click"
            emptyText="No click data for this period."
          />
        </div>
      )}

      {tab === 'sources' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={card}>
            <div className="px-4 py-3 text-sm font-bold text-[var(--th-text)] border-b border-[var(--th-border)]">Traffic sources</div>
            <AdminTable<SourceRow>
              columns={[
                { key: 'source', label: 'Source', render: r => <span className="font-medium text-[var(--th-text)]">{r.source}</span> },
                { key: 'visitors', label: 'Visitors', render: r => <span className="tabular-nums">{r.visitors}</span> },
              ]}
              data={sources} keyField="source" emptyIcon="travel_explore" emptyText="No source data."
            />
          </div>
          <div className={card}>
            <div className="px-4 py-3 text-sm font-bold text-[var(--th-text)] border-b border-[var(--th-border)]">Devices</div>
            <AdminTable<DeviceRow>
              columns={[
                { key: 'device', label: 'Device', render: r => <span className="font-medium text-[var(--th-text)] capitalize">{r.device}</span> },
                { key: 'visitors', label: 'Visitors', render: r => <span className="tabular-nums">{r.visitors}</span> },
              ]}
              data={devices} keyField="device" emptyIcon="devices" emptyText="No device data."
            />
          </div>
        </div>
      )}

      {tab === 'funnel' && (
        <div className={`${card} p-5`}>
          <div className="text-sm font-bold text-[var(--th-text)] mb-4">Signup funnel</div>
          {funnel ? <FunnelView funnel={funnel} /> : <div className="text-sm text-[var(--th-text-muted)]">Loading…</div>}
        </div>
      )}

      {tab === 'heatmaps' && <Heatmaps days={days} />}
    </div>
  );
}

function FunnelView({ funnel }: { funnel: Funnel }) {
  const stages = [
    { label: 'Visited site', value: funnel.visitors },
    { label: 'Reached /login', value: funnel.reached_login },
    { label: 'Signed up', value: funnel.signed_up },
  ];
  const top = Math.max(funnel.visitors, 1);
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const pct = (s.value / top) * 100;
        const stepConv = i > 0 && stages[i - 1].value > 0 ? (s.value / stages[i - 1].value) * 100 : null;
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-[var(--th-text)]">{s.label}</span>
              <span className="tabular-nums text-[var(--th-text-muted)]">
                {s.value}{stepConv != null && <span className="ml-2 text-[var(--th-text-secondary)]">{stepConv.toFixed(0)}% →</span>}
              </span>
            </div>
            <div className="h-3 rounded-full bg-[var(--th-surface)] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: 'linear-gradient(90deg, var(--th-primary), #8b5cf6)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Heatmaps ───────────────────────────────────────────────────────────────
const VP_WIDTH: Record<string, number> = { desktop: 1280, tablet: 800, mobile: 390 };

function colorRamp(t: number): [number, number, number] {
  t = Math.min(1, Math.max(0, t * 1.2));
  const stops: [number, number, number][] = [[0, 0, 255], [0, 255, 255], [0, 255, 0], [255, 255, 0], [255, 0, 0]];
  const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  const f = t * (stops.length - 1) - seg;
  const a = stops[seg], b = stops[seg + 1];
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
}

function drawHeatmap(canvas: HTMLCanvasElement, points: { x: number; y: number }[], w: number, h: number) {
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  const r = 24;
  for (const p of points) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, 'rgba(0,0,0,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  }
  const img = ctx.getImageData(0, 0, w, h); const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]; if (!a) continue;
    const [rr, gg, bb] = colorRamp(a / 255);
    d[i] = rr; d[i + 1] = gg; d[i + 2] = bb; d[i + 3] = Math.min(220, a * 3);
  }
  ctx.putImageData(img, 0, 0);
}

// Scroll-reach zones: each depth band coloured by the share of visitors who
// reached it (hot = everyone saw it, cold = few scrolled that far).
function drawScrollHeatmap(canvas: HTMLCanvasElement, scroll: ScrollRow[], w: number, h: number) {
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  const total = scroll.reduce((a, s) => a + s.c, 0) || 1;
  for (let d = 0; d < 100; d++) {
    const reach = scroll.filter(s => s.scroll_pct >= d).reduce((a, s) => a + s.c, 0) / total;
    const [r, g, b] = colorRamp(reach);
    ctx.fillStyle = `rgba(${r},${g},${b},0.42)`;
    const y0 = (d / 100) * h, y1 = ((d + 1) / 100) * h;
    ctx.fillRect(0, y0, w, y1 - y0 + 1);
  }
}

type HeatMode = 'click' | 'move' | 'scroll';

function Heatmaps({ days }: { days: number }) {
  const [paths, setPaths] = useState<PathRow[]>([]);
  const [path, setPath] = useState<string>('/');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [mode, setMode] = useState<HeatMode>('click');
  const [points, setPoints] = useState<HeatPoint[]>([]);
  const [scroll, setScroll] = useState<ScrollRow[]>([]);
  const [iframeH, setIframeH] = useState(2200);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    api.get<{ paths: PathRow[] }>(`/admin/analytics/paths?days=${days}`).then(r => {
      setPaths(r.paths || []);
      if (r.paths?.length && !r.paths.find(p => p.path === path)) setPath(r.paths[0].path);
    }).catch(() => {});
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const kind = mode === 'move' ? 'move' : 'click';
    api.get<{ points: HeatPoint[]; scroll: ScrollRow[] }>(
      `/admin/analytics/heatmap?path=${encodeURIComponent(path)}&viewport=${viewport}&kind=${kind}&days=${days}`,
    ).then(r => { setPoints(r.points || []); setScroll(r.scroll || []); }).catch(() => { setPoints([]); setScroll([]); });
  }, [path, viewport, days, mode]);

  const w = VP_WIDTH[viewport];

  const redraw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    if (mode === 'scroll') { drawScrollHeatmap(canvas, scroll, w, iframeH); return; }
    const pts = points
      .map(p => ({ x: (p.x_pct / 10000) * w, y: Math.min(p.y_px, iframeH) }))
      .filter(p => p.y <= iframeH);
    drawHeatmap(canvas, pts, w, iframeH);
  }, [mode, points, scroll, w, iframeH]);

  useEffect(() => { redraw(); }, [redraw]);

  const onIframeLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      const h = doc?.body ? Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight) : 0;
      if (h && h > 200) setIframeH(Math.min(h, 12000));
    } catch { /* cross-origin or blocked — keep default height, canvas still renders */ }
  };

  const maxScroll = Math.max(1, ...scroll.map(s => s.c));

  return (
    <div className="space-y-4">
      <div className={`${card} p-4 flex flex-wrap items-end gap-4`}>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase mb-1">Page</label>
          <select value={path} onChange={e => setPath(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--th-border)] bg-[var(--th-input)] text-[var(--th-text)] text-sm min-w-[260px]">
            {(paths.length ? paths : [{ path: '/', views: 0 }]).map(p => (
              <option key={p.path} value={p.path}>{p.path} ({p.views})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase mb-1">Device</label>
          <div className="flex gap-1">
            {(['desktop', 'tablet', 'mobile'] as const).map(v => (
              <button key={v} onClick={() => setViewport(v)}
                className="px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-colors"
                style={viewport === v ? { background: 'var(--th-primary)', color: '#fff' } : { background: 'var(--th-card)', color: 'var(--th-text-secondary)', border: '1px solid var(--th-border)' }}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase mb-1">View</label>
          <div className="flex gap-1">
            {([['click', 'Clicks'], ['move', 'Attention'], ['scroll', 'Scroll reach']] as const).map(([m, lbl]) => (
              <button key={m} onClick={() => setMode(m)}
                className="px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={mode === m ? { background: 'var(--th-primary)', color: '#fff' } : { background: 'var(--th-card)', color: 'var(--th-text-secondary)', border: '1px solid var(--th-border)' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-[var(--th-text-muted)] ml-auto">{mode === 'scroll' ? 'scroll-reach zones' : `${points.length} points plotted`}</div>
      </div>

      {/* Scroll-reach (attention) */}
      <div className={`${card} p-4`}>
        <div className="text-sm font-bold text-[var(--th-text)] mb-3">Scroll reach (attention)</div>
        {scroll.length === 0 ? (
          <div className="text-sm text-[var(--th-text-muted)]">No scroll data for this page yet.</div>
        ) : (
          <div className="flex items-end gap-1 h-28">
            {Array.from({ length: 10 }).map((_, i) => {
              const bucket = scroll.filter(s => Math.floor(s.scroll_pct / 10) === i).reduce((a, s) => a + s.c, 0);
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div className="w-full rounded-t" style={{ height: `${(bucket / maxScroll) * 100}%`, minHeight: bucket ? 4 : 0, background: 'linear-gradient(180deg,#ef4444,#f59e0b)' }} title={`${i * 10}-${i * 10 + 10}%: ${bucket}`} />
                  <span className="text-[9px] text-[var(--th-text-muted)] mt-1">{i * 10}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Click heatmap overlay on the live page */}
      <div className={`${card} p-4`}>
        <div className="text-sm font-bold text-[var(--th-text)] mb-3">{mode === 'click' ? 'Click' : mode === 'move' ? 'Attention (movement)' : 'Scroll-reach'} heatmap — {path}</div>
        <div className="overflow-auto border border-[var(--th-border)] rounded-lg" style={{ maxHeight: 600 }}>
          <div style={{ position: 'relative', width: w, height: iframeH }}>
            <iframe
              ref={iframeRef}
              src={path}
              onLoad={onIframeLoad}
              title="page preview"
              style={{ width: w, height: iframeH, border: 0, background: '#fff' }}
            />
            <canvas
              ref={canvasRef}
              style={{ position: 'absolute', top: 0, left: 0, width: w, height: iframeH, pointerEvents: 'none' }}
            />
          </div>
        </div>
        <p className="text-[11px] text-[var(--th-text-muted)] mt-2">
          Overlay of aggregated clicks on the live page at {viewport} width. If the page can&apos;t be framed, the heatmap still renders over a blank canvas.
        </p>
      </div>
    </div>
  );
}
