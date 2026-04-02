'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';

interface Call {
  id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  from_number: string;
  to_number: string;
  duration_seconds: number | null;
  summary: string | null;
  sentiment_score: number | null;
  agent_profile_id: string | null;
  created_at: string;
}

interface TranscriptEntry {
  role: 'agent' | 'caller';
  content: string;
  timestamp?: string;
}

/** Backend may return transcript entries with { speaker, text } instead of { role, content } */
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
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  qa_score: number | null;
  cost_total: string | null;
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

interface AdvancedFilters {
  dateFrom: string;
  dateTo: string;
  agentId: string;
  sentimentPositive: boolean;
  sentimentNeutral: boolean;
  sentimentNegative: boolean;
  minDuration: string;
  maxDuration: string;
}

const EMPTY_FILTERS: AdvancedFilters = {
  dateFrom: '', dateTo: '', agentId: '', sentimentPositive: false,
  sentimentNeutral: false, sentimentNegative: false, minDuration: '', maxDuration: '',
};

const STATUS_COLORS: Record<string, string> = {
  completed:   'bg-green-100 text-green-700',
  failed:      'bg-red-100 text-red-700',
  in_progress: 'bg-blue-100 text-blue-700',
  initiated:   'bg-purple-100 text-purple-700',
  ringing:     'bg-yellow-100 text-yellow-700',
  cancelled:   'bg-gray-100 text-gray-500',
  no_answer:   'bg-orange-100 text-orange-600',
};

function fmtDuration(s: number | null) {
  if (!s) return '\u2014';
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CallsPage() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const LIMIT = 50;
  const [calls, setCalls]       = useState<Call[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [selected, setSelected] = useState<Call | null>(null);
  const [detail, setDetail]     = useState<CallDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError]       = useState('');
  const [offset, setOffset]     = useState(0);
  const [total, setTotal]       = useState(0);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [exporting, setExporting] = useState(false);

  // Load agents for filter dropdown
  useEffect(() => {
    api.get<AgentOption[]>('/agents')
      .then(r => setAgents(Array.isArray(r) ? r : []))
      .catch(() => {});
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
    if (sentiments.length > 0) params.set('sentiment', sentiments.join(','));
    if (advFilters.minDuration) params.set('min_duration', advFilters.minDuration);
    if (advFilters.maxDuration) params.set('max_duration', advFilters.maxDuration);
    return params.toString();
  }

  function loadCalls(loadOffset = 0) {
    setError('');
    const isLoadMore = loadOffset > 0;
    if (isLoadMore) setLoadingMore(true); else setLoading(true);
    const qs = buildQueryParams(loadOffset);
    api.get<{ calls: Call[]; total: number }>(`/calls?${qs}`)
      .then(r => {
        const newCalls = r?.calls ?? [];
        const newTotal = r?.total ?? 0;
        setCalls(prev => isLoadMore ? [...prev, ...newCalls] : newCalls);
        setTotal(newTotal);
        setOffset(loadOffset + newCalls.length);
      })
      .catch((err: any) => setError(err?.message ?? 'Failed to load calls'))
      .finally(() => { setLoading(false); setLoadingMore(false); });
  }

  useEffect(() => { loadCalls(); }, []);

  // Re-load when filter or advFilters change
  function applyFilters() {
    setOffset(0);
    loadCalls(0);
  }

  const openDetail = useCallback((call: Call) => {
    // Route active calls to the live monitoring page
    if (call.status === 'in_progress' || call.status === 'ringing') {
      router.push(`/dashboard/calls/${call.id}/live`);
      return;
    }
    setSelected(call);
    setDetail(null);
    setDetailLoading(true);
    api.get<CallDetail>(`/calls/${call.id}/detail`)
      .then(r => {
        // Normalize transcript fields: backend may return { speaker, text } instead of { role, content }
        if (r?.session?.transcript && Array.isArray(r.session.transcript)) {
          r.session.transcript = normalizeTranscript(r.session.transcript as RawTranscriptEntry[]);
        }
        setDetail(r);
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [router]);

  const closeDetail = useCallback(() => {
    setSelected(null);
    setDetail(null);
  }, []);

  // Client-side search filter (phone number)
  const filtered = calls.filter(c => {
    const matchSearch = !search || c.to_number?.includes(search) || c.from_number?.includes(search);
    return matchSearch;
  });

  // ─── Export CSV ────────────────────────────────────────────────────────────
  async function handleExportCSV() {
    setExporting(true);
    try {
      const qs = buildQueryParams(0, 1000);
      const res = await api.get<{ calls: Call[]; total: number }>(`/calls?${qs}`);
      const rows = res?.calls ?? [];
      if (rows.length === 0) {
        toast.info(t('calls.noCallsToExport'));
        return;
      }
      const headers = ['Date', 'Phone', 'Direction', 'Status', 'Duration', 'Agent', 'Summary'];
      const agentMap = new Map(agents.map(a => [a.id, a.name]));
      const csvRows = rows.map(c => [
        new Date(c.created_at).toISOString(),
        c.direction === 'outbound' ? (c.to_number ?? '') : (c.from_number ?? ''),
        c.direction,
        c.status,
        fmtDuration(c.duration_seconds),
        agentMap.get(c.agent_profile_id ?? '') ?? '',
        `"${(c.summary ?? '').replace(/"/g, '""')}"`,
      ].join(','));
      const csv = [headers.join(','), ...csvRows].join('\n');
      downloadFile(csv, `calls-export-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
      toast.success(t('calls.exportSuccess', { count: String(rows.length) }));
    } catch (err: any) {
      toast.error(err?.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  // ─── Download Transcript ──────────────────────────────────────────────────
  function handleDownloadTranscript() {
    if (!detail?.session?.transcript || detail.session.transcript.length === 0) return;
    const lines = detail.session.transcript.map(entry => {
      const speaker = entry.role === 'agent' ? 'Agent' : 'Caller';
      const ts = entry.timestamp ? ` [${entry.timestamp}]` : '';
      return `${speaker}${ts}: ${entry.content}`;
    });
    const phone = selected?.direction === 'outbound' ? selected?.to_number : selected?.from_number;
    const filename = `transcript-${phone ?? 'call'}-${new Date(selected?.created_at ?? '').toISOString().slice(0,10)}.txt`;
    downloadFile(lines.join('\n'), filename, 'text/plain');
    toast.success(t('calls.transcriptDownloaded'));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0f172a]">{t('calls.title')}</h2>
          <p className="text-sm text-[#94a3b8] mt-0.5">{total > 0 ? t('calls.totalCalls', { count: String(total) }) : t('calls.callsLoaded', { count: String(calls.length) })}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button onClick={() => loadCalls()} className="mt-3 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 rounded-lg transition-colors">{t('common.retry')}</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        {/* Search + Filter Bar */}
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('calls.searchPhone')}
              className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition-colors"
            />
          </div>
          <select
            value={filter}
            onChange={e => { setFilter(e.target.value); }}
            className="px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] bg-white"
          >
            <option value="all">{t('calls.allCalls')}</option>
            <option value="inbound">{t('calls.inboundFilter')}</option>
            <option value="outbound">{t('calls.outboundFilter')}</option>
            <option value="completed">{t('calls.completedFilter')}</option>
            <option value="failed">{t('calls.failedFilter')}</option>
          </select>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5 ${
              showFilters ? 'border-[#6366f1] bg-[#eef2ff] text-[#6366f1]' : 'border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            {t('calls.advancedFilters')}
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm font-medium text-[#475569] hover:bg-[#f8fafc] transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {exporting ? t('common.loading') : t('calls.exportCSV')}
          </button>

          <div className="ml-auto text-xs text-[#94a3b8]">{filtered.length} {t('calls.results')}</div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="px-5 py-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Date Range */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wide">{t('calls.dateFrom')}</label>
                <input
                  type="date"
                  value={advFilters.dateFrom}
                  onChange={e => setAdvFilters(p => ({ ...p, dateFrom: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wide">{t('calls.dateTo')}</label>
                <input
                  type="date"
                  value={advFilters.dateTo}
                  onChange={e => setAdvFilters(p => ({ ...p, dateTo: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
                />
              </div>

              {/* Agent */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wide">{t('calls.filterAgent')}</label>
                <select
                  value={advFilters.agentId}
                  onChange={e => setAdvFilters(p => ({ ...p, agentId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
                >
                  <option value="">{t('calls.allAgents')}</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Duration */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wide">{t('calls.duration')} (sec)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Min"
                    value={advFilters.minDuration}
                    onChange={e => setAdvFilters(p => ({ ...p, minDuration: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Max"
                    value={advFilters.maxDuration}
                    onChange={e => setAdvFilters(p => ({ ...p, maxDuration: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
                  />
                </div>
              </div>
            </div>

            {/* Sentiment checkboxes + Apply */}
            <div className="flex items-center gap-6 mt-3">
              <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wide">{t('calls.sentiment')}</span>
              {(['positive', 'neutral', 'negative'] as const).map(s => {
                const key = `sentiment${s.charAt(0).toUpperCase() + s.slice(1)}` as keyof AdvancedFilters;
                return (
                  <label key={s} className="flex items-center gap-1.5 text-sm text-[#475569] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={advFilters[key] as boolean}
                      onChange={e => setAdvFilters(p => ({ ...p, [key]: e.target.checked }))}
                      className="rounded border-[#e2e8f0] text-[#6366f1] focus:ring-[#6366f1]/20"
                    />
                    {t(`calls.sentiment_${s}`)}
                  </label>
                );
              })}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => { setAdvFilters(EMPTY_FILTERS); setTimeout(() => applyFilters(), 0); }}
                  className="px-3 py-1.5 text-xs font-medium text-[#94a3b8] hover:text-[#475569] transition-colors"
                >
                  {t('calls.clearFilters')}
                </button>
                <button
                  onClick={applyFilters}
                  className="px-4 py-1.5 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {t('calls.applyFilters')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-24 h-3.5 bg-slate-100 rounded" />
                <div className="w-16 h-3.5 bg-slate-100 rounded" />
                <div className="w-20 h-3.5 bg-slate-100 rounded" />
                <div className="w-12 h-3.5 bg-slate-100 rounded" />
                <div className="w-28 h-3.5 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <p className="text-sm text-[#475569] font-medium">{t('calls.noCalls')}</p>
            <p className="text-xs text-[#94a3b8] mt-1">{t('calls.noCallsHint')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <tr>
                  {[t('calls.phone'), t('calls.direction'), t('calls.status'), t('calls.duration'), t('calls.date'), ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filtered.map(call => (
                  <tr key={call.id} className="hover:bg-[#f8fafc] transition-colors cursor-pointer" onClick={() => openDetail(call)}>
                    <td className="px-5 py-3.5 text-sm font-medium text-[#0f172a]">
                      {call.direction === 'outbound' ? call.to_number : call.from_number}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${call.direction === 'outbound' ? 'bg-[#eef2ff] text-[#6366f1]' : 'bg-[#f0fdf4] text-[#16a34a]'}`}>
                        {call.direction === 'outbound' ? `\u2191 ${t('calls.outbound')}` : `\u2193 ${t('calls.inbound')}`}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[call.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#475569]">{fmtDuration(call.duration_seconds)}</td>
                    <td className="px-5 py-3.5 text-sm text-[#94a3b8]">{fmtDate(call.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-[#6366f1] hover:text-[#4f46e5]">{t('calls.details')} \u2192</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Load More */}
      {!loading && offset < total && (
        <div className="flex justify-center">
          <button
            onClick={() => loadCalls(offset)}
            disabled={loadingMore}
            className="px-5 py-2.5 text-sm font-medium text-[#6366f1] hover:bg-[#eef2ff] border border-[#e2e8f0] rounded-xl transition-colors disabled:opacity-50"
          >
            {loadingMore ? t('common.loading') : `${t('calls.loadMore')} (${total - offset} ${t('calls.remaining')})`}
          </button>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeDetail} onKeyDown={e => e.key === 'Escape' && closeDetail()} role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e2e8f0] shrink-0">
              <div>
                <h2 className="text-base font-semibold text-[#0f172a]">{t('calls.callDetail')}</h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">{fmtDate(selected.created_at)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={async () => {
                    if (!confirm(`Delete this call?`)) return;
                    try {
                      await api.delete(`/calls/${selected.id}`);
                      toast.success('Call deleted');
                      closeDetail();
                      loadCalls();
                    } catch (e: any) { toast.error(e.message); }
                  }}
                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label="Delete call"
                >
                  <svg className="w-4 h-4 text-[#94a3b8] hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
                <button onClick={closeDetail} className="p-1.5 hover:bg-[#f1f5f9] rounded-lg transition-colors" aria-label="Close">
                  <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto">
              {/* Phone numbers - prominent display */}
              <div className="flex gap-4">
                <div className="flex-1 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-4 text-center">
                  <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wide mb-1">From</p>
                  <p className="text-base font-bold text-[#0f172a] tracking-wide">{selected.from_number || '\u2014'}</p>
                </div>
                <div className="flex items-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selected.direction === 'outbound' ? 'bg-[#eef2ff] text-[#6366f1]' : 'bg-[#f0fdf4] text-[#16a34a]'}`}>
                    {selected.direction === 'outbound' ? '\u2192' : '\u2190'}
                  </span>
                </div>
                <div className="flex-1 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-4 text-center">
                  <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wide mb-1">To</p>
                  <p className="text-base font-bold text-[#0f172a] tracking-wide">{selected.to_number || '\u2014'}</p>
                </div>
              </div>

              {/* Basic info */}
              {[
                ['Direction', selected.direction],
                ['Status', selected.status],
                ['Duration', fmtDuration(selected.duration_seconds)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-[#f1f5f9] last:border-0">
                  <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">{label}</span>
                  <span className="text-sm text-[#0f172a] font-medium">{value || '\u2014'}</span>
                </div>
              ))}

              {detailLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-sm text-[#94a3b8]">{t('calls.loadingDetails')}</span>
                </div>
              )}

              {!detailLoading && detail && (() => {
                const session = detail.session;
                const summaryText = session?.summary ?? selected.summary;
                return (
                  <>
                    {/* Metadata badges */}
                    {session && (session.sentiment || session.qa_score !== null || session.cost_total !== null) && (
                      <div className="flex flex-wrap gap-2">
                        {session.sentiment && (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            session.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                            session.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {session.sentiment === 'positive' ? '+ Positive' : session.sentiment === 'negative' ? '- Negative' : '~ Neutral'}
                          </span>
                        )}
                        {session.qa_score !== null && (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            session.qa_score >= 7 ? 'bg-green-100 text-green-700' :
                            session.qa_score >= 4 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            QA: {session.qa_score}/10
                          </span>
                        )}
                        {session.cost_total !== null && (
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-[#eef2ff] text-[#6366f1]">
                            Cost: ${Number(session.cost_total).toFixed(4)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Summary */}
                    {summaryText && (
                      <div className="rounded-xl bg-[#f8fafc] p-4">
                        <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">{t('calls.summary')}</p>
                        <p className="text-sm text-[#475569] leading-relaxed">{summaryText}</p>
                      </div>
                    )}

                    {/* Action items */}
                    {session?.action_items && session.action_items.length > 0 && (
                      <div className="rounded-xl bg-[#f8fafc] p-4">
                        <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">{t('calls.actionItems')}</p>
                        <ul className="space-y-1.5">
                          {session.action_items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[#475569]">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#6366f1] shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recording player */}
                    {session?.recording_url && (
                      <div className="rounded-xl bg-[#f8fafc] p-4">
                        <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">{t('calls.recording')}</p>
                        <audio controls className="w-full rounded-lg" src={session.recording_url}>
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    )}

                    {/* Transcript */}
                    <div className="rounded-xl bg-[#f8fafc] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">{t('calls.transcript')}</p>
                        {session?.transcript && session.transcript.length > 0 && (
                          <button
                            onClick={handleDownloadTranscript}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#e2e8f0] text-xs font-medium text-[#475569] hover:bg-white transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            {t('calls.downloadTranscript')}
                          </button>
                        )}
                      </div>
                      {!session?.transcript || session.transcript.length === 0 ? (
                        <p className="text-sm text-[#94a3b8] italic">{t('calls.noTranscript')}</p>
                      ) : (
                        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                          {session.transcript.map((entry, i) => (
                            <div key={i} className={`flex flex-col ${entry.role === 'agent' ? 'items-end' : 'items-start'}`}>
                              <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${
                                entry.role === 'agent'
                                  ? 'bg-[#6366f1] text-white'
                                  : 'bg-white border border-[#e2e8f0] text-[#0f172a]'
                              }`}>
                                <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
                                  entry.role === 'agent' ? 'text-indigo-200' : 'text-[#94a3b8]'
                                }`}>
                                  {entry.role === 'agent' ? 'Agent' : 'Caller'}
                                  {entry.timestamp && (
                                    <span className="ml-1.5 font-normal normal-case tracking-normal">
                                      {entry.timestamp}
                                    </span>
                                  )}
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

              {/* Fallback summary when detail hasn't loaded yet and not loading */}
              {!detailLoading && !detail && selected.summary && (
                <div className="rounded-xl bg-[#f8fafc] p-4">
                  <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">{t('calls.summary')}</p>
                  <p className="text-sm text-[#475569] leading-relaxed">{selected.summary}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
