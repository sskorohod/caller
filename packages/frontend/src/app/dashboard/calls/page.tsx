'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface Call {
  id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  phone_number_to: string;
  phone_number_from: string;
  duration_seconds: number | null;
  summary: string | null;
  sentiment_score: number | null;
  created_at: string;
}

interface TranscriptEntry {
  role: 'agent' | 'caller';
  content: string;
  timestamp?: string;
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
  if (!s) return '—';
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function CallsPage() {
  const t = useT();
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

  function loadCalls(loadOffset = 0) {
    setError('');
    const isLoadMore = loadOffset > 0;
    if (isLoadMore) setLoadingMore(true); else setLoading(true);
    api.get<{ calls: Call[]; total: number }>(`/calls?limit=${LIMIT}&offset=${loadOffset}`)
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

  const openDetail = useCallback((call: Call) => {
    setSelected(call);
    setDetail(null);
    setDetailLoading(true);
    api.get<CallDetail>(`/calls/${call.id}/detail`)
      .then(r => setDetail(r))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, []);

  const closeDetail = useCallback(() => {
    setSelected(null);
    setDetail(null);
  }, []);

  const filtered = calls.filter(c => {
    const matchSearch = !search || c.phone_number_to?.includes(search) || c.phone_number_from?.includes(search);
    const matchFilter = filter === 'all' || c.direction === filter || c.status === filter;
    return matchSearch && matchFilter;
  });

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
        {/* Filters */}
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
            onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] bg-white"
          >
            <option value="all">{t('calls.allCalls')}</option>
            <option value="inbound">{t('calls.inboundFilter')}</option>
            <option value="outbound">{t('calls.outboundFilter')}</option>
            <option value="completed">{t('calls.completedFilter')}</option>
            <option value="failed">{t('calls.failedFilter')}</option>
          </select>
          <div className="ml-auto text-xs text-[#94a3b8]">{filtered.length} {t('calls.results')}</div>
        </div>

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
                      {call.direction === 'outbound' ? call.phone_number_to : call.phone_number_from}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${call.direction === 'outbound' ? 'bg-[#eef2ff] text-[#6366f1]' : 'bg-[#f0fdf4] text-[#16a34a]'}`}>
                        {call.direction === 'outbound' ? `↑ ${t('calls.outbound')}` : `↓ ${t('calls.inbound')}`}
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
                      <span className="text-xs text-[#6366f1] hover:text-[#4f46e5]">{t('calls.details')} →</span>
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
              <button onClick={closeDetail} className="p-1.5 hover:bg-[#f1f5f9] rounded-lg transition-colors" aria-label="Close">
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto">
              {/* Basic info */}
              {[
                ['From', selected.phone_number_from],
                ['To', selected.phone_number_to],
                ['Direction', selected.direction],
                ['Status', selected.status],
                ['Duration', fmtDuration(selected.duration_seconds)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-[#f1f5f9] last:border-0">
                  <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">{label}</span>
                  <span className="text-sm text-[#0f172a] font-medium">{value || '—'}</span>
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
                      <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">{t('calls.transcript')}</p>
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
