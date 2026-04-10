'use client';
import { useState } from 'react';
import { DEPOSIT_PRESETS } from '../_lib/constants';

function fmtBal(balance: number, plan: string, lang: string): string {
  if (balance > 10000) return lang === 'ru' ? 'Безлимит' : 'Unlimited';
  return `$${balance.toFixed(2)}`;
}

interface DepositSectionProps {
  balance: number;
  plan: string;
  lang: string;
  onTopUp: (amount: number) => void;
  loading: boolean;
  t: (k: string) => string;
}

export function DepositSection({ balance, plan, lang, onTopUp, loading, t }: DepositSectionProps) {
  const [amount, setAmount] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  const handlePreset = (val: number) => {
    setSelectedPreset(val);
    setAmount(String(val));
  };

  const handleSubmit = () => {
    const val = parseFloat(amount);
    if (val >= 1) onTopUp(val);
  };

  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[rgba(16,185,129,0.1)] flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('billing.addFunds')}</h3>
            <p className="text-[11px] text-[var(--th-text-muted)]">{t('billing.addFundsDesc')}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-[var(--th-text-muted)] uppercase tracking-wider font-semibold">{t('billing.currentBalance')}</div>
          <div className="text-lg font-bold tabular-nums" style={{ color: balance < 5 ? '#f59e0b' : '#10b981' }}>
            {fmtBal(balance, plan, lang)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {DEPOSIT_PRESETS.map(val => (
          <button
            key={val}
            onClick={() => handlePreset(val)}
            className={`px-4 py-3 md:py-2.5 min-h-[44px] rounded-xl text-sm font-semibold border transition-all ${
              selectedPreset === val
                ? 'border-[var(--th-primary)] bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]'
                : 'border-[var(--th-border)] text-[var(--th-text-secondary)] hover:border-[var(--th-primary)] hover:bg-[var(--th-primary-bg)]'
            }`}
          >
            ${val}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="number"
          min="1"
          step="5"
          value={amount}
          onChange={e => {
            setAmount(e.target.value);
            setSelectedPreset(null);
          }}
          placeholder={t('billing.customAmount')}
          className="flex-1 px-4 py-3 sm:py-2.5 rounded-xl border border-[var(--th-border)] bg-transparent text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] outline-none focus:border-[var(--th-primary)] transition-colors"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !amount || parseFloat(amount) < 1}
          className="px-6 py-3 sm:py-2.5 min-h-[44px] bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold rounded-xl shadow-[0_2px_8px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_12px_rgba(16,185,129,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? t('common.loading') : t('billing.topUp')}
        </button>
      </div>
    </div>
  );
}
