'use client';
import { KpiCard } from '../../_components/KpiCard';
import { IconWallet, IconDollar, IconTrending, IconSparkle } from '../../_lib/icons';

interface BillingKpiRowProps {
  balance: number;
  monthlySpend: number;
  monthlyTxCount: number;
  ownKeyCount: number;
  t: (k: string) => string;
}

export function BillingKpiRow({ balance, monthlySpend, monthlyTxCount, ownKeyCount, t }: BillingKpiRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label={t('billing.kpiBalance')}
        value={`$${balance.toFixed(2)}`}
        sub={t('billing.kpiBalanceSub')}
        icon={<IconWallet />}
        gradient="var(--th-gradient-emerald)"
        accentColor="#10b981"
      />
      <KpiCard
        label={t('billing.kpiSpend')}
        value={`$${monthlySpend.toFixed(2)}`}
        sub={t('billing.kpiSpendSub')}
        icon={<IconDollar />}
        gradient="var(--th-gradient-amber)"
        accentColor="#eab308"
      />
      <KpiCard
        label={t('billing.kpiTransactions')}
        value={String(monthlyTxCount)}
        sub={t('billing.kpiTransactionsSub')}
        icon={<IconTrending />}
        gradient="var(--th-gradient-indigo)"
        accentColor="#6366f1"
      />
      <KpiCard
        label={t('billing.kpiOwnKeys')}
        value={String(ownKeyCount)}
        sub={t('billing.kpiOwnKeysSub')}
        icon={<IconSparkle />}
        gradient="var(--th-gradient-blue)"
        accentColor="#3b82f6"
      />
    </div>
  );
}
