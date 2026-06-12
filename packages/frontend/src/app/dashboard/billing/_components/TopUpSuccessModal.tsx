'use client';

interface Props {
  amount: string;   // dollars from the success URL, e.g. "1" — may be empty
  balance: number;  // current balance after the deposit
  lang: string;
  onClose: () => void;
}

// Celebratory "balance topped up" popup, shown when the user returns from Stripe
// Checkout via the ?success=true redirect. Mirrors RedirectOverlay's styling so
// the start and end of the payment flow feel like one coherent moment.
export function TopUpSuccessModal({ amount, balance, lang, onClose }: Props) {
  const tt = (en: string, ru: string) => (lang === 'ru' ? ru : en);
  const parsed = parseFloat(amount);
  const amt = amount && !isNaN(parsed) ? `$${parsed.toFixed(2)}` : null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-6"
      style={{ background: 'rgba(8,12,22,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center text-center gap-4 px-8 py-9 rounded-3xl border border-[var(--th-card-border-subtle)] shadow-[0_24px_70px_rgba(0,0,0,0.45)] animate-[successIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)]"
        style={{ background: 'var(--th-card)', maxWidth: 380 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success check */}
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full animate-[checkPop_0.4s_ease-out]"
          style={{ background: 'rgba(34,197,94,0.14)' }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 40, color: '#22c55e', fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
        </div>

        <div>
          <div className="text-xl font-extrabold text-[var(--th-text)]">
            {tt('Thank you!', 'Спасибо!')}
          </div>
          <div className="mt-2 text-sm text-[var(--th-text-secondary)] leading-relaxed">
            {amt
              ? tt(`Your balance was topped up by ${amt}.`, `Ваш счёт пополнен на ${amt}.`)
              : tt('Your balance was topped up.', 'Ваш счёт пополнен.')}
          </div>
        </div>

        {/* Current balance */}
        <div
          className="w-full rounded-2xl px-4 py-3 border border-[var(--th-border)]"
          style={{ background: 'var(--th-input,transparent)' }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--th-text-muted)]">
            {tt('Current balance', 'Текущий баланс')}
          </div>
          <div className="mt-0.5 text-2xl font-extrabold tabular-nums text-[var(--th-text)]">
            ${balance.toFixed(2)}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-7 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-[.97] shadow-[0_4px_14px_rgba(34,197,94,0.35)]"
          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
        >
          {tt('Great', 'Отлично')}
        </button>
      </div>

      <style>{`
        @keyframes successIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes checkPop {
          0%   { transform: scale(0); }
          60%  { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
