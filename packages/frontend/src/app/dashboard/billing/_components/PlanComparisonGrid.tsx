'use client';
import { PLAN_FEATURES, PLAN_ACCENTS } from '../_lib/constants';

interface PlanComparisonGridProps {
  currentPlan: string;
  onSubscribe: (planId: string) => void;
  onDowngrade: (planId: string) => void;
  planPrices: Record<string, number>;
  t: (k: string) => string;
}

const PLANS = ['translator', 'agents', 'agents_mcp'] as const;

export function PlanComparisonGrid({ currentPlan, onSubscribe, onDowngrade, planPrices, t }: PlanComparisonGridProps) {
  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-4 md:p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
      <h3 className="text-sm font-semibold text-[var(--th-text)] mb-4">{t('billing.comparePlans')}</h3>
      <div className="snap-carousel md:grid md:grid-cols-3 gap-4">
        {PLANS.map(planId => {
          const isCurrent = currentPlan === planId;
          const isPopular = planId === 'agents';
          const price = planPrices[planId] ?? 0;
          const features = PLAN_FEATURES[planId];
          const accent = PLAN_ACCENTS[planId];
          const canUpgrade = !isCurrent && PLANS.indexOf(planId) > PLANS.indexOf(currentPlan as typeof PLANS[number]);
          const canDowngrade = !isCurrent && PLANS.indexOf(planId) < PLANS.indexOf(currentPlan as typeof PLANS[number]);

          return (
            <div
              key={planId}
              className={`relative rounded-2xl border p-4 md:p-5 transition-[border-color,box-shadow] min-w-[220px] md:min-w-0 ${
                isCurrent
                  ? 'border-[var(--th-primary)] shadow-[0_0_0_1px_var(--th-primary),0_4px_12px_var(--th-shadow-primary)]'
                  : 'border-[var(--th-border)] hover:border-[var(--th-border-hover)]'
              }`}
            >
              {/* Popular badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10px] uppercase font-bold tracking-wide rounded-full whitespace-nowrap">
                    {t('billing.mostPopular')}
                  </span>
                </div>
              )}

              {/* Plan name + price */}
              <div className="mb-4">
                <h4 className="text-base font-bold text-[var(--th-text)]">{t(`billing.plan.${planId}`)}</h4>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl md:text-3xl font-bold" style={{ color: accent }}>
                    ${price}
                  </span>
                  <span className="text-sm text-[var(--th-text-muted)]">
                    {price === 0 ? t('billing.depositOnly') : `/ ${t('billing.month')}`}
                  </span>
                </div>
                {price > 0 && (
                  <div className="text-[11px] font-medium text-[var(--th-success-text)] mt-1">
                    {t('billing.freeTrialDays')}
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="space-y-2 mb-5">
                {features.map(f => (
                  <div key={f.key} className="flex items-center gap-2">
                    {f.included ? (
                      <svg className="w-4 h-4 text-[var(--th-success-text)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-[var(--th-text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className={`text-[12px] ${f.included ? 'text-[var(--th-text-secondary)]' : 'text-[var(--th-text-muted)]'}`}>
                      {t(`billing.planFeature.${f.key}`)}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {isCurrent ? (
                <div className="w-full py-2.5 text-center text-sm font-semibold text-[var(--th-text-muted)] border border-[var(--th-border)] rounded-xl">
                  {t('billing.currentPlan')}
                </div>
              ) : canUpgrade ? (
                <button
                  onClick={() => onSubscribe(planId)}
                  className="w-full py-2.5 text-sm font-semibold text-white rounded-xl transition-[box-shadow,transform] shadow-[0_2px_8px_var(--th-shadow-primary)] hover:shadow-[0_4px_12px_var(--th-shadow-primary)]"
                  style={{ background: `linear-gradient(to right, ${accent}, ${accent}dd)` }}
                >
                  {t('billing.upgrade')}
                </button>
              ) : canDowngrade ? (
                <button
                  onClick={() => onDowngrade(planId)}
                  className="w-full py-2.5 text-sm font-medium rounded-xl border border-[var(--th-warning-border)] text-[var(--th-warning-text)] bg-[var(--th-warning-bg)] hover:opacity-80 transition-opacity"
                >
                  {planId === 'translator' ? t('billing.cancelAndDowngrade') : t('billing.downgrade')}
                </button>
              ) : (
                <div className="w-full py-2.5 text-center text-[12px] text-[var(--th-text-muted)]">
                  —
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
