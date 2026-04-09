'use client';
import { useState, useMemo } from 'react';
import type { Transaction, TransactionFilter } from '../_lib/types';
import { TX_TYPE_COLORS } from '../_lib/constants';

interface TransactionHistoryProps {
  transactions: Transaction[];
  t: (k: string) => string;
}

const FILTERS: { key: TransactionFilter; label: string }[] = [
  { key: 'all', label: 'billing.filterAll' },
  { key: 'topup', label: 'billing.filterDeposits' },
  { key: 'usage', label: 'billing.filterUsage' },
  { key: 'refund', label: 'billing.filterRefunds' },
  { key: 'gift', label: 'billing.filterGifts' },
];

const PAGE_SIZE = 20;

export function TransactionHistory({ transactions, t }: TransactionHistoryProps) {
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter(tx => tx.type === filter);
  }, [transactions, filter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
      {/* Header + Filters */}
      <div className="px-5 py-3.5 border-b border-[var(--th-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('billing.transactionHistory')}</h3>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setVisibleCount(PAGE_SIZE); }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                filter === f.key
                  ? 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]'
                  : 'text-[var(--th-text-muted)] hover:bg-[var(--th-surface)]'
              }`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-12 h-12 bg-[var(--th-surface)] rounded-2xl flex items-center justify-center mb-3 text-[var(--th-text-muted)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--th-text-secondary)]">{t('billing.noTransactions')}</p>
          <p className="text-[11px] text-[var(--th-text-muted)] mt-1">{t('billing.noTransactionsDesc')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--th-border)]">
                {[t('billing.colDate'), t('billing.colType'), t('billing.colDescription'), t('billing.colAmount'), t('billing.colBalance')].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider bg-[var(--th-surface)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((tx, idx) => (
                <tr key={tx.id} className={`transition-colors hover:bg-[var(--th-surface)] ${idx < visible.length - 1 ? 'border-b border-[var(--th-border-light)]' : ''}`}>
                  <td className="px-5 py-3 text-[13px] text-[var(--th-text-muted)] whitespace-nowrap">
                    {new Date(tx.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase ${TX_TYPE_COLORS[tx.type] ?? 'bg-[var(--th-surface)] text-[var(--th-text-muted)]'}`}>
                      {t(`billing.txType.${tx.type}`)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--th-text-secondary)] max-w-[200px] truncate">
                    {tx.description || tx.type}
                  </td>
                  <td className="px-5 py-3 text-sm font-mono font-bold tabular-nums whitespace-nowrap" style={{ color: tx.amount_usd >= 0 ? '#10b981' : '#ef4444' }}>
                    {tx.amount_usd >= 0 ? '+' : ''}{tx.amount_usd.toFixed(4)}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[var(--th-text-muted)] font-mono tabular-nums">
                    ${tx.balance_after.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="px-5 py-3 border-t border-[var(--th-border)] text-center">
          <button
            onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
            className="text-[12px] font-semibold text-[var(--th-primary-text)] hover:text-[var(--th-primary-hover)] transition-colors"
          >
            {t('billing.loadMore')} ({filtered.length - visibleCount} {t('billing.remaining')})
          </button>
        </div>
      )}
    </div>
  );
}
