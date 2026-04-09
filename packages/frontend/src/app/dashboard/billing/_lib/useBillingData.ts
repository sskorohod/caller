'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import type { BillingInfo, Transaction, PlanInfo } from './types';

export function useBillingData() {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.get<BillingInfo>('/billing/balance'),
      api.get<Transaction[]>('/billing/transactions?limit=50'),
      api.get<PlanInfo[]>('/billing/plans'),
    ]).then(([b, t, p]) => {
      setInfo(b);
      setTransactions(t);
      setPlans(p);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const topUp = useCallback(async (amount: number) => {
    if (!amount || amount < 1) return;
    setTopUpLoading(true);
    try {
      const result = await api.post<{ url: string }>('/billing/deposit/checkout', { amount_usd: amount });
      if (result.url) window.location.href = result.url;
    } finally {
      setTopUpLoading(false);
    }
  }, []);

  const subscribe = useCallback(async (planId: string) => {
    const result = await api.post<{ url: string }>('/billing/subscription', { plan: planId });
    if (result.url) window.location.href = result.url;
  }, []);

  const cancelSubscription = useCallback(async () => {
    await api.delete('/billing/subscription');
    setCancelConfirm(false);
    load();
  }, [load]);

  // Derived: monthly spend (sum of negative transactions in current month)
  const monthlySpend = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return transactions
      .filter(t => t.created_at >= monthStart && t.amount_usd < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount_usd), 0);
  }, [transactions]);

  // Derived: transaction count this month
  const monthlyTxCount = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return transactions.filter(t => t.created_at >= monthStart).length;
  }, [transactions]);

  // Derived: own key savings estimate (count providers on "own" mode)
  const ownKeyCount = useMemo(() => {
    if (!info) return 0;
    return Object.values(info.provider_config).filter(m => m === 'own').length;
  }, [info]);

  // Derived: daily spending for last 7 days
  const dailySpending = useMemo(() => {
    const now = new Date();
    const days: { day: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayTotal = transactions
        .filter(t => t.created_at.slice(0, 10) === dateStr && t.amount_usd < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount_usd), 0);
      days.push({ day: dateStr, amount: dayTotal });
    }
    return days;
  }, [transactions]);

  // Derived: usage breakdown by category (parse descriptions)
  const usageBreakdown = useMemo(() => {
    const cats = { llm: 0, tts: 0, stt: 0, telephony: 0 };
    transactions
      .filter(t => t.type === 'usage' && t.amount_usd < 0)
      .forEach(t => {
        const desc = (t.description || '').toLowerCase();
        const amt = Math.abs(t.amount_usd);
        if (desc.includes('llm') || desc.includes('claude') || desc.includes('gpt')) cats.llm += amt;
        else if (desc.includes('tts') || desc.includes('elevenlabs') || desc.includes('speech')) cats.tts += amt;
        else if (desc.includes('stt') || desc.includes('deepgram') || desc.includes('whisper') || desc.includes('transcri')) cats.stt += amt;
        else if (desc.includes('telephony') || desc.includes('twilio') || desc.includes('phone')) cats.telephony += amt;
        else cats.llm += amt; // default bucket
      });
    return cats;
  }, [transactions]);

  return {
    info,
    transactions,
    plans,
    loading,
    topUpLoading,
    cancelConfirm,
    setCancelConfirm,
    topUp,
    subscribe,
    cancelSubscription,
    reload: load,
    monthlySpend,
    monthlyTxCount,
    ownKeyCount,
    dailySpending,
    usageBreakdown,
  };
}
