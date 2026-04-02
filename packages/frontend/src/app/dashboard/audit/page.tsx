'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  changes: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

const LIMIT = 50;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AuditPage() {
  const t = useT();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function buildQs(loadOffset = 0) {
    const params = new URLSearchParams();
    params.set('limit', String(LIMIT));
    params.set('offset', String(loadOffset));
    if (actionFilter) params.set('action', actionFilter);
    if (dateFrom) params.set('from', new Date(dateFrom).toISOString());
    if (dateTo) params.set('to', new Date(dateTo + 'T23:59:59').toISOString());
    return params.toString();
  }

  function loadLogs(loadOffset = 0) {
    setError('');
    const isMore = loadOffset > 0;
    if (isMore) setLoadingMore(true); else setLoading(true);

    api.get<{ logs: AuditLog[]; total: number }>(`/audit-logs?${buildQs(loadOffset)}`)
      .then(r => {
        const newLogs = r?.logs ?? [];
        setLogs(prev => isMore ? [...prev, ...newLogs] : newLogs);
        setTotal(r?.total ?? 0);
        setOffset(loadOffset + newLogs.length);
      })
      .catch((err: any) => setError(err?.message ?? 'Failed to load audit logs'))
      .finally(() => { setLoading(false); setLoadingMore(false); });
  }

  useEffect(() => { loadLogs(); }, []);

  function applyFilters() {
    setOffset(0);
    loadLogs(0);
  }

  // Collect unique actions for dropdown
  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-[#0f172a]">{t('audit.title')}</h2>
        <p className="text-sm text-[#94a3b8] mt-0.5">{t('audit.subtitle')}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button onClick={() => loadLogs()} className="mt-3 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 rounded-lg transition-colors">{t('common.retry')}</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        {/* Filters */}
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wide">{t('audit.action')}</label>
            <input
              type="text"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              placeholder={t('audit.filterByAction')}
              className="px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wide">{t('audit.from')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wide">{t('audit.to')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
            />
          </div>
          <div className="self-end">
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {t('calls.applyFilters')}
            </button>
          </div>
          <div className="ml-auto self-end text-xs text-[#94a3b8]">{total} {t('audit.totalEntries')}</div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-32 h-3.5 bg-slate-100 rounded" />
                <div className="w-24 h-3.5 bg-slate-100 rounded" />
                <div className="w-20 h-3.5 bg-slate-100 rounded" />
                <div className="w-24 h-3.5 bg-slate-100 rounded" />
                <div className="w-16 h-3.5 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <p className="text-sm text-[#475569] font-medium">{t('audit.noLogs')}</p>
            <p className="text-xs text-[#94a3b8] mt-1">{t('audit.noLogsHint')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <tr>
                  {[t('audit.timestamp'), t('audit.userEmail'), t('audit.action'), t('audit.resourceType'), t('audit.resourceId'), t('audit.changes')].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-5 py-3.5 text-xs text-[#94a3b8] whitespace-nowrap">{fmtDate(log.created_at)}</td>
                    <td className="px-5 py-3.5 text-sm text-[#0f172a]">{log.user_email ?? '\u2014'}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#eef2ff] text-[#6366f1]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#475569]">{log.resource_type}</td>
                    <td className="px-5 py-3.5 text-xs text-[#94a3b8] font-mono">{log.resource_id ? log.resource_id.slice(0, 8) + '...' : '\u2014'}</td>
                    <td className="px-5 py-3.5">
                      {log.changes && Object.keys(log.changes).length > 0 ? (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-xs text-[#6366f1] hover:text-[#4f46e5] font-medium"
                        >
                          {expandedId === log.id ? t('audit.hideChanges') : t('audit.showChanges')}
                        </button>
                      ) : (
                        <span className="text-xs text-[#94a3b8]">\u2014</span>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Expanded JSON rows */}
                {logs.map(log => expandedId === log.id && log.changes && Object.keys(log.changes).length > 0 ? (
                  <tr key={`${log.id}-expanded`} className="bg-[#f8fafc]">
                    <td colSpan={6} className="px-5 py-3">
                      <pre className="text-xs text-[#475569] bg-white border border-[#e2e8f0] rounded-lg p-3 overflow-x-auto max-h-48">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ) : null)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Load More */}
      {!loading && offset < total && (
        <div className="flex justify-center">
          <button
            onClick={() => loadLogs(offset)}
            disabled={loadingMore}
            className="px-5 py-2.5 text-sm font-medium text-[#6366f1] hover:bg-[#eef2ff] border border-[#e2e8f0] rounded-xl transition-colors disabled:opacity-50"
          >
            {loadingMore ? t('common.loading') : `${t('calls.loadMore')} (${total - offset} ${t('calls.remaining')})`}
          </button>
        </div>
      )}
    </div>
  );
}
