'use client';
import { useI18n } from '@/lib/i18n';

// Shown when the workspace's phone number already claimed the $2 welcome
// gift in another account (signup_bonus_status === 'blocked' from
// GET /billing/balance). The user can still top up and use the service.
export function GiftAlreadyUsedBanner({ status }: { status?: string }) {
  const { lang } = useI18n();
  if (status !== 'blocked') return null;

  const title = lang === 'ru'
    ? 'Подарочные $2 уже были использованы с этим номером телефона'
    : 'The $2 welcome gift was already used with this phone number';
  const body = lang === 'ru'
    ? 'Стартовый баланс — $0. Вы можете пополнить баланс картой и пользоваться сервисом как обычно.'
    : 'Your starting balance is $0. You can top up with a card and use the service as usual.';

  return (
    <div className="bg-[var(--th-warning-bg)] border-[var(--th-warning-border)] border rounded-2xl px-5 py-3.5 flex items-center gap-3">
      <svg className="w-5 h-5 shrink-0" style={{ color: 'var(--th-warning-icon)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <div>
        <span className="text-sm font-semibold text-[var(--th-warning-text)]">{title}</span>
        <span className="text-sm text-[var(--th-warning-text)] opacity-80 ml-1">{body}</span>
      </div>
    </div>
  );
}
