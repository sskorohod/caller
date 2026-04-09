'use client';
import { LOW_BALANCE_WARNING, LOW_BALANCE_CRITICAL } from '../_lib/constants';

interface LowBalanceBannerProps {
  balance: number;
  onQuickDeposit: (amount: number) => void;
  t: (k: string) => string;
}

export function LowBalanceBanner({ balance, onQuickDeposit, t }: LowBalanceBannerProps) {
  if (balance >= LOW_BALANCE_WARNING) return null;

  const isCritical = balance < LOW_BALANCE_CRITICAL;
  const bgClass = isCritical
    ? 'bg-[var(--th-error-bg)] border-[var(--th-error-border)]'
    : 'bg-[var(--th-warning-bg)] border-[var(--th-warning-border)]';
  const textClass = isCritical ? 'text-[var(--th-error-text)]' : 'text-[var(--th-warning-text)]';
  const iconColor = isCritical ? 'var(--th-error-icon)' : 'var(--th-warning-icon)';

  return (
    <div className={`${bgClass} border rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4`}>
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 shrink-0" style={{ color: iconColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div>
          <span className={`text-sm font-semibold ${textClass}`}>
            {isCritical ? t('billing.balanceCritical') : t('billing.balanceLow')}
          </span>
          <span className={`text-sm ${textClass} opacity-80 ml-1`}>
            ${balance.toFixed(2)} — {t('billing.topUpToAvoidInterruptions')}
          </span>
        </div>
      </div>
      <button
        onClick={() => onQuickDeposit(25)}
        className={`shrink-0 text-xs font-semibold px-4 py-2 rounded-xl transition-all ${
          isCritical
            ? 'bg-[var(--th-error-text)] text-white hover:opacity-90'
            : 'bg-[var(--th-warning-text)] text-white hover:opacity-90'
        }`}
      >
        + $25
      </button>
    </div>
  );
}
