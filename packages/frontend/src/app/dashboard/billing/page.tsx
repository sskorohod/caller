'use client';
import { useT, useI18n } from '@/lib/i18n';
import { useBillingData } from './_lib/useBillingData';

import { BillingSkeleton } from './_components/BillingSkeleton';
import { LowBalanceBanner } from './_components/LowBalanceBanner';
import { PlanHeroCard } from './_components/PlanHeroCard';
import { BillingKpiRow } from './_components/BillingKpiRow';
import { SpendingChart } from './_components/SpendingChart';
import { UsageBreakdownBar } from './_components/UsageBreakdownBar';
import { DepositSection } from './_components/DepositSection';
import { PlanComparisonGrid } from './_components/PlanComparisonGrid';
import { SubscriptionManager } from './_components/SubscriptionManager';
import { TransactionHistory } from './_components/TransactionHistory';

export default function BillingPage() {
  const t = useT();
  const { lang } = useI18n();
  const {
    info,
    transactions,
    loading,
    topUpLoading,
    cancelConfirm,
    setCancelConfirm,
    topUp,
    subscribe,
    cancelSubscription,
    monthlySpend,
    monthlyTxCount,
    ownKeyCount,
    dailySpending,
    usageBreakdown,
    planPrices,
  } = useBillingData();

  if (loading || !info) return <BillingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Low balance alert */}
      <LowBalanceBanner balance={info.balance_usd} onQuickDeposit={topUp} t={t} />

      {/* Hero: current plan */}
      <PlanHeroCard
        info={info}
        onSubscribe={subscribe}
        onCancelClick={() => setCancelConfirm(true)}
        t={t}
      />

      {/* KPI row */}
      <BillingKpiRow
        balance={info.balance_usd}
        plan={info.plan}
        lang={lang}
        monthlySpend={monthlySpend}
        monthlyTxCount={monthlyTxCount}
        ownKeyCount={ownKeyCount}
        t={t}
      />

      {/* Charts: spending + usage breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <SpendingChart dailySpending={dailySpending} t={t} />
        </div>
        <div className="lg:col-span-5">
          <UsageBreakdownBar breakdown={usageBreakdown} t={t} />
        </div>
      </div>

      {/* Deposit section */}
      <DepositSection
        balance={info.balance_usd}
        plan={info.plan}
        lang={lang}
        onTopUp={topUp}
        loading={topUpLoading}
        t={t}
      />

      {/* Plan comparison */}
      <PlanComparisonGrid
        currentPlan={info.plan}
        onSubscribe={subscribe}
        planPrices={planPrices}
        t={t}
      />

      {/* Subscription management */}
      <SubscriptionManager
        info={info}
        cancelConfirm={cancelConfirm}
        setCancelConfirm={setCancelConfirm}
        onCancel={cancelSubscription}
        t={t}
      />

      {/* Transaction history */}
      <TransactionHistory transactions={transactions} t={t} />
    </div>
  );
}
