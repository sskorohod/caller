'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Call {
  id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  from_number: string;
  to_number: string;
  duration_seconds: number | null;
  summary: string | null;
  sentiment: string | null;
  qa_score: number | null;
  cost_total: string | null;
  agent_profile_id: string | null;
  created_at: string;
}

interface TranscriptEntry {
  role: 'agent' | 'caller';
  content: string;
  timestamp?: string;
}

interface RawTranscriptEntry {
  speaker?: string;
  role?: string;
  text?: string;
  content?: string;
  timestamp?: string;
}

function normalizeTranscript(raw: RawTranscriptEntry[]): TranscriptEntry[] {
  return raw.map(entry => ({
    role: (entry.role ?? entry.speaker ?? 'caller') as 'agent' | 'caller',
    content: entry.content ?? entry.text ?? '',
    timestamp: entry.timestamp,
  }));
}

interface AiSession {
  id: string;
  transcript: TranscriptEntry[] | null;
  recording_url: string | null;
  summary: string | null;
  action_items: string[] | null;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
  qa_score: number | null;
  cost_total: string | null;
  total_turns: number | null;
  avg_latency_ms: number | null;
}

interface CallDetail {
  call: Call;
  session: AiSession | null;
  events: unknown[];
}

interface AgentOption {
  id: string;
  name: string;
}

interface DashboardStats {
  total_calls: number;
  today_calls: number;
  week_calls: number;
  active_calls: number;
  success_rate: number;
  avg_duration_seconds: number;
  total_minutes_30d: number;
  direction_breakdown: Record<string, number>;
}

interface AdvancedFilters {
  dateFrom: string;
  dateTo: string;
  agentId: string;
  sentimentPositive: boolean;
  sentimentNeutral: boolean;
  sentimentNegative: boolean;
  sentimentMixed: boolean;
  minDuration: string;
  maxDuration: string;
}

const EMPTY_FILTERS: AdvancedFilters = {
  dateFrom: '', dateTo: '', agentId: '',
  sentimentPositive: false, sentimentNeutral: false, sentimentNegative: false, sentimentMixed: false,
  minDuration: '', maxDuration: '',
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  completed:   'bg-[var(--th-success-bg)] text-[var(--th-success-text)]',
  failed:      'bg-[var(--th-error-bg)] text-[var(--th-error-text)]',
  in_progress: 'bg-[var(--th-info-bg)] text-[var(--th-info-text)]',
  initiated:   'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]',
  ringing:     'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]',
  cancelled:   'bg-[var(--th-surface)] text-[var(--th-text-muted)]',
  canceled:    'bg-[var(--th-surface)] text-[var(--th-text-muted)]',
  no_answer:   'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed', failed: 'Failed', in_progress: 'In Progress',
  initiated: 'Initiated', ringing: 'Ringing', cancelled: 'Cancelled',
  canceled: 'Cancelled', no_answer: 'No Answer',
};

const SENTIMENT_BADGE: Record<string, { cls: string; label: string; icon: string }> = {
  positive: { cls: 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]', label: 'Positive', icon: '+' },
  negative: { cls: 'bg-[var(--th-error-bg)] text-[var(--th-error-text)]', label: 'Negative', icon: '−' },
  neutral:  { cls: 'bg-[var(--th-surface)] text-[var(--th-text-muted)]', label: 'Neutral', icon: '~' },
  mixed:    { cls: 'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]', label: 'Mixed', icon: '±' },
};

// ─── Utilities ───────────────────────────────────────────────────────────────

function fmtDuration(s: number | null) {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDateShort(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Mini KPI Card ───────────────────────────────────────────────────────────

function MiniKpi({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-4 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--th-surface)] flex items-center justify-center text-[var(--th-text-muted)] shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold text-[var(--th-text)] leading-tight">{value}</div>
          <div className="text-[11px] text-[var(--th-text-muted)] leading-tight">{label}</div>
        </div>
        {sub && <div className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)] shrink-0">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Direction Breakdown ─────────────────────────────────────────────────────

function DirectionBar({ data }: { data: Record<string, number> }) {
  const inbound = data['inbound'] ?? 0;
  const outbound = data['outbound'] ?? 0;
  const total = inbound + outbound;
  if (total === 0) return null;
  const inPct = Math.round((inbound / total) * 100);
  const outPct = 100 - inPct;

  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-4 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--th-surface)] flex items-center justify-center text-[var(--th-text-muted)] shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-[var(--th-text-muted)]">↓ In {inPct}%</span>
            <span className="text-[11px] text-[var(--th-text-muted)]">↑ Out {outPct}%</span>
          </div>
          <div className="flex w-full h-2 rounded-full overflow-hidden">
            <div className="bg-[var(--th-success-icon)] transition-all" style={{ width: `${inPct}%` }} />
            <div className="bg-[var(--th-primary)] transition-all" style={{ width: `${outPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Tabs ─────────────────────────────────────────────────────────────

function FilterTabs({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: (k: string) => string }) {
  const tabs = [
    { key: 'all', label: t('calls.allCalls') },
    { key: 'inbound', label: t('calls.inboundFilter') },
    { key: 'outbound', label: t('calls.outboundFilter') },
    { key: 'completed', label: t('calls.completedFilter') },
    { key: 'in_progress', label: 'Active' },
    { key: 'failed', label: t('calls.failedFilter') },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            value === tab.key
              ? 'bg-[var(--th-primary)] text-white'
              : 'text-[var(--th-text-muted)] hover:bg-[var(--th-surface)] hover:text-[var(--th-text-secondary)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Call Row (card-style) ───────────────────────────────────────────────────

function CallRow({ call, agentMap, onClick, expanded, onToggleExpand, checked, onCheck }: { call: Call; agentMap: Map<string, string>; onClick: () => void; expanded: boolean; onToggleExpand: () => void; checked: boolean; onCheck: (checked: boolean) => void }) {
  const phone = call.direction === 'outbound' ? call.to_number : call.from_number;
  const agentName = call.agent_profile_id ? agentMap.get(call.agent_profile_id) : null;

  return (
    <tr
      className="hover:bg-[var(--th-surface)] transition-colors cursor-pointer group"
      onClick={onClick}
    >
      {/* Checkbox */}
      <td className="pl-4 pr-1 py-3.5 w-8" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onCheck(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-[var(--th-border)] accent-[var(--th-primary)] cursor-pointer"
        />
      </td>
      {/* Phone + Agent */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            call.status === 'in_progress' ? 'bg-[var(--th-info-bg)]' :
            call.status === 'completed' ? 'bg-[var(--th-success-bg)]' :
            call.status === 'failed' ? 'bg-[var(--th-error-bg)]' :
            'bg-[var(--th-surface)]'
          }`}>
            <svg className={`w-3.5 h-3.5 ${
              call.status === 'in_progress' ? 'text-[var(--th-info-text)] animate-pulse' :
              call.status === 'completed' ? 'text-[var(--th-success-text)]' :
              call.status === 'failed' ? 'text-[var(--th-error-text)]' :
              'text-[var(--th-text-muted)]'
            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--th-text)] truncate">{phone}</div>
            {agentName && <div className="text-[11px] text-[var(--th-text-muted)] truncate">{agentName}</div>}
          </div>
        </div>
      </td>

      {/* Direction */}
      <td className="px-5 py-3.5">
        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
          call.direction === 'outbound'
            ? 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]'
            : 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]'
        }`}>
          {call.direction === 'outbound' ? '↑ Out' : '↓ In'}
        </span>
      </td>

      {/* Status */}
      <td className="px-5 py-3.5">
        <span className={`inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[call.status] ?? STATUS_COLORS.cancelled}`}>
          {STATUS_LABELS[call.status] ?? call.status}
        </span>
      </td>

      {/* Duration + Cost */}
      <td className="px-5 py-3.5 text-sm tabular-nums text-[var(--th-text-secondary)]">
        <div>{fmtDuration(call.duration_seconds)}</div>
        {call.cost_total && Number(call.cost_total) > 0 && (
          <div className="text-[10px] text-amber-600 dark:text-amber-400">${Number(call.cost_total).toFixed(4)}</div>
        )}
      </td>

      {/* Summary — expandable */}
      <td className="px-5 py-3.5 max-w-[260px]" onClick={e => { e.stopPropagation(); if (call.summary) onToggleExpand(); }}>
        {call.summary ? (
          <p className={`text-[11px] text-[var(--th-text-muted)] leading-snug cursor-pointer hover:text-[var(--th-text-secondary)] transition-colors ${expanded ? '' : 'line-clamp-2'}`}>
            {call.summary}
          </p>
        ) : (
          <span className="text-[11px] text-[var(--th-text-muted)]">—</span>
        )}
      </td>

      {/* Date */}
      <td className="px-5 py-3.5 text-sm text-[var(--th-text-muted)] whitespace-nowrap">{fmtDateShort(call.created_at)}</td>

      {/* Arrow */}
      <td className="px-5 py-3.5">
        <svg className="w-4 h-4 text-[var(--th-text-muted)] group-hover:text-[var(--th-primary-text)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </td>
    </tr>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CallsPage() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const LIMIT = 50;

  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Call | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());

  const [showFilters, setShowFilters] = useState(false);
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [exporting, setExporting] = useState(false);

  const agentMap = useMemo(() => new Map(agents.map(a => [a.id, a.name])), [agents]);

  // Load agents + stats
  useEffect(() => {
    api.get<{ agents: AgentOption[] }>('/agents').then(r => setAgents(r?.agents ?? [])).catch(() => {});
    api.get<DashboardStats>('/calls/stats').then(setStats).catch(() => {});
  }, []);

  function buildQueryParams(loadOffset = 0, limitOverride?: number) {
    const params = new URLSearchParams();
    params.set('limit', String(limitOverride ?? LIMIT));
    params.set('offset', String(loadOffset));
    if (filter !== 'all') {
      if (filter === 'inbound' || filter === 'outbound') params.set('direction', filter);
      else params.set('status', filter);
    }
    if (advFilters.dateFrom) params.set('from', new Date(advFilters.dateFrom).toISOString());
    if (advFilters.dateTo) params.set('to', new Date(advFilters.dateTo + 'T23:59:59').toISOString());
    if (advFilters.agentId) params.set('agent_profile_id', advFilters.agentId);
    const sentiments: string[] = [];
    if (advFilters.sentimentPositive) sentiments.push('positive');
    if (advFilters.sentimentNeutral) sentiments.push('neutral');
    if (advFilters.sentimentNegative) sentiments.push('negative');
    if (advFilters.sentimentMixed) sentiments.push('mixed');
    if (sentiments.length > 0) params.set('sentiment', sentiments.join(','));
    if (advFilters.minDuration) params.set('min_duration', advFilters.minDuration);
    if (advFilters.maxDuration) params.set('max_duration', advFilters.maxDuration);
    return params.toString();
  }

  const loadCalls = useCallback((loadOffset = 0) => {
    setError('');
    const isLoadMore = loadOffset > 0;
    if (isLoadMore) setLoadingMore(true); else setLoading(true);
    const qs = buildQueryParams(loadOffset);
    api.get<{ calls: Call[]; total: number }>(`/calls?${qs}`)
      .then(r => {
        const newCalls = r?.calls ?? [];
        setCalls(prev => isLoadMore ? [...prev, ...newCalls] : newCalls);
        setTotal(r?.total ?? 0);
        setOffset(loadOffset + newCalls.length);
      })
      .catch((err: any) => setError(err?.message ?? 'Failed to load'))
      .finally(() => { setLoading(false); setLoadingMore(false); });
  }, [filter, advFilters]);

  useEffect(() => { loadCalls(); }, [filter]);

  function applyFilters() {
    setOffset(0);
    loadCalls(0);
  }

  const openDetail = useCallback((call: Call) => {
    if (call.status === 'in_progress' || call.status === 'ringing') {
      router.push(`/dashboard/calls/${call.id}/live`);
      return;
    }
    setSelected(call);
    setDetail(null);
    setDetailLoading(true);
    api.get<CallDetail>(`/calls/${call.id}/detail`)
      .then(r => {
        if (r?.session?.transcript && Array.isArray(r.session.transcript)) {
          r.session.transcript = normalizeTranscript(r.session.transcript as RawTranscriptEntry[]);
        }
        setDetail(r);
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [router]);

  const closeDetail = useCallback(() => { setSelected(null); setDetail(null); }, []);

  const handleBulkDelete = useCallback(async () => {
    if (checkedIds.size === 0) return;
    if (!confirm(t('calls.bulkDeleteConfirm', { count: String(checkedIds.size) }))) return;
    try {
      await api.post('/calls/bulk-delete', { ids: Array.from(checkedIds) });
      toast.success(t('calls.bulkDeleted', { count: String(checkedIds.size) }));
      setCheckedIds(new Set());
      loadCalls();
    } catch {
      toast.error(t('calls.bulkDeleteError'));
    }
  }, [checkedIds]);

  const filtered = calls.filter(c => {
    if (!search) return true;
    return c.to_number?.includes(search) || c.from_number?.includes(search);
  });

  // ─── Export CSV
  async function handleExportCSV() {
    setExporting(true);
    try {
      const qs = buildQueryParams(0, 1000);
      const res = await api.get<{ calls: Call[]; total: number }>(`/calls?${qs}`);
      const rows = res?.calls ?? [];
      if (rows.length === 0) { toast.info(t('calls.noCallsToExport')); return; }
      const headers = ['Date', 'Phone', 'Direction', 'Status', 'Duration', 'Agent', 'Summary'];
      const csvRows = rows.map(c => [
        new Date(c.created_at).toISOString(),
        c.direction === 'outbound' ? c.to_number : c.from_number,
        c.direction, c.status, fmtDuration(c.duration_seconds),
        agentMap.get(c.agent_profile_id ?? '') ?? '',
        `"${(c.summary ?? '').replace(/"/g, '""')}"`,
      ].join(','));
      downloadFile([headers.join(','), ...csvRows].join('\n'), `calls-export-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
      toast.success(t('calls.exportSuccess', { count: String(rows.length) }));
    } catch (err: any) { toast.error(err?.message ?? 'Export failed'); }
    finally { setExporting(false); }
  }

  function handleDownloadTranscript() {
    if (!detail?.session?.transcript?.length) return;
    const lines = detail.session.transcript.map(e => {
      const speaker = e.role === 'agent' ? t('calls.agentRole') : t('calls.callerRole');
      const ts = e.timestamp ? ` [${e.timestamp}]` : '';
      return `${speaker}${ts}: ${e.content}`;
    });
    const phone = selected?.direction === 'outbound' ? selected?.to_number : selected?.from_number;
    downloadFile(lines.join('\n'), `transcript-${phone ?? 'call'}-${new Date(selected?.created_at ?? '').toISOString().slice(0, 10)}.txt`, 'text/plain');
    toast.success(t('calls.transcriptDownloaded'));
  }

  const hasActiveFilters = advFilters.dateFrom || advFilters.dateTo || advFilters.agentId ||
    advFilters.sentimentPositive || advFilters.sentimentNeutral || advFilters.sentimentNegative || advFilters.sentimentMixed ||
    advFilters.minDuration || advFilters.maxDuration;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--th-text)]">{t('calls.title')}</h2>
          <p className="text-sm text-[var(--th-text-muted)] mt-0.5">
            {total > 0 ? t('calls.totalCalls', { count: String(total) }) : t('calls.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {checkedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-3 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)] text-[10px] font-semibold uppercase tracking-wider text-white transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              {t('calls.deleteSelected', { count: String(checkedIds.size) })}
            </button>
          )}
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="px-3 py-2 rounded-lg border border-[var(--th-card-border-subtle)] text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {exporting ? '...' : t('calls.exportCSV')}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MiniKpi label={t('dashboard.totalCalls')} value={String(stats.total_calls)}
            sub={`+${stats.today_calls}`}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>}
          />
          <MiniKpi label={t('dashboard.activeNow')} value={String(stats.active_calls)}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}
          />
          <MiniKpi label={t('dashboard.successRate')} value={`${stats.success_rate}%`}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <MiniKpi label={t('dashboard.avgDuration')}
            value={`${Math.floor(stats.avg_duration_seconds / 60)}:${String(stats.avg_duration_seconds % 60).padStart(2, '0')}`}
            sub={`${stats.total_minutes_30d}m`}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <DirectionBar data={stats.direction_breakdown} />
        </div>
      )}

      {/* Filter Tabs + Search */}
      <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
        <div className="px-5 py-3 border-b border-[var(--th-card-border-subtle)] flex flex-wrap items-center gap-3">
          <FilterTabs value={filter} onChange={v => { setFilter(v); setTimeout(() => applyFilters(), 0); }} t={t} />

          <div className="ml-auto flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('calls.searchPhone')}
                className="w-44 pl-8 pr-3 py-1.5 rounded-xl border border-[var(--th-card-border-subtle)] text-xs text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] bg-[var(--th-card)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors"
              />
            </div>

            {/* Advanced Filters */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`p-1.5 rounded-lg border transition-colors ${
                showFilters || hasActiveFilters
                  ? 'border-[var(--th-primary)] bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]'
                  : 'border-[var(--th-card-border-subtle)] text-[var(--th-text-muted)] hover:bg-[var(--th-surface)]'
              }`}
              title={t('calls.advancedFilters')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
            </button>

            {/* Results count */}
            <span className="text-[11px] text-[var(--th-text-muted)] tabular-nums">{filtered.length} {t('calls.results')}</span>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="px-5 py-4 border-b border-[var(--th-card-border-subtle)] bg-[var(--th-surface)]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">{t('calls.dateFrom')}</label>
                <input type="date" value={advFilters.dateFrom} onChange={e => setAdvFilters(p => ({ ...p, dateFrom: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-xl border border-[var(--th-card-border-subtle)] text-xs text-[var(--th-text)] bg-[var(--th-card)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">{t('calls.dateTo')}</label>
                <input type="date" value={advFilters.dateTo} onChange={e => setAdvFilters(p => ({ ...p, dateTo: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-xl border border-[var(--th-card-border-subtle)] text-xs text-[var(--th-text)] bg-[var(--th-card)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">{t('calls.filterAgent')}</label>
                <select value={advFilters.agentId} onChange={e => setAdvFilters(p => ({ ...p, agentId: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-xl border border-[var(--th-card-border-subtle)] text-xs text-[var(--th-text)] bg-[var(--th-card)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]">
                  <option value="">{t('calls.allAgents')}</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">{t('calls.duration')} (sec)</label>
                <div className="flex gap-2">
                  <input type="number" min="0" placeholder="Min" value={advFilters.minDuration} onChange={e => setAdvFilters(p => ({ ...p, minDuration: e.target.value }))}
                    className="w-full px-2 py-1.5 rounded-xl border border-[var(--th-card-border-subtle)] text-xs text-[var(--th-text)] bg-[var(--th-card)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]" />
                  <input type="number" min="0" placeholder="Max" value={advFilters.maxDuration} onChange={e => setAdvFilters(p => ({ ...p, maxDuration: e.target.value }))}
                    className="w-full px-2 py-1.5 rounded-xl border border-[var(--th-card-border-subtle)] text-xs text-[var(--th-text)] bg-[var(--th-card)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-5 mt-3">
              <span className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">{t('calls.sentiment')}</span>
              {(['positive', 'neutral', 'negative', 'mixed'] as const).map(s => {
                const key = `sentiment${s.charAt(0).toUpperCase() + s.slice(1)}` as keyof AdvancedFilters;
                return (
                  <label key={s} className="flex items-center gap-1.5 text-xs text-[var(--th-text-secondary)] cursor-pointer">
                    <input type="checkbox" checked={advFilters[key] as boolean}
                      onChange={e => setAdvFilters(p => ({ ...p, [key]: e.target.checked }))}
                      className="rounded border-[var(--th-border)] text-[var(--th-primary-text)] focus:ring-[var(--th-primary)]/20" />
                    {t(`calls.sentiment_${s}`)}
                  </label>
                );
              })}
              <div className="ml-auto flex gap-2">
                <button onClick={() => { setAdvFilters(EMPTY_FILTERS); setTimeout(applyFilters, 0); }}
                  className="px-3 py-1 text-xs font-medium text-[var(--th-text-muted)] hover:text-[var(--th-text-secondary)] transition-colors">
                  {t('calls.clearFilters')}
                </button>
                <button onClick={applyFilters}
                  className="px-4 py-1 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-colors">
                  {t('calls.applyFilters')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-6 text-center">
            <p className="text-sm font-medium text-[var(--th-error-text)]">{error}</p>
            <button onClick={() => loadCalls()} className="mt-2 text-xs font-medium text-[var(--th-error-text)] hover:underline">{t('common.retry')}</button>
          </div>
        )}

        {/* Table */}
        {!error && (loading ? (
          <div className="p-5 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-8 h-8 bg-[var(--th-skeleton)] rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-[var(--th-skeleton)] rounded w-1/4" />
                  <div className="h-2.5 bg-[var(--th-skeleton)] rounded w-1/3" />
                </div>
                <div className="h-5 bg-[var(--th-skeleton)] rounded w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-12 h-12 bg-[var(--th-surface)] rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--th-text-secondary)]">{t('calls.noCalls')}</p>
            <p className="text-xs text-[var(--th-text-muted)] mt-1">{t('calls.noCallsHint')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-[var(--th-surface)] border-b border-[var(--th-card-border-subtle)]">
                <tr>
                  <th className="pl-4 pr-1 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && checkedIds.size === filtered.length}
                      onChange={e => {
                        if (e.target.checked) setCheckedIds(new Set(filtered.map(c => c.id)));
                        else setCheckedIds(new Set());
                      }}
                      className="w-3.5 h-3.5 rounded border-[var(--th-border)] accent-[var(--th-primary)] cursor-pointer"
                    />
                  </th>
                  {[t('calls.phone'), t('calls.direction'), t('calls.status'), t('calls.duration'), t('calls.summary'), t('calls.date'), ''].map(h => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--th-border-light)]">
                {filtered.map(call => (
                  <CallRow key={call.id} call={call} agentMap={agentMap} onClick={() => openDetail(call)}
                    expanded={expandedSummaries.has(call.id)}
                    onToggleExpand={() => setExpandedSummaries(prev => {
                      const next = new Set(prev);
                      next.has(call.id) ? next.delete(call.id) : next.add(call.id);
                      return next;
                    })}
                    checked={checkedIds.has(call.id)}
                    onCheck={v => setCheckedIds(prev => {
                      const next = new Set(prev);
                      v ? next.add(call.id) : next.delete(call.id);
                      return next;
                    })} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Load More */}
      {!loading && offset < total && (
        <div className="flex justify-center">
          <button
            onClick={() => loadCalls(offset)}
            disabled={loadingMore}
            className="px-5 py-2.5 text-sm font-medium text-[var(--th-primary-text)] hover:bg-[var(--th-primary-bg)] border border-[var(--th-card-border-subtle)] rounded-2xl transition-colors disabled:opacity-50"
          >
            {loadingMore ? '...' : `${t('calls.loadMore')} (${total - offset} ${t('calls.remaining')})`}
          </button>
        </div>
      )}

      {/* ─── Detail Modal ─────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-start justify-end" onClick={closeDetail} role="dialog" aria-modal="true">
          <div className="bg-[var(--th-modal)] w-full max-w-xl h-full rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] flex flex-col animate-[slideIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--th-card-border-subtle)] shrink-0">
              <div>
                <h2 className="text-base font-semibold text-[var(--th-text)]">{t('calls.callDetail')}</h2>
                <p className="text-xs text-[var(--th-text-muted)] mt-0.5">{fmtDate(selected.created_at)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={async () => {
                    if (!confirm(t('calls.deleteConfirm'))) return;
                    try {
                      await api.delete(`/calls/${selected.id}`);
                      toast.success(t('calls.deleted'));
                      closeDetail();
                      loadCalls();
                    } catch (e: any) { toast.error(e.message); }
                  }}
                  className="p-1.5 hover:bg-[var(--th-error-bg)] rounded-lg transition-colors"
                  aria-label="Delete"
                >
                  <svg className="w-4 h-4 text-[var(--th-text-muted)] hover:text-[var(--th-error-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
                <button onClick={closeDetail} className="p-1.5 hover:bg-[var(--th-surface)] rounded-lg transition-colors" aria-label="Close">
                  <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Phone cards */}
              <div className="flex gap-3">
                <div className="flex-1 rounded-2xl bg-[var(--th-surface)] border border-[var(--th-card-border-subtle)] p-3 text-center">
                  <p className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase mb-0.5">{t('calls.from')}</p>
                  <p className="text-sm font-bold text-[var(--th-text)] tracking-wide">{selected.from_number || '—'}</p>
                </div>
                <div className="flex items-center">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    selected.direction === 'outbound' ? 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]' : 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]'
                  }`}>
                    {selected.direction === 'outbound' ? '→' : '←'}
                  </span>
                </div>
                <div className="flex-1 rounded-2xl bg-[var(--th-surface)] border border-[var(--th-card-border-subtle)] p-3 text-center">
                  <p className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase mb-0.5">{t('calls.to')}</p>
                  <p className="text-sm font-bold text-[var(--th-text)] tracking-wide">{selected.to_number || '—'}</p>
                </div>
              </div>

              {/* Metadata row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[var(--th-surface)] rounded-lg p-3 text-center">
                  <p className="text-[10px] text-[var(--th-text-muted)] uppercase font-semibold">{t('calls.status')}</p>
                  <span className={`inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium mt-1 ${STATUS_COLORS[selected.status] ?? STATUS_COLORS.cancelled}`}>
                    {STATUS_LABELS[selected.status] ?? selected.status}
                  </span>
                </div>
                <div className="bg-[var(--th-surface)] rounded-lg p-3 text-center">
                  <p className="text-[10px] text-[var(--th-text-muted)] uppercase font-semibold">{t('calls.duration')}</p>
                  <p className="text-sm font-bold text-[var(--th-text)] mt-1 tabular-nums">{fmtDuration(selected.duration_seconds)}</p>
                </div>
                <div className="bg-[var(--th-surface)] rounded-lg p-3 text-center">
                  <p className="text-[10px] text-[var(--th-text-muted)] uppercase font-semibold">{t('calls.direction')}</p>
                  <p className="text-sm font-bold text-[var(--th-text)] mt-1 capitalize">{selected.direction}</p>
                </div>
              </div>

              {detailLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[var(--th-primary)] border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-sm text-[var(--th-text-muted)]">{t('calls.loadingDetails')}</span>
                </div>
              )}

              {!detailLoading && detail && (() => {
                const session = detail.session;
                const summaryText = session?.summary ?? selected.summary;
                return (
                  <>
                    {/* Badges */}
                    {session && (session.sentiment || session.qa_score !== null || session.cost_total !== null) && (
                      <div className="flex flex-wrap gap-2">
                        {session.sentiment && (() => {
                          const sb = SENTIMENT_BADGE[session.sentiment];
                          return sb ? (
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sb.cls}`}>
                              {sb.icon} {sb.label}
                            </span>
                          ) : null;
                        })()}
                        {session.qa_score !== null && (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            session.qa_score >= 7 ? 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]' :
                            session.qa_score >= 4 ? 'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]' :
                            'bg-[var(--th-error-bg)] text-[var(--th-error-text)]'
                          }`}>
                            QA: {session.qa_score}/10
                          </span>
                        )}
                        {session.cost_total !== null && (
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]">
                            ${Number(session.cost_total).toFixed(4)}
                          </span>
                        )}
                        {session.total_turns !== null && session.total_turns > 0 && (
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-[var(--th-surface)] text-[var(--th-text-muted)]">
                            {session.total_turns} turns
                          </span>
                        )}
                        {session.avg_latency_ms !== null && (
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-[var(--th-surface)] text-[var(--th-text-muted)]">
                            {session.avg_latency_ms}ms avg
                          </span>
                        )}
                      </div>
                    )}

                    {/* Summary */}
                    {summaryText && (
                      <div className="rounded-2xl bg-[var(--th-surface)] p-4">
                        <p className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-2">{t('calls.summary')}</p>
                        <p className="text-sm text-[var(--th-text-secondary)] leading-relaxed">{summaryText}</p>
                      </div>
                    )}

                    {/* Action Items */}
                    {session?.action_items && session.action_items.length > 0 && (
                      <div className="rounded-2xl bg-[var(--th-surface)] p-4">
                        <p className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-2">{t('calls.actionItems')}</p>
                        <ul className="space-y-1.5">
                          {session.action_items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[var(--th-text-secondary)]">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--th-primary)] shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recording */}
                    {session?.recording_url && (
                      <div className="rounded-2xl bg-[var(--th-surface)] p-4">
                        <p className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-2">{t('calls.recording')}</p>
                        <audio controls className="w-full rounded-lg" src={`/api/calls/${selected!.id}/recording`} />
                      </div>
                    )}

                    {/* Transcript */}
                    <div className="rounded-2xl bg-[var(--th-surface)] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">{t('calls.transcript')}</p>
                        {session?.transcript && session.transcript.length > 0 && (
                          <button onClick={handleDownloadTranscript}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--th-card-border-subtle)] text-[11px] font-medium text-[var(--th-text-secondary)] hover:bg-[var(--th-card)] transition-colors">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            {t('calls.downloadTranscript')}
                          </button>
                        )}
                      </div>
                      {!session?.transcript || session.transcript.length === 0 ? (
                        <p className="text-sm text-[var(--th-text-muted)] italic">{t('calls.noTranscript')}</p>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                          {session.transcript.map((entry, i) => (
                            <div key={i} className={`flex flex-col ${entry.role === 'agent' ? 'items-end' : 'items-start'}`}>
                              <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                                entry.role === 'agent'
                                  ? 'bg-[var(--th-primary)] text-white'
                                  : 'bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-[var(--th-text)]'
                              }`}>
                                <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
                                  entry.role === 'agent' ? 'text-white/60' : 'text-[var(--th-text-muted)]'
                                }`}>
                                  {entry.role === 'agent' ? t('calls.agentRole') : t('calls.callerRole')}
                                  {entry.timestamp && <span className="ml-1.5 font-normal normal-case tracking-normal">{entry.timestamp}</span>}
                                </p>
                                <p className="text-sm leading-relaxed">{entry.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {!detailLoading && !detail && selected.summary && (
                <div className="rounded-2xl bg-[var(--th-surface)] p-4">
                  <p className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide mb-2">{t('calls.summary')}</p>
                  <p className="text-sm text-[var(--th-text-secondary)] leading-relaxed">{selected.summary}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide-in animation */}
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
