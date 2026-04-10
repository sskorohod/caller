'use client';
import type { BillingInfo } from '../_lib/types';
import { PLAN_GRADIENTS, PLAN_ACCENTS } from '../_lib/constants';

interface PlanHeroCardProps {
  info: BillingInfo;
  onSubscribe: (planId: string) => void;
  onCancelClick: () => void;
  t: (k: string) => string;
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  active: { cls: 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]', label: 'billing.statusActive' },
  canceled: { cls: 'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]', label: 'billing.statusCanceled' },
  past_due: { cls: 'bg-[var(--th-error-bg)] text-[var(--th-error-text)]', label: 'billing.statusPastDue' },
  none: { cls: 'bg-[var(--th-surface)] text-[var(--th-text-muted)]', label: 'billing.statusFree' },
};

export function PlanHeroCard({ info, onSubscribe, onCancelClick, t }: PlanHeroCardProps) {
  const gradient = PLAN_GRADIENTS[info.plan] || PLAN_GRADIENTS.translator;
  const accent = PLAN_ACCENTS[info.plan] || PLAN_ACCENTS.translator;
  const badge = STATUS_BADGE[info.subscription_status] || STATUS_BADGE.none;

  const features = [
    { key: 'liveTranslator', on: info.features.liveTranslator },
    { key: 'aiAgents', on: info.features.aiAgents },
    { key: 'mcpAccess', on: info.features.mcpAccess },
  ];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[var(--th-card-border-subtle)] p-6 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]"
      style={{ background: gradient }}
    >
      {/* Glow */}
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-3xl"
        style={{ background: accent }}
      />

      <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        {/* Left: plan info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-2xl font-bold text-[var(--th-text)]">{info.plan_name}</h2>
            <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide ${badge.cls}`}>
              {t(badge.label)}
            </span>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {features.map(f => (
              <span
                key={f.key}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
                  f.on
                    ? 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]'
                    : 'bg-[var(--th-surface)] text-[var(--th-text-muted)]'
                }`}
              >
                {f.on ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                )}
                {t(`billing.feature.${f.key}`)}
              </span>
            ))}
          </div>

          {/* Limits */}
          {info.features.aiAgents && (
            <div className="flex gap-4 text-[11px] text-[var(--th-text-muted)]">
              <span>
                {t('billing.agentProfiles')}: {info.features.maxAgentProfiles === -1 ? '∞' : info.features.maxAgentProfiles}
              </span>
              <span>
                {t('billing.phoneNumbers')}: {info.features.maxTelephonyConnections === -1 ? '∞' : info.features.maxTelephonyConnections}
              </span>
            </div>
          )}
        </div>

        {/* Right: billing date + actions */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          {info.subscription_status === 'active' && info.subscription_current_period_end && (
            <div className="text-right">
              <div className="text-[11px] text-[var(--th-text-muted)]">{t('billing.nextBilling')}</div>
              <div className="text-sm font-semibold text-[var(--th-text)]">
                {new Date(info.subscription_current_period_end).toLocaleDateString()}
              </div>
            </div>
          )}

          {/* Upgrade buttons */}
          {info.plan !== 'agents_mcp' && (
            <div className="flex gap-2">
              {info.plan === 'translator' && (
                <button
                  onClick={() => onSubscribe('agents')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-xl shadow-[0_2px_8px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_12px_rgba(59,130,246,0.4)] transition-[box-shadow,transform]"
                >
                  {t('billing.upgradeAgents')}
                </button>
              )}
              <button
                onClick={() => onSubscribe('agents_mcp')}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-[0_2px_8px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_12px_rgba(139,92,246,0.4)] transition-[box-shadow,transform]"
              >
                {info.plan === 'translator' ? t('billing.upgradeAgentsMcp') : t('billing.upgradeMcp')}
              </button>
            </div>
          )}

          {/* Cancel link */}
          {info.subscription_status === 'active' && (
            <button
              onClick={onCancelClick}
              className="text-[11px] text-[var(--th-text-muted)] hover:text-[var(--th-error-text)] transition-colors"
            >
              {t('billing.cancelSubscription')}
            </button>
          )}

          {/* Canceled notice */}
          {info.subscription_status === 'canceled' && info.subscription_current_period_end && (
            <div className="text-[11px] text-[var(--th-warning-text)] bg-[var(--th-warning-bg)] px-3 py-1.5 rounded-lg">
              {t('billing.canceledNotice')} {new Date(info.subscription_current_period_end).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
