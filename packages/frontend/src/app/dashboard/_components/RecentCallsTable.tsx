'use client';
import Link from 'next/link';
import type { RecentCall } from '../_lib/types';
import { fmtDuration, fmtDate } from '../_lib/utils';
import { STATUS_COLORS, STATUS_LABELS } from '../_lib/constants';
import { IconPhone } from '../_lib/icons';

interface RecentCallsTableProps {
  calls: RecentCall[];
  t: (k: string) => string;
}

export function RecentCallsTable({ calls, t }: RecentCallsTableProps) {
  return (
    <div className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] overflow-hidden shadow-[0_2px_8px_var(--th-shadow)]">
      <div className="px-5 py-3 border-b border-[var(--th-border)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('dashboard.recentCalls')}</h3>
        <Link href="/dashboard/calls" className="text-[11px] text-[var(--th-primary-text)] hover:text-[var(--th-primary-hover)] font-medium transition-colors">
          {t('dashboard.viewAll')} &rarr;
        </Link>
      </div>
      {calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-10 h-10 bg-[var(--th-surface)] rounded-xl flex items-center justify-center mb-2.5">
            <IconPhone />
          </div>
          <p className="text-sm font-medium text-[var(--th-text-secondary)]">{t('dashboard.noCalls')}</p>
          <p className="text-[11px] text-[var(--th-text-muted)] mt-1 max-w-xs text-center">{t('dashboard.noCallsDesc')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--th-table-header)] border-b border-[var(--th-border)]">
              <tr>
                {[t('dashboard.phoneNumber'), t('dashboard.direction'), t('dashboard.status'), t('dashboard.duration'), t('dashboard.date')].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--th-border-light)]">
              {calls.map(call => (
                <tr key={call.id} className="hover:bg-[var(--th-table-row-hover)] transition-colors">
                  <td className="px-4 py-2.5 text-sm font-medium text-[var(--th-text)]">
                    {call.direction === 'outbound' ? call.phone_number_to : call.phone_number_from}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      call.direction === 'outbound'
                        ? 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]'
                        : 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]'
                    }`}>
                      {call.direction === 'outbound' ? '\u2191 Out' : '\u2193 In'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[call.status] ?? STATUS_COLORS.cancelled}`}>
                      {STATUS_LABELS[call.status] ?? call.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] tabular-nums">{fmtDuration(call.duration_seconds)}</td>
                  <td className="px-4 py-2.5 text-sm text-[var(--th-text-muted)]">{fmtDate(call.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
