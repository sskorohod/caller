'use client';
import { useT, useI18n } from '@/lib/i18n';
import { useBillingData } from './_lib/useBillingData';

import { BillingSkeleton } from './_components/BillingSkeleton';
import { BalanceHero } from './_components/BalanceHero';
import { UsagePanel } from './_components/UsagePanel';
import { TransactionHistory } from './_components/TransactionHistory';
import { RedirectOverlay } from './_components/RedirectOverlay';

// Translator-only "Balance" page: balance + one-tap top-up, usage stats, payment history.
export default function BillingPage() {
  const t = useT();
  const { lang } = useI18n();
  const { info, transactions, loading, topUpLoading, topUp } = useBillingData();

  if (loading || !info) return <BillingSkeleton />;

  return (
    <div className="space-y-4 md:space-y-5">
      <RedirectOverlay show={topUpLoading} lang={lang} />
      <BalanceHero balance={info.balance_usd} lang={lang} onTopUp={topUp} loading={topUpLoading} />
      <UsagePanel />
      <TransactionHistory transactions={transactions} t={t} />
    </div>
  );
}
