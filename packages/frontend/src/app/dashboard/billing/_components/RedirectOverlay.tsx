'use client';

interface Props {
  show: boolean;
  lang: string;
}

// Full-screen "redirecting to Stripe" overlay. Shown the moment the user taps
// "Top up" and kept up while the browser navigates to Stripe Checkout, so the
// click always produces immediate, reassuring feedback instead of a silent jump.
export function RedirectOverlay({ show, lang }: Props) {
  if (!show) return null;
  const tt = (en: string, ru: string, es?: string) => { if (lang === 'ru') return ru; if (lang === 'es') return es ?? en; return en; };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-6"
      style={{ background: 'rgba(8,12,22,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      role="status"
      aria-live="polite"
    >
      <div
        className="flex flex-col items-center text-center gap-4 px-8 py-9 rounded-3xl border border-[var(--th-card-border-subtle)] shadow-[0_24px_70px_rgba(0,0,0,0.45)] animate-[overlayIn_0.25s_ease-out]"
        style={{ background: 'var(--th-card)', maxWidth: 360 }}
      >
        {/* Spinner */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full" style={{ border: '3px solid var(--th-border)' }} />
          <div
            className="absolute inset-0 rounded-full animate-spin"
            style={{ border: '3px solid transparent', borderTopColor: 'var(--th-primary)' }}
          />
        </div>

        <div>
          <div className="text-base font-bold text-[var(--th-text)]">
            {tt('Redirecting to secure payment', 'Переходим на безопасную оплату')}
          </div>
          <div className="mt-1.5 text-sm text-[var(--th-text-muted)] leading-relaxed">
            {tt('Please wait, do not close this page…', 'Подождите, не закрывайте страницу…')}
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--th-text-muted)]">
          <span className="material-symbols-outlined text-sm">lock</span>
          {tt('Powered by Stripe', 'Защищено Stripe')}
        </div>
      </div>

      <style>{`
        @keyframes overlayIn {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
