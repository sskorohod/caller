'use client';
import type { BillingInfo } from '../_lib/types';

interface SubscriptionManagerProps {
  info: BillingInfo;
  cancelConfirm: boolean;
  setCancelConfirm: (v: boolean) => void;
  onCancel: () => void;
  t: (k: string) => string;
}

export function SubscriptionManager({ info, cancelConfirm, setCancelConfirm, onCancel, t }: SubscriptionManagerProps) {
  if (info.subscription_status !== 'active' && info.subscription_status !== 'canceled' && info.subscription_status !== 'trialing') return null;

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

        {(info.subscription_status === 'active' || info.subscription_status === 'trialing') && !cancelConfirm && (
          <button
            onClick={() => setCancelConfirm(true)}
            className="text-[12px] text-[var(--th-text-muted)] hover:text-[var(--th-error-text)] transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--th-error-bg)]"
          >
            {t('billing.cancelSubscription')}
          </button>
        )}
      </div>

      {/* Inline cancel confirmation */}
      {cancelConfirm && (
        <div className="mt-4 p-4 rounded-xl bg-[var(--th-error-bg)] border border-[var(--th-error-border)]">
          <p className="text-sm text-[var(--th-error-text)] font-medium mb-3">
            {t('billing.cancelConfirmMessage')}
          </p>
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
