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
        <h2 className="text-xl font-bold text-[var(--th-text)]">{t('audit.title')}</h2>
        <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{t('audit.subtitle')}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button onClick={() => loadLogs()} className="mt-3 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 rounded-lg transition-colors">{t('common.retry')}</button>
        </div>
      )}

      <div className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow)]">
        {/* Filters */}
        <div className="px-5 py-4 border-b border-[var(--th-border)] flex items-center gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">{t('audit.action')}</label>
            <input
              type="text"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              placeholder={t('audit.filterByAction')}
              className="px-3 py-2 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] bg-[var(--th-input)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">{t('audit.from')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] bg-[var(--th-input)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">{t('audit.to')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] bg-[var(--th-input)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]"
            />
          </div>
          <div className="self-end">
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {t('calls.applyFilters')}
            </button>
          </div>
          <div className="ml-auto self-end text-xs text-[var(--th-text-muted)]">{total} {t('audit.totalEntries')}</div>
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
            <p className="text-sm text-[var(--th-text-secondary)] font-medium">{t('audit.noLogs')}</p>
            <p className="text-xs text-[var(--th-text-muted)] mt-1">{t('audit.noLogsHint')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-[var(--th-table-header)] border-b border-[var(--th-border)]">
                <tr>
                  {[t('audit.timestamp'), t('audit.userEmail'), t('audit.action'), t('audit.resourceType'), t('audit.resourceId'), t('audit.changes')].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--th-border-light)]">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-[var(--th-table-row-hover)] transition-colors">
                    <td className="px-5 py-3.5 text-xs text-[var(--th-text-muted)] whitespace-nowrap">{fmtDate(log.created_at)}</td>
                    <td className="px-5 py-3.5 text-sm text-[var(--th-text)]">{log.user_email ?? '\u2014'}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[var(--th-text-secondary)]">{log.resource_type}</td>
                    <td className="px-5 py-3.5 text-xs text-[var(--th-text-muted)] font-mono">{log.resource_id ? log.resource_id.slice(0, 8) + '...' : '\u2014'}</td>
                    <td className="px-5 py-3.5">
                      {log.changes && Object.keys(log.changes).length > 0 ? (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-xs text-[var(--th-primary-text)] hover:text-[var(--th-primary-hover)] font-medium"
                        >
                          {expandedId === log.id ? t('audit.hideChanges') : t('audit.showChanges')}
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--th-text-muted)]">\u2014</span>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Expanded JSON rows */}
                {logs.map(log => expandedId === log.id && log.changes && Object.keys(log.changes).length > 0 ? (
                  <tr key={`${log.id}-expanded`} className="bg-[var(--th-surface)]">
                    <td colSpan={6} className="px-5 py-3">
                      <pre className="text-xs text-[var(--th-text-secondary)] bg-[var(--th-card)] border border-[var(--th-border)] rounded-lg p-3 overflow-x-auto max-h-48">
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
            className="px-5 py-2.5 text-sm font-medium text-[var(--th-primary-text)] hover:bg-[var(--th-primary-bg)] border border-[var(--th-border)] rounded-xl transition-colors disabled:opacity-50"
          >
            {loadingMore ? t('common.loading') : `${t('calls.loadMore')} (${total - offset} ${t('calls.remaining')})`}
          </button>
        </div>
      )}
    </div>
  );
}
