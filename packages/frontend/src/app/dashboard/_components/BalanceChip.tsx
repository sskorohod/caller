'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import TopUpModal from './TopUpModal';

const WARN = 5;
const CRIT = 1;
const PER_MIN = 0.19;

// Shows the workspace balance and a one-tap "Top up". `compact` for the mobile top bar.
export default function BalanceChip({ compact = false }: { compact?: boolean }) {
  const { lang } = useI18n();
  const tt = (en: string, ru: string) => (lang === 'ru' ? ru : en);
  const [balance, setBalance] = useState<number | null>(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    api.get<{ balance_usd?: string | number }>('/billing/balance')
      .then(r => { const b = Number(r?.balance_usd); if (!isNaN(b)) setBalance(b); })
      .catch(() => {});
  }, []);

  const low = balance != null && balance < WARN;
  const crit = balance != null && balance < CRIT;
  const color = crit ? '#ef4444' : low ? '#d97706' : 'var(--th-success-text)';
  const bal = balance == null ? '—' : `$${balance.toFixed(2)}`;
  const mins = balance != null && balance > 0 ? Math.floor(balance / PER_MIN) : 0;

  if (compact) {
    return (
      <>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ background: 'var(--th-card)', border: `1px solid ${low ? color : 'var(--th-border)'}`, color }}>
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
          {bal}
          <span className="material-symbols-outlined text-sm" style={{ color: 'var(--th-primary)' }}>add_circle</span>
        </button>
        <TopUpModal open={modal} onClose={() => setModal(false)} />
      </>
    );
  }

  return (
    <div className="px-3 py-2">
      <div className="p-3 rounded-xl" style={{ background: 'var(--th-sidebar-hover)', border: `1px solid ${low ? color : 'var(--th-sidebar-border)'}` }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--th-sidebar-label)' }}>
            {tt('Balance', 'Баланс')}
          </span>
          {balance != null && balance > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--th-sidebar-label)' }}>≈ {mins} {tt('min', 'мин')}</span>
          )}
        </div>
        <div className="text-xl font-extrabold mb-2" style={{ color: low ? color : '#fff' }}>{bal}</div>
        <button onClick={() => setModal(true)}
          className="w-full py-2 rounded-lg text-xs font-bold text-white transition-all active:scale-[.98]"
          style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-primary-hover))' }}>
          {tt('Top up', 'Пополнить')}
        </button>
        {crit && <p className="text-[10px] mt-1.5 text-center" style={{ color }}>{tt('Balance too low to call', 'Баланса не хватит на звонок')}</p>}
      </div>
      <TopUpModal open={modal} onClose={() => setModal(false)} />
    </div>
  );
}
