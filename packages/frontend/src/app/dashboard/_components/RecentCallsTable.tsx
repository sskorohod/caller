'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RecentCall, Agent } from '../_lib/types';
import { fmtDuration, fmtDate, fmtCost, fmtPhone } from '../_lib/utils';
import { STATUS_COLORS } from '../_lib/constants';

// ─── Utilities ──────────────────────────────────────────────────────────────

function fmtDateShort(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed', failed: 'Failed', in_progress: 'In Progress',
  initiated: 'Initiated', ringing: 'Ringing', cancelled: 'Cancelled',
  canceled: 'Cancelled', no_answer: 'No Answer',
};

// ─── Phone Icon SVG ─────────────────────────────────────────────────────────

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

// ─── Desktop Call Row ───────────────────────────────────────────────────────

function CallRow({ call, agentMap, onClick }: { call: RecentCall; agentMap: Map<string, string>; onClick: () => void }) {
  const phone = fmtPhone(call.direction === 'outbound' ? (call.phone_number_to || call.to_number) : (call.phone_number_from || call.from_number));
  const agentName = call.agent_profile_id ? agentMap.get(call.agent_profile_id) : null;

  return (
    <tr
      className="hover:bg-[var(--th-surface)] transition-colors cursor-pointer group"
      onClick={onClick}
    >
      {/* Phone + Agent */}
      <td className="px-3 md:px-5 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            call.status === 'in_progress' ? 'bg-[var(--th-info-bg)]' :
            call.status === 'completed' ? 'bg-[var(--th-success-bg)]' :
            call.status === 'failed' ? 'bg-[var(--th-error-bg)]' :
            'bg-[var(--th-surface)]'
          }`}>
            <PhoneIcon className={`w-3.5 h-3.5 ${
              call.status === 'in_progress' ? 'text-[var(--th-info-text)] animate-pulse' :
              call.status === 'completed' ? 'text-[var(--th-success-text)]' :
              call.status === 'failed' ? 'text-[var(--th-error-text)]' :
              'text-[var(--th-text-muted)]'
            }`} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--th-text)] truncate">{phone}</div>
            {agentName && <div className="text-[11px] text-[var(--th-text-muted)] truncate">{agentName}</div>}
          </div>
        </div>
      </td>

      {/* Direction */}
      <td className="px-3 md:px-5 py-3">
        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
          call.direction === 'outbound'
            ? 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]'
            : 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]'
        }`}>
          {call.direction === 'outbound' ? '↑ Out' : '↓ In'}
        </span>
      </td>

      {/* Status */}
      <td className="px-3 md:px-5 py-3">
        <span className={`inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[call.status] ?? STATUS_COLORS.cancelled}`}>
          {STATUS_LABELS[call.status] ?? call.status}
        </span>
      </td>

      {/* Duration + Cost */}
      <td className="px-3 md:px-5 py-3 text-sm tabular-nums text-[var(--th-text-secondary)] hidden md:table-cell">
        <div className="font-medium">{fmtDuration(call.duration_seconds)}</div>
        {call.cost_total && Number(call.cost_total) > 0 && (
          <div className="text-[10px] text-amber-600 dark:text-amber-400">{fmtCost(Number(call.cost_total))}</div>
        )}
      </td>

      {/* Summary */}
      <td className="px-3 md:px-5 py-3 max-w-[220px] hidden lg:table-cell">
        {call.summary ? (
          <p className="text-[11px] text-[var(--th-text-muted)] leading-snug line-clamp-1">{call.summary}</p>
        ) : (
          <span className="text-[11px] text-[var(--th-text-muted)]">—</span>
        )}
      </td>

      {/* Date */}
      <td className="px-3 md:px-5 py-3 text-sm text-[var(--th-text-muted)] whitespace-nowrap">{fmtDateShort(call.created_at)}</td>

      {/* Arrow */}
      <td className="pr-4 py-3">
        <svg className="w-4 h-4 text-[var(--th-text-muted)] group-hover:text-[var(--th-primary-text)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </td>
    </tr>
  );
}

// ─── Mobile Call Card ───────────────────────────────────────────────────────

function MobileCallCard({ call, agentMap, onClick }: { call: RecentCall; agentMap: Map<string, string>; onClick: () => void }) {
  const phone = fmtPhone(call.direction === 'outbound' ? (call.phone_number_to || call.to_number) : (call.phone_number_from || call.from_number));
  const agentName = call.agent_profile_id ? agentMap.get(call.agent_profile_id) : null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--th-surface)] transition-colors cursor-pointer border-b border-[var(--th-border-light)] last:border-b-0"
      onClick={onClick}
    >
      {/* Status icon */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
        call.status === 'in_progress' ? 'bg-[var(--th-info-bg)]' :
        call.status === 'completed' ? 'bg-[var(--th-success-bg)]' :
        call.status === 'failed' ? 'bg-[var(--th-error-bg)]' :
        'bg-[var(--th-surface)]'
      }`}>
        <PhoneIcon className={`w-4 h-4 ${
          call.status === 'in_progress' ? 'text-[var(--th-info-text)] animate-pulse' :
          call.status === 'completed' ? 'text-[var(--th-success-text)]' :
          call.status === 'failed' ? 'text-[var(--th-error-text)]' :
          'text-[var(--th-text-muted)]'
        }`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--th-text)] truncate">{phone}</span>
          <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            call.direction === 'outbound'
              ? 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]'
              : 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]'
          }`}>
            {call.direction === 'outbound' ? '↑' : '↓'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[call.status] ?? STATUS_COLORS.cancelled}`}>
            {STATUS_LABELS[call.status] ?? call.status}
          </span>
          <span className="text-[11px] text-[var(--th-text-muted)] tabular-nums">{fmtDuration(call.duration_seconds)}</span>
          {call.cost_total && Number(call.cost_total) > 0 && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 tabular-nums">{fmtCost(Number(call.cost_total))}</span>
          )}
        </div>
        {agentName && <div className="text-[11px] text-[var(--th-text-muted)] truncate mt-0.5">{agentName}</div>}
        {call.summary && <p className="text-[11px] text-[var(--th-text-muted)] line-clamp-1 mt-0.5">{call.summary}</p>}
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[11px] text-[var(--th-text-muted)]">{fmtDateShort(call.created_at)}</span>
        <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ t }: { t: (k: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="w-12 h-12 bg-[var(--th-surface)] rounded-2xl flex items-center justify-center mb-3 text-[var(--th-text-muted)]">
        <PhoneIcon className="w-5 h-5" />
      </div>
      <p className="text-sm font-medium text-[var(--th-text-secondary)]">{t('dashboard.noCalls')}</p>
      <p className="text-[11px] text-[var(--th-text-muted)] mt-1 max-w-xs text-center">{t('dashboard.noCallsDesc')}</p>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface RecentCallsTableProps {
  calls: RecentCall[];
  agents?: Agent[];
  t: (k: string) => string;
}

export function RecentCallsTable({ calls, agents, t }: RecentCallsTableProps) {
  const router = useRouter();
  const agentMap = new Map((agents ?? []).map(a => [a.id, a.name]));

  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--th-border)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('dashboard.recentCalls')}</h3>
        <Link href="/dashboard/calls" className="text-[11px] text-[var(--th-primary-text)] hover:text-[var(--th-primary-hover)] font-semibold transition-colors flex items-center gap-1">
          {t('dashboard.viewAll')}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        </Link>
      </div>

      {calls.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--th-border)]">
                  <th className="px-3 md:px-5 py-2.5 text-left text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider bg-[var(--th-surface)]">{t('dashboard.phoneNumber')}</th>
                  <th className="px-3 md:px-5 py-2.5 text-left text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider bg-[var(--th-surface)]">{t('dashboard.direction')}</th>
                  <th className="px-3 md:px-5 py-2.5 text-left text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider bg-[var(--th-surface)]">{t('dashboard.status')}</th>
                  <th className="px-3 md:px-5 py-2.5 text-left text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider bg-[var(--th-surface)] hidden md:table-cell">{t('dashboard.duration')}</th>
                  <th className="px-3 md:px-5 py-2.5 text-left text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider bg-[var(--th-surface)] hidden lg:table-cell">Summary</th>
                  <th className="px-3 md:px-5 py-2.5 text-left text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider bg-[var(--th-surface)]">{t('dashboard.date')}</th>
                  <th className="w-8 bg-[var(--th-surface)]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--th-border-light)]">
                {calls.map(call => (
                  <CallRow
                    key={call.id}
                    call={call}
                    agentMap={agentMap}
                    onClick={() => router.push(`/dashboard/calls?id=${call.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden">
            {calls.map(call => (
              <MobileCallCard
                key={call.id}
                call={call}
                agentMap={agentMap}
                onClick={() => router.push(`/dashboard/calls?id=${call.id}`)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
