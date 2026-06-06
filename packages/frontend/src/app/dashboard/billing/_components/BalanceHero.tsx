'use client';
import { useState } from 'react';
import { DEPOSIT_PRESETS } from '../_lib/constants';

// Approx client price per translated minute (see /translator/usage + pricing).
const PRICE_PER_MIN = 0.2;

interface Props {
  balance: number;
  lang: string;
  onTopUp: (amount: number) => void;
  loading: boolean;
}

export function BalanceHero({ balance, lang, onTopUp, loading }: Props) {
  const tt = (en: string, ru: string) => (lang === 'ru' ? ru : en);
  const [amount, setAmount] = useState('');
  const [preset, setPreset] = useState<number | null>(null);

  const submit = () => {
    const v = parseFloat(amount);
    if (v >= 1) onTopUp(v);
  };

  const unlimited = balance > 10000;
  const low = balance < 5;
  const critical = balance < 1;
  const minutes = Math.floor(balance / PRICE_PER_MIN);
  const balColor = critical ? '#ef4444' : low ? '#f59e0b' : 'var(--th-text)';

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-[var(--th-card-border-subtle)] shadow-[0_1px_3px_var(--th-shadow),0_12px_40px_var(--th-card-glow)]"
      style={{ background: 'linear-gradient(135deg, var(--th-card) 0%, var(--th-card) 60%, rgba(99,102,241,0.06) 100%)' }}
    >
      {/* decorative glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.35), transparent 70%)' }} />

      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 md:p-8">
        {/* Balance */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--th-text-muted)] mb-2">
            {tt('Your balance', 'Ваш баланс')}
          </div>
          <div className="text-5xl md:text-6xl font-extrabold tabular-nums leading-none tracking-tight" style={{ color: balColor }}>
            {unlimited ? (lang === 'ru' ? 'Безлимит' : 'Unlimited') : `$${balance.toFixed(2)}`}
          </div>
          {!unlimited && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-sm" style={{ color: 'var(--th-text-muted)' }}>
              <span className="material-symbols-outlined text-base">schedule</span>
              {tt(`≈ ${minutes} min of translation`, `≈ ${minutes} мин перевода`)}
            </div>
          )}
          {low && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full w-fit"
              style={{ background: critical ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: critical ? '#ef4444' : '#f59e0b' }}>
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              {tt('Top up to keep calling', 'Пополните, чтобы продолжать звонить')}
            </div>
          )}
        </div>

        {/* Top up */}
        <div className="lg:col-span-7 lg:border-l lg:border-[var(--th-border)] lg:pl-6 flex flex-col justify-center">
          <div className="text-sm font-semibold text-[var(--th-text)] mb-3">{tt('Add funds', 'Пополнить счёт')}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {DEPOSIT_PRESETS.slice(0, 4).map(val => (
              <button key={val} onClick={() => { setPreset(val); setAmount(String(val)); }}
                className="py-3 rounded-xl text-sm font-bold border transition-all active:scale-[.97]"
                style={preset === val
                  ? { borderColor: 'var(--th-primary)', background: 'var(--th-primary-bg)', color: 'var(--th-primary-text)' }
                  : { borderColor: 'var(--th-border)', color: 'var(--th-text-secondary)' }}>
                ${val}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--th-text-muted)] text-sm">$</span>
              <input type="number" min="1" step="5" value={amount}
                onChange={e => { setAmount(e.target.value); setPreset(null); }}
                placeholder={tt('Custom amount', 'Своя сумма')}
                className="w-full pl-7 pr-4 py-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-input,transparent)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] outline-none focus:border-[var(--th-primary)] focus:ring-2 focus:ring-[var(--th-primary)]/20 transition-all" />
            </div>
            <button onClick={submit} disabled={loading || !amount || parseFloat(amount) < 1}
              className="px-7 py-3 rounded-xl text-sm font-bold text-white whitespace-nowrap transition-all active:scale-[.97] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(99,102,241,0.35)]"
              style={{ background: 'linear-gradient(135deg, var(--th-primary), #4d8eff)' }}>
              {loading ? '…' : tt('Top up', 'Пополнить')}
            </button>
          </div>
          <div className="text-[11px] text-[var(--th-text-muted)] mt-2.5 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">lock</span>
            {tt('Secure payment via Stripe · funds never expire', 'Защищённая оплата через Stripe · средства не сгорают')}
          </div>
        </div>
      </div>
    </div>
  );
}
