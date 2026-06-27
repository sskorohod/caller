'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { SectionCard } from './SectionCard';

interface PersonalNumber {
  id: string;
  phone_number: string;
  monthly_price_usd: number;
  next_renewal_at: string | null;
  auto_renew: boolean;
  status: string;
}

const fmtPhone = (p: string) => p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 ($1) $2-$3');

export function PersonalNumberSection() {
  const { lang } = useI18n();
  const tt = (en: string, ru: string, es?: string) => { if (lang === 'ru') return ru; if (lang === 'es') return es ?? en; return en; };
  const router = useRouter();

  const [number, setNumber] = useState<PersonalNumber | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmBuy, setConfirmBuy] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [needTopUp, setNeedTopUp] = useState(false);

  const load = () => Promise.all([
    api.get<{ number: PersonalNumber | null; price_usd: number }>('/telephony/personal-number')
      .then(r => { setNumber(r.number); setPrice(r.price_usd); }),
    api.get<{ balance_usd: number }>('/billing/balance').then(r => setBalance(r.balance_usd)),
  ]).catch(() => {}).finally(() => setLoaded(true));

  useEffect(() => { load(); }, []);

  async function buy() {
    setBusy(true); setError(''); setNeedTopUp(false);
    try {
      await api.post('/telephony/personal-number', {});
      setConfirmBuy(false);
      await load();
    } catch (e: any) {
      setConfirmBuy(false);
      if (String(e.message).includes('INSUFFICIENT_BALANCE')) setNeedTopUp(true);
      else setError(e.message || 'Failed');
    }
    setBusy(false);
  }

  async function toggleAutoRenew() {
    if (!number) return;
    setBusy(true); setError('');
    try {
      const r = await api.patch<{ number: PersonalNumber }>('/telephony/personal-number', { auto_renew: !number.auto_renew });
      setNumber(r.number);
    } catch (e: any) { setError(e.message || 'Failed'); }
    setBusy(false);
  }

  async function release() {
    setBusy(true); setError('');
    try {
      await api.delete('/telephony/personal-number');
      setConfirmRelease(false);
      await load();
    } catch (e: any) { setError(e.message || 'Failed'); }
    setBusy(false);
  }

  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  const priceStr = price != null ? `$${price.toFixed(2)}` : '…';
  const lowBalance = number && balance != null && price != null && balance < price;

  const badge = number ? (
    number.auto_renew ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
        style={{ background: 'var(--th-success-bg)', color: 'var(--th-success-text)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {tt('Active', 'Активен')}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
        style={{ background: 'var(--th-warning-bg)', color: 'var(--th-warning-text)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        {tt('Expires soon', 'Скоро отключится')}
      </span>
    )
  ) : null;

  const btnCls = 'px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50';

  return (
    <SectionCard
      id="personal-number"
      icon="call"
      tint="violet"
      title={tt('Personal number', 'Личный номер')}
      description={tt(
        'Your own US number for the interpreter — call from any phone, the line is never busy.',
        'Собственный US-номер для переводчика — звоните с любого телефона, линия никогда не занята.',
      )}
      badge={badge}
    >
      <div className="space-y-4">
        {!loaded ? (
          <div className="h-10 rounded-xl bg-[var(--th-surface)] animate-pulse" />
        ) : !number ? (
          <>
            <ul className="rounded-xl p-3.5 space-y-2" style={{ background: 'var(--th-surface)' }}>
              {[
                tt('Your own +1 number that connects straight to your interpreter', 'Собственный номер +1, который соединяет сразу с вашим переводчиком'),
                tt('Call it from any phone — no need to register caller IDs', 'Звоните на него с любого телефона — не нужно регистрировать номера'),
                tt('Never busy: the line is yours alone', 'Никогда не занята: линия только ваша'),
              ].map((s, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-snug text-[var(--th-text-secondary)]">
                  <span className="material-symbols-outlined text-[16px] leading-none mt-0.5 text-[var(--th-primary)]">check_circle</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <p className="text-[12px] leading-relaxed text-[var(--th-text-muted)]">
              {tt(
                `${priceStr}/month, charged from your balance. First month is charged today. If the balance can't cover a renewal, the number is released.`,
                `${priceStr}/мес, списывается с баланса. Первый месяц — сегодня. Если на продление не хватит баланса, номер будет отключён.`,
              )}
            </p>
            {needTopUp && (
              <div className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-[12px] leading-snug"
                style={{ background: 'var(--th-warning-bg)', color: 'var(--th-warning-text)', border: '1px solid var(--th-warning-border)' }}>
                <span>{tt(`Not enough balance — you need at least ${priceStr}.`, `Недостаточно средств — нужно минимум ${priceStr}.`)}</span>
                <button onClick={() => router.push('/dashboard/billing')}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--th-warning-text)] text-white hover:opacity-90 transition-all">
                  {tt('Top up', 'Пополнить')}
                </button>
              </div>
            )}
            <button onClick={() => setConfirmBuy(true)} disabled={busy}
              className="btn-primary px-5 py-2 min-h-[38px] text-sm">
              {tt(`Get my number — ${priceStr}/mo`, `Получить номер — ${priceStr}/мес`)}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <a href={`tel:${number.phone_number}`}
                className="text-xl font-extrabold tracking-wide text-[var(--th-text)]"
                style={{ filter: 'drop-shadow(0 1px 3px rgba(139,92,246,0.25))' }}>
                {fmtPhone(number.phone_number)}
              </a>
            </div>
            <div className="rounded-xl p-3.5 space-y-1.5 text-[13px]" style={{ background: 'var(--th-surface)' }}>
              <div className="flex justify-between text-[var(--th-text-secondary)]">
                <span>{tt('Monthly price', 'Цена в месяц')}</span>
                <span className="font-mono tabular-nums">${number.monthly_price_usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--th-text-secondary)]">
                <span>{number.auto_renew ? tt('Next renewal', 'Следующее продление') : tt('Works until', 'Работает до')}</span>
                <span className="font-mono tabular-nums">{fmtDate(number.next_renewal_at)}</span>
              </div>
            </div>
            {!number.auto_renew && (
              <div className="flex items-start gap-2 rounded-xl px-3.5 py-3 text-[12px] leading-snug"
                style={{ background: 'var(--th-warning-bg)', color: 'var(--th-warning-text)', border: '1px solid var(--th-warning-border)' }}>
                <span className="material-symbols-outlined text-[16px] leading-none mt-0.5">hourglass_top</span>
                <span>{tt(
                  `Auto-renewal is off. The number works until ${fmtDate(number.next_renewal_at)} and will then be released.`,
                  `Автопродление выключено. Номер работает до ${fmtDate(number.next_renewal_at)}, затем будет отключён.`,
                )}</span>
              </div>
            )}
            {number.auto_renew && lowBalance && (
              <div className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-[12px] leading-snug"
                style={{ background: 'var(--th-warning-bg)', color: 'var(--th-warning-text)', border: '1px solid var(--th-warning-border)' }}>
                <span>{tt(
                  `Balance is below $${number.monthly_price_usd.toFixed(2)} — top up before ${fmtDate(number.next_renewal_at)} or the number will be released.`,
                  `Баланс меньше $${number.monthly_price_usd.toFixed(2)} — пополните до ${fmtDate(number.next_renewal_at)}, иначе номер будет отключён.`,
                )}</span>
                <button onClick={() => router.push('/dashboard/billing')}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--th-warning-text)] text-white hover:opacity-90 transition-all">
                  {tt('Top up', 'Пополнить')}
                </button>
              </div>
            )}
            {/* Auto-renew toggle */}
            <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
              <span className="text-[13px] text-[var(--th-text-secondary)]">{tt('Auto-renew monthly', 'Продлевать автоматически')}</span>
              <button onClick={toggleAutoRenew} disabled={busy} role="switch" aria-checked={number.auto_renew}
                className="relative w-11 h-6 rounded-full transition-colors disabled:opacity-50"
                style={{ background: number.auto_renew ? 'var(--th-primary)' : 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: number.auto_renew ? 'calc(100% - 22px)' : '2px' }} />
              </button>
            </label>
            <button onClick={() => setConfirmRelease(true)} disabled={busy}
              className={btnCls + ' border border-red-500/30 text-red-400 hover:bg-red-500/10'}>
              {tt('Release number', 'Отказаться от номера')}
            </button>
          </>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Purchase confirm modal */}
      {confirmBuy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--th-overlay)' }} onClick={() => !busy && setConfirmBuy(false)}>
          <div className="w-full max-w-sm rounded-2xl p-5 animate-scale-in"
            style={{ background: 'var(--th-modal)', border: '1px solid var(--th-card-border-subtle)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[var(--th-text)]">{tt('Get a personal number?', 'Получить личный номер?')}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--th-text-secondary)]">
              {tt(
                `We'll pick an available US number for you. ${priceStr} will be charged from your balance now, then ${priceStr}/month automatically. If a renewal can't be paid, the number is released.`,
                `Мы подберём доступный US-номер. ${priceStr} спишется с баланса сейчас, далее ${priceStr}/мес автоматически. Если продление оплатить не удастся, номер будет отключён.`,
              )}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmBuy(false)} disabled={busy}
                className={btnCls + ' border border-[var(--th-card-border-subtle)] text-[var(--th-text)]'}>
                {tt('Cancel', 'Отмена')}
              </button>
              <button onClick={buy} disabled={busy} className="btn-primary px-4 py-2 text-sm">
                {busy ? tt('Buying…', 'Покупаем…') : tt(`Buy for ${priceStr}`, `Купить за ${priceStr}`)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Release confirm modal */}
      {confirmRelease && number && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--th-overlay)' }} onClick={() => !busy && setConfirmRelease(false)}>
          <div className="w-full max-w-sm rounded-2xl p-5 animate-scale-in"
            style={{ background: 'var(--th-modal)', border: '1px solid var(--th-card-border-subtle)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[var(--th-text)]">{tt('Release this number?', 'Отказаться от номера?')}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--th-text-secondary)]">
              {tt(
                `${fmtPhone(number.phone_number)} will be released immediately and can't be recovered. The current month is not refunded.`,
                `${fmtPhone(number.phone_number)} будет отключён сразу и восстановить его нельзя. Оплата за текущий месяц не возвращается.`,
              )}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmRelease(false)} disabled={busy}
                className={btnCls + ' border border-[var(--th-card-border-subtle)] text-[var(--th-text)]'}>
                {tt('Cancel', 'Отмена')}
              </button>
              <button onClick={release} disabled={busy}
                className={btnCls + ' bg-[var(--th-error-bg)] text-[var(--th-error-text)] border border-[var(--th-error-border)]'}>
                {busy ? tt('Releasing…', 'Отключаем…') : tt('Release', 'Отключить')}
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
