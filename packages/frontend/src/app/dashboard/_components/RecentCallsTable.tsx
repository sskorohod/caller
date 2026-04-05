'use client';
import Link from 'next/link';
import type { RecentCall } from '../_lib/types';
import { fmtDuration, fmtDate, fmtCost, fmtPhone } from '../_lib/utils';
import { STATUS_COLORS, STATUS_LABELS } from '../_lib/constants';
import { IconPhone } from '../_lib/icons';

interface RecentCallsTableProps {
  calls: RecentCall[];
  t: (k: string) => string;
}

export function RecentCallsTable({ calls, t }: RecentCallsTableProps) {
  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
      <div className="px-5 py-3.5 border-b border-[var(--th-border)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('dashboard.recentCalls')}</h3>
        <Link href="/dashboard/calls" className="text-[11px] text-[var(--th-primary-text)] hover:text-[var(--th-primary-hover)] font-semibold transition-colors flex items-center gap-1">
          {t('dashboard.viewAll')}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        </Link>
      </div>
      {calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-12 h-12 bg-[var(--th-surface)] rounded-2xl flex items-center justify-center mb-3 text-[var(--th-text-muted)]">
            <IconPhone />
          </div>
          <p className="text-sm font-medium text-[var(--th-text-secondary)]">{t('dashboard.noCalls')}</p>
          <p className="text-[11px] text-[var(--th-text-muted)] mt-1 max-w-xs text-center">{t('dashboard.noCallsDesc')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--th-border)]">
                {[t('dashboard.phoneNumber'), t('dashboard.direction'), t('dashboard.status'), t('dashboard.duration'), t('dashboard.cost'), t('dashboard.date')].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider bg-[var(--th-surface)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map((call, idx) => (
                <tr key={call.id} className={`transition-colors hover:bg-[var(--th-surface)] ${idx < calls.length - 1 ? 'border-b border-[var(--th-border-light)]' : ''}`}>
                  <td className="px-5 py-3 text-sm font-medium text-[var(--th-text)] tabular-nums">{fmtPhone(call.direction === 'outbound' ? call.phone_number_to : call.phone_number_from)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-semibold ${
                      call.direction === 'outbound'
                        ? 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]'
                        : 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]'
                    }`}>
                      {call.direction === 'outbound' ? '\u2191 Out' : '\u2193 In'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex text-[10px] px-2.5 py-1 rounded-full font-semibold ${STATUS_COLORS[call.status] ?? STATUS_COLORS.cancelled}`}>
                      {STATUS_LABELS[call.status] ?? call.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--th-text-secondary)] tabular-nums font-medium">{fmtDuration(call.duration_seconds)}</td>
                  <td className="px-5 py-3 text-sm text-[var(--th-text-secondary)] tabular-nums font-medium">{call.cost_total ? fmtCost(parseFloat(call.cost_total)) : '$0.00'}</td>
                  <td className="px-5 py-3 text-[13px] text-[var(--th-text-muted)]">{fmtDate(call.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
