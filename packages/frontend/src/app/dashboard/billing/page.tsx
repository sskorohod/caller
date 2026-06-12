'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useT, useI18n } from '@/lib/i18n';
import { useBillingData } from './_lib/useBillingData';

import { BillingSkeleton } from './_components/BillingSkeleton';
import { BalanceHero } from './_components/BalanceHero';
import { UsagePanel } from './_components/UsagePanel';
import { TransactionHistory } from './_components/TransactionHistory';
import { RedirectOverlay } from './_components/RedirectOverlay';
import { TopUpSuccessModal } from './_components/TopUpSuccessModal';

// Translator-only "Balance" page: balance + one-tap top-up, usage stats, payment history.
function BillingPageInner() {
  const t = useT();
  const { lang } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { info, transactions, loading, topUpLoading, topUp, reload } = useBillingData();
  // null = no modal; string = amount (dollars) from the Stripe success redirect
  const [topUpSuccess, setTopUpSuccess] = useState<string | null>(null);

  // On return from Stripe Checkout: show the success popup, refresh the balance,
  // and strip the query params so a reload doesn't re-trigger it.
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setTopUpSuccess(searchParams.get('amount') ?? '');
      reload();
      router.replace('/dashboard/billing');
    } else if (searchParams.get('canceled') === 'true') {
      router.replace('/dashboard/billing');
    }
  }, [searchParams, router, reload]);

  if (loading || !info) return <BillingSkeleton />;

  return (
    <div className="space-y-4 md:space-y-5">
      <RedirectOverlay show={topUpLoading} lang={lang} />
      {topUpSuccess !== null && (
        <TopUpSuccessModal
          amount={topUpSuccess}
          balance={info.balance_usd}
          lang={lang}
          onClose={() => setTopUpSuccess(null)}
        />
      )}
      <BalanceHero balance={info.balance_usd} lang={lang} onTopUp={topUp} loading={topUpLoading} />
      <UsagePanel />
      <TransactionHistory transactions={transactions} t={t} />
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <BillingPageInner />
    </Suspense>
  );
}
