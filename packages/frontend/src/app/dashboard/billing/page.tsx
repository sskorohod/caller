'use client';
import { useT, useI18n } from '@/lib/i18n';
import { useBillingData } from './_lib/useBillingData';

import { BillingSkeleton } from './_components/BillingSkeleton';
import { LowBalanceBanner } from './_components/LowBalanceBanner';
import { DepositSection } from './_components/DepositSection';
import { UsagePanel } from './_components/UsagePanel';
import { TransactionHistory } from './_components/TransactionHistory';

// Translator-only "Balance" page: balance, top-up, usage stats, payment history.
// (Subscription/plan components are no longer rendered here.)
export default function BillingPage() {
  const t = useT();
  const { lang } = useI18n();
  const { info, transactions, loading, topUpLoading, topUp } = useBillingData();

  if (loading || !info) return <BillingSkeleton />;

  return (
    <div className="space-y-3 md:space-y-4 max-w-4xl mx-auto">
      {/* Low balance alert */}
      <LowBalanceBanner balance={info.balance_usd} onQuickDeposit={topUp} t={t} />

      {/* Balance + top up */}
      <DepositSection
        balance={info.balance_usd}
        plan={info.plan}
        lang={lang}
        onTopUp={topUp}
        loading={topUpLoading}
        t={t}
      />

      {/* Usage stats (calls, minutes, words, spend, per-call cost) */}
      <UsagePanel />

      {/* Payment & charge history */}
      <TransactionHistory transactions={transactions} t={t} />
    </div>
  );
}
