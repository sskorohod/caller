'use client';
import { useState } from 'react';
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
import { DowngradeConfirmModal } from './_components/DowngradeConfirmModal';

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
    downgrade,
    reactivate,
    fetchDowngradePreview,
    monthlySpend,
    monthlyTxCount,
    ownKeyCount,
    dailySpending,
    usageBreakdown,
    planPrices,
  } = useBillingData();

  const [downgradeTarget, setDowngradeTarget] = useState<string | null>(null);
  const [downgradeLoading, setDowngradeLoading] = useState(false);

  if (loading || !info) return <BillingSkeleton />;

  const handleDowngradeConfirm = async () => {
    if (!downgradeTarget) return;
    setDowngradeLoading(true);
    try {
      await downgrade(downgradeTarget);
      setDowngradeTarget(null);
    } finally {
      setDowngradeLoading(false);
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Low balance alert */}
      <LowBalanceBanner balance={info.balance_usd} onQuickDeposit={topUp} t={t} />

      {/* Trial banner */}
      {info.subscription_status === 'trialing' && info.subscription_current_period_end && (() => {
        const daysLeft = Math.max(0, Math.ceil((new Date(info.subscription_current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        return (
          <div className="rounded-2xl border p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
            style={{
              background: daysLeft <= 3
                ? 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))'
                : 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.04))',
              borderColor: daysLeft <= 3 ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)',
            }}>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[var(--th-text)]">
                {daysLeft > 0
                  ? `${t('billing.trialDaysLeft').replace('{days}', String(daysLeft))}`
                  : t('billing.trialExpiresToday')}
              </div>
              <div className="text-[11px] text-[var(--th-text-muted)] mt-0.5">
                {t('billing.trialSubscribePrompt')}
              </div>
            </div>
            <button
              onClick={() => subscribe(info.plan)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold rounded-xl shadow-[0_2px_8px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_12px_rgba(16,185,129,0.4)] transition-[box-shadow,transform] whitespace-nowrap"
            >
              {t('billing.subscribeNow')}
            </button>
          </div>
        );
      })()}

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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
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
        onDowngrade={(planId) => setDowngradeTarget(planId)}
        planPrices={planPrices}
        t={t}
      />

      {/* Subscription management */}
      <SubscriptionManager
        info={info}
        cancelConfirm={cancelConfirm}
        setCancelConfirm={setCancelConfirm}
        onCancel={cancelSubscription}
        onReactivate={reactivate}
        t={t}
      />

      {/* Transaction history */}
      <TransactionHistory transactions={transactions} t={t} />

      {/* Downgrade confirmation modal */}
      <DowngradeConfirmModal
        open={!!downgradeTarget}
        targetPlan={downgradeTarget || ''}
        currentPlan={info.plan}
        fetchPreview={fetchDowngradePreview}
        onConfirm={handleDowngradeConfirm}
        onClose={() => setDowngradeTarget(null)}
        loading={downgradeLoading}
        t={t}
      />
    </div>
  );
}
