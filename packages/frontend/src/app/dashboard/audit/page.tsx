'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useIsMobile } from '@/lib/useBreakpoint';

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
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Pull-to-refresh
  const pullRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!pullRef.current || pullRef.current.scrollTop > 0) return;
    pullStartY.current = e.touches[0].clientY;
    pulling.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy > 0 && dy < 120) setPullDistance(dy);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 60 && !refreshing) {
      setRefreshing(true);
      loadLogs(0);
      setTimeout(() => setRefreshing(false), 500);
    }
    pulling.current = false;
    setPullDistance(0);
  }, [pullDistance, refreshing]);

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
    <div
      className="space-y-5"
      ref={pullRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div className="flex justify-center py-2 md:hidden" style={{ opacity: Math.min(pullDistance / 60, 1) }}>
          <svg className={`w-5 h-5 text-[var(--th-primary-text)] ${pullDistance > 60 ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
        </div>
      )}

      <div>
        <h2 className="text-lg sm:text-xl font-bold text-[var(--th-text)]">{t('audit.title')}</h2>
        <p className="text-xs sm:text-sm text-[var(--th-text-muted)] mt-0.5">{t('audit.subtitle')}</p>
      </div>

      {error && (
        <div className="bg-[var(--th-error-bg)] border border-[var(--th-card-border-subtle)] rounded-2xl p-6 text-center shadow-[0_1px_3px_var(--th-shadow)]">
          <p className="text-sm font-semibold text-[var(--th-error-text)]">{error}</p>
          <button onClick={() => loadLogs()} className="mt-3 px-4 py-2 text-sm font-semibold text-[var(--th-error-text)] hover:bg-[var(--th-surface)] rounded-xl transition-all">{t('common.retry')}</button>
        </div>
      )}

      <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
        {/* Filters */}
        <div className="px-5 py-4 border-b border-[var(--th-card-border-subtle)] flex items-center gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{t('audit.action')}</label>
            <input
              type="text"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              placeholder={t('audit.filterByAction')}
              className="px-3.5 py-2 rounded-xl border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] bg-[var(--th-card)] transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{t('audit.from')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] bg-[var(--th-card)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{t('audit.to')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] bg-[var(--th-card)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
            />
          </div>
          <div className="self-end">
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-sm font-semibold rounded-xl transition-all"
            >
              {t('calls.applyFilters')}
            </button>
          </div>
          <div className="ml-auto self-end">
            <span className="text-[11px] text-[var(--th-text-muted)] bg-[var(--th-surface)] px-2.5 py-1 rounded-lg font-medium">{total} {t('audit.totalEntries')}</span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-32 h-3.5 bg-[var(--th-skeleton)] rounded-lg" />
                <div className="w-24 h-3.5 bg-[var(--th-skeleton)] rounded-lg" />
                <div className="w-20 h-3.5 bg-[var(--th-skeleton)] rounded-lg" />
                <div className="w-24 h-3.5 bg-[var(--th-skeleton)] rounded-lg" />
                <div className="w-16 h-3.5 bg-[var(--th-skeleton)] rounded-lg" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 bg-[var(--th-surface)] rounded-2xl flex items-center justify-center text-[var(--th-text-muted)]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
            </div>
            <p className="text-sm text-[var(--th-text-secondary)] font-medium">{t('audit.noLogs')}</p>
            <p className="text-[11px] text-[var(--th-text-muted)]">{t('audit.noLogsHint')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--th-card-border-subtle)]">
                  {[t('audit.timestamp'), t('audit.userEmail'), t('audit.action'), t('audit.resourceType'), t('audit.resourceId'), t('audit.changes')].map(h => (
                    <th key={h} className="px-3 md:px-5 py-2.5 text-left text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider bg-[var(--th-surface)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log.id} className={`hover:bg-[var(--th-surface)] transition-colors ${idx < logs.length - 1 ? 'border-b border-[var(--th-card-border-subtle)]' : ''}`}>
                    <td className="px-3 md:px-5 py-3 text-[13px] text-[var(--th-text-muted)] whitespace-nowrap tabular-nums">{fmtDate(log.created_at)}</td>
                    <td className="px-3 md:px-5 py-3 text-sm text-[var(--th-text)] font-medium">{log.user_email ?? '\u2014'}</td>
                    <td className="px-3 md:px-5 py-3">
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 md:px-5 py-3 text-sm text-[var(--th-text-secondary)]">{log.resource_type}</td>
                    <td className="px-3 md:px-5 py-3 text-xs text-[var(--th-text-muted)] font-mono tabular-nums">{log.resource_id ? log.resource_id.slice(0, 8) + '...' : '\u2014'}</td>
                    <td className="px-3 md:px-5 py-3">
                      {log.changes && Object.keys(log.changes).length > 0 ? (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-[10px] text-[var(--th-primary-text)] hover:text-[var(--th-primary-hover)] font-semibold flex items-center gap-1 transition-colors"
                        >
                          {expandedId === log.id ? t('audit.hideChanges') : t('audit.showChanges')}
                          <svg className={`w-3 h-3 transition-transform duration-200 ${expandedId === log.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
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
                    <td colSpan={6} className="px-3 md:px-5 py-3">
                      <pre className="text-xs text-[var(--th-text-secondary)] bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] rounded-xl p-4 overflow-x-auto max-h-48 font-mono leading-relaxed">
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
            className="px-5 py-2.5 text-sm font-semibold text-[var(--th-primary-text)] hover:bg-[var(--th-primary-bg)] border border-[var(--th-card-border-subtle)] rounded-xl transition-all disabled:opacity-40"
          >
            {loadingMore ? t('common.loading') : `${t('calls.loadMore')} (${total - offset} ${t('calls.remaining')})`}
          </button>
        </div>
      )}
    </div>
  );
}
