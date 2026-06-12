'use client';
import Link from 'next/link';
import type { HealthData } from '../_lib/types';

interface HealthRow {
  severity: 'warning' | 'error' | 'info';
  icon: string;
  text: string;
  detail?: string;
  href: string;
}

function buildRows(health: HealthData): HealthRow[] {
  const rows: HealthRow[] = [];

  if (health.low_balance.length > 0) {
    rows.push({
      severity: 'warning',
      icon: 'account_balance_wallet',
      text: `${health.low_balance.length} subscriber${health.low_balance.length > 1 ? 's' : ''} with low balance (≤ $2)`,
      detail: health.low_balance.slice(0, 3).map(w => `${w.owner_name || w.name} ($${w.balance_usd.toFixed(2)})`).join(', '),
      href: '/admin/workspaces',
    });
  }

  if (health.numbers_at_risk.length > 0) {
    rows.push({
      severity: 'error',
      icon: 'sim_card_alert',
      text: `${health.numbers_at_risk.length} personal number${health.numbers_at_risk.length > 1 ? 's' : ''} will be released — balance can't cover renewal`,
      detail: health.numbers_at_risk.slice(0, 3).map(n =>
        `${n.owner_name || n.workspace_name}: ${n.phone_number} (renews ${new Date(n.next_renewal_at).toLocaleDateString()})`).join(', '),
      href: '/admin/numbers',
    });
  }

  if (health.untranslated_7d.turns > 0) {
    rows.push({
      severity: 'warning',
      icon: 'translate',
      text: `${health.untranslated_7d.turns} untranslated turn${health.untranslated_7d.turns > 1 ? 's' : ''} in ${health.untranslated_7d.sessions} session${health.untranslated_7d.sessions > 1 ? 's' : ''} (7d) — Grok dropped output`,
      href: '/admin/sessions',
    });
  }

  const { failed, total } = health.failed_calls_7d;
  if (failed > 0) {
    rows.push({
      severity: failed / Math.max(total, 1) > 0.1 ? 'error' : 'warning',
      icon: 'call_missed',
      text: `${failed} failed call${failed > 1 ? 's' : ''} of ${total} (7d) — ${((failed / Math.max(total, 1)) * 100).toFixed(0)}%`,
      href: '/admin/sessions',
    });
  }

  if (health.open_tickets > 0) {
    rows.push({
      severity: 'info',
      icon: 'support_agent',
      text: `${health.open_tickets} open support ticket${health.open_tickets > 1 ? 's' : ''} awaiting reply`,
      href: '/admin/tickets',
    });
  }

  return rows;
}

const SEVERITY_STYLES = {
  error: { bg: 'var(--th-error-bg)', border: 'var(--th-error-border)', text: 'var(--th-error-text)' },
  warning: { bg: 'var(--th-warning-bg)', border: 'var(--th-warning-border)', text: 'var(--th-warning-text)' },
  info: { bg: 'var(--th-info-bg)', border: 'var(--th-info-border)', text: 'var(--th-info-text)' },
} as const;

export default function AdminHealthBlock({ health }: { health: HealthData }) {
  const rows = buildRows(health);

  return (
    <div
      className="rounded-xl p-4 md:p-5"
      style={{
        background: 'var(--th-card)',
        border: '1px solid var(--th-card-border-subtle)',
        boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
      }}
    >
      <h3 className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
        Health & alerts
      </h3>

      {rows.length === 0 ? (
        <div className="flex items-center gap-2 text-xs py-2" style={{ color: 'var(--th-success-text)' }}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          All clear — no balance, number, quality or support alerts.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const s = SEVERITY_STYLES[row.severity];
            return (
              <Link
                key={i}
                href={row.href}
                className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 transition-opacity hover:opacity-80"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}
              >
                <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0" style={{ color: s.text }}>{row.icon}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium" style={{ color: s.text }}>{row.text}</span>
                  {row.detail && (
                    <span className="block text-[11px] mt-0.5 truncate" style={{ color: 'var(--th-text-secondary)' }}>{row.detail}</span>
                  )}
                </span>
                <span className="material-symbols-outlined text-[14px] ml-auto mt-0.5 shrink-0" style={{ color: s.text }}>chevron_right</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
