'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const PRESETS = [10, 25, 50, 100];

export default function TopUpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useI18n();
  const tt = (en: string, ru: string) => (lang === 'ru' ? ru : en);
  const [amount, setAmount] = useState(25);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const effectiveAmount = custom ? Math.max(1, Math.min(10000, Math.round(Number(custom) || 0))) : amount;

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ url: string }>('/billing/deposit/checkout', { amount_usd: effectiveAmount });
      if (res?.url) window.location.href = res.url;
      else { setError(tt('Could not start checkout', 'Не удалось открыть оплату')); setLoading(false); }
    } catch {
      setError(tt('Could not start checkout', 'Не удалось открыть оплату'));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 safe-bottom"
        style={{ background: 'var(--th-card)', border: '1px solid var(--th-border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: 'var(--th-text)' }}>{tt('Top up balance', 'Пополнить баланс')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--th-text-muted)' }} aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {PRESETS.map(p => {
            const active = !custom && amount === p;
            return (
              <button key={p} onClick={() => { setCustom(''); setAmount(p); }}
                className="py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: active ? 'var(--th-primary)' : 'var(--th-page)',
                  color: active ? '#fff' : 'var(--th-text)',
                  border: `1px solid ${active ? 'var(--th-primary)' : 'var(--th-border)'}`,
                }}>
                ${p}
              </button>
            );
          })}
        </div>

        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--th-text-muted)' }}>
          {tt('Or custom amount', 'Или своя сумма')}
        </label>
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--th-text-muted)' }}>$</span>
          <input type="number" inputMode="numeric" min={1} max={10000} value={custom}
            onChange={e => setCustom(e.target.value)} placeholder="50"
            className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm"
            style={{ background: 'var(--th-page)', border: '1px solid var(--th-border)', color: 'var(--th-text)' }} />
        </div>

        <p className="text-xs mb-4" style={{ color: 'var(--th-text-muted)' }}>
          {tt('≈ ', '≈ ')}{Math.floor(effectiveAmount / 0.19)} {tt('min of translation', 'мин перевода')}
        </p>

        {error && <p className="text-xs mb-3" style={{ color: '#ef4444' }}>{error}</p>}

        <button onClick={submit} disabled={loading || effectiveAmount < 1}
          className="w-full py-3 rounded-xl text-base font-bold text-white transition-all active:scale-[.98] disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-primary-hover))' }}>
          {loading ? tt('Opening…', 'Открываю…') : `${tt('Pay', 'Оплатить')} $${effectiveAmount}`}
        </button>
        <p className="text-[11px] text-center mt-2" style={{ color: 'var(--th-text-muted)' }}>
          {tt('Secure payment via Stripe', 'Безопасная оплата через Stripe')}
        </p>
      </div>
    </div>
  );
}
