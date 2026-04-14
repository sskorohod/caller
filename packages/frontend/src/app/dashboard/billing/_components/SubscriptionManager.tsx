'use client';
import type { BillingInfo } from '../_lib/types';
import { PLAN_FEATURES } from '../_lib/constants';

interface SubscriptionManagerProps {
  info: BillingInfo;
  cancelConfirm: boolean;
  setCancelConfirm: (v: boolean) => void;
  onCancel: () => void;
  onReactivate: () => void;
  t: (k: string) => string;
}

export function SubscriptionManager({ info, cancelConfirm, setCancelConfirm, onCancel, onReactivate, t }: SubscriptionManagerProps) {
  if (info.subscription_status !== 'active' && info.subscription_status !== 'canceled' && info.subscription_status !== 'trialing') return null;

  // Features that will be lost when canceling to translator
  const currentFeatures = PLAN_FEATURES[info.plan] || [];
  const translatorFeatures = PLAN_FEATURES['translator'] || [];
  const translatorKeys = new Set(translatorFeatures.filter(f => f.included).map(f => f.key));
  const lostFeatures = currentFeatures.filter(f => f.included && !translatorKeys.has(f.key));

  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('billing.subscriptionManagement')}</h3>
          <p className="text-[11px] text-[var(--th-text-muted)] mt-0.5">
            {info.subscription_status === 'trialing'
              ? `${t('billing.trialUntil')} ${info.subscription_current_period_end ? new Date(info.subscription_current_period_end).toLocaleDateString() : ''}`
              : info.subscription_status === 'active'
              ? `${t('billing.activeUntil')} ${info.subscription_current_period_end ? new Date(info.subscription_current_period_end).toLocaleDateString() : ''}`
              : `${t('billing.canceledActiveUntil')} ${info.subscription_current_period_end ? new Date(info.subscription_current_period_end).toLocaleDateString() : ''}`
            }
          </p>
        </div>

        {info.subscription_status === 'canceled' ? (
          <button
            onClick={onReactivate}
            className="text-[12px] font-semibold text-[var(--th-success-text)] hover:text-[var(--th-success-text)] transition-colors px-3 py-1.5 rounded-lg bg-[var(--th-success-bg)] hover:opacity-80"
          >
            {t('billing.reactivateSubscription')}
          </button>
        ) : (info.subscription_status === 'active' || info.subscription_status === 'trialing') && !cancelConfirm ? (
          <button
            onClick={() => setCancelConfirm(true)}
            className="text-[12px] text-[var(--th-text-muted)] hover:text-[var(--th-error-text)] transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--th-error-bg)]"
          >
            {t('billing.cancelSubscription')}
          </button>
        ) : null}
      </div>

      {/* Reactivation message for canceled subs */}
      {info.subscription_status === 'canceled' && (
        <div className="mt-3 p-3 rounded-xl bg-[var(--th-info-bg)] border border-[var(--th-info-border)]">
          <p className="text-[12px] text-[var(--th-info-text)]">
            {t('billing.reactivateMessage')}
          </p>
        </div>
      )}

      {/* Inline cancel confirmation with feature loss */}
      {cancelConfirm && (
        <div className="mt-4 p-4 rounded-xl bg-[var(--th-error-bg)] border border-[var(--th-error-border)]">
          <p className="text-sm text-[var(--th-error-text)] font-medium mb-2">
            {t('billing.cancelConfirmMessage')}
          </p>

          {lostFeatures.length > 0 && (
            <div className="mb-3">
              <p className="text-[12px] font-semibold text-[var(--th-error-text)] mb-1.5">
                {t('billing.cancelWhatYouLose')}
              </p>
              <ul className="space-y-1">
                {lostFeatures.map(f => (
                  <li key={f.key} className="flex items-center gap-1.5 text-[12px] text-[var(--th-error-text)]">
                    <span className="material-symbols-outlined text-[14px]">remove_circle</span>
                    {t(`billing.planFeature.${f.key}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-[var(--th-error-text)] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              {t('billing.confirmCancel')}
            </button>
            <button
              onClick={() => setCancelConfirm(false)}
              className="px-4 py-2 border border-[var(--th-border)] text-sm font-medium text-[var(--th-text-secondary)] rounded-xl hover:bg-[var(--th-surface)] transition-colors"
            >
              {t('billing.keepSubscription')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
