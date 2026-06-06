'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';

type Period = '7d' | '30d' | 'all';

interface UsageResponse {
  period: Period;
  totals: { calls: number; minutes: number; cost: number; avgCost: number; words: number };
  daily: { date: string; cost: number; calls: number }[];
  sessions: { id: string; call_id: string | null; created_at: string; duration_seconds: number; cost_usd: number; words: number }[];
}

function fmtDur(secs: number): string {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const cardCls = 'rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]';

export function UsagePanel() {
  const { lang } = useI18n();
  const tt = (en: string, ru: string) => (lang === 'ru' ? ru : en);
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    api.get<UsageResponse>(`/translator/usage?period=${period}`)
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [period]);

  const periods: { key: Period; label: string }[] = [
    { key: '7d', label: tt('7 days', '7 дней') },
    { key: '30d', label: tt('30 days', '30 дней') },
    { key: 'all', label: tt('All time', 'Всё время') },
  ];

  const tot = data?.totals;
  const kpis = [
    { icon: 'call', label: tt('Calls', 'Звонков'), value: tot ? String(tot.calls) : '—' },
    { icon: 'schedule', label: tt('Minutes', 'Минут'), value: tot ? String(tot.minutes) : '—' },
    { icon: 'translate', label: tt('Words', 'Слов'), value: tot ? tot.words.toLocaleString() : '—' },
    { icon: 'payments', label: tt('Spent', 'Потрачено'), value: tot ? `$${tot.cost.toFixed(2)}` : '—' },
    { icon: 'trending_up', label: tt('Avg / call', 'Средняя'), value: tot ? `$${tot.avgCost.toFixed(2)}` : '—' },
  ];

  const maxDaily = data?.daily.length ? Math.max(...data.daily.map(d => d.cost), 0.01) : 1;

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Section header + period switcher */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-bold text-[var(--th-text)]">{tt('Usage & reports', 'Использование и отчёты')}</h2>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
          {periods.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={period === p.key
                ? { background: 'var(--th-primary)', color: '#fff', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }
                : { color: 'var(--th-text-muted)' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(k => (
          <div key={k.label} className={`${cardCls} p-4`}>
            <div className="flex items-center gap-1.5 mb-3 text-[var(--th-text-muted)]">
              <span className="material-symbols-outlined text-[18px]">{k.icon}</span>
              <span className="text-[11px] font-medium uppercase tracking-wide">{k.label}</span>
            </div>
            <div className="text-[28px] font-extrabold tabular-nums text-[var(--th-text)] leading-none">{loading ? '…' : k.value}</div>
          </div>
        ))}
      </div>

      {/* Chart + calls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
        {/* Spend by day */}
        <div className={`${cardCls} lg:col-span-7 p-5`}>
          <div className="text-sm font-bold text-[var(--th-text)] mb-4">{tt('Spend by day', 'Траты по дням')}</div>
          {data && data.daily.length > 0 ? (
            <div className="flex items-end gap-1.5 h-40 border-b border-[var(--th-border)] pb-px">
              {data.daily.map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div className="w-full rounded-t-md transition-all group-hover:opacity-100"
                    style={{ height: `${Math.max(3, (d.cost / maxDaily) * 100)}%`, background: 'linear-gradient(to top, var(--th-primary), #818cf8)', opacity: 0.75 }} />
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap text-[10px] font-semibold px-2 py-1 rounded-md z-10"
                    style={{ background: 'var(--th-text)', color: 'var(--th-page)' }}>
                    ${d.cost.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-[var(--th-text-muted)]">
              {loading ? '…' : tt('No data for this period', 'Нет данных за период')}
            </div>
          )}
        </div>

        {/* Calls with cost */}
        <div className={`${cardCls} lg:col-span-5 p-5 flex flex-col`}>
          <div className="text-sm font-bold text-[var(--th-text)] mb-3">{tt('Calls & cost', 'Звонки и стоимость')}</div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[var(--th-text-muted)] py-8">…</div>
          ) : data && data.sessions.length > 0 ? (
            <div className="space-y-0.5 -mx-2 overflow-y-auto max-h-[280px]">
              {data.sessions.map(s => (
                <button key={s.id}
                  onClick={() => router.push(s.call_id ? `/dashboard/calls?call=${s.call_id}` : '/dashboard/calls')}
                  className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg text-left hover:bg-[var(--th-surface)] transition-colors group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--th-surface)' }}>
                    <span className="material-symbols-outlined text-base text-[var(--th-text-muted)] group-hover:text-[var(--th-primary)] transition-colors">graphic_eq</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--th-text)]">{new Date(s.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' })}</div>
                    <div className="text-[11px] text-[var(--th-text-muted)]">{fmtDur(s.duration_seconds)} · {s.words} {tt('words', 'слов')}</div>
                  </div>
                  <div className="text-sm font-bold tabular-nums text-[var(--th-text)] shrink-0">${s.cost_usd.toFixed(2)}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
              <span className="material-symbols-outlined text-3xl text-[var(--th-text-muted)] opacity-50">forum</span>
              <div className="text-sm text-[var(--th-text-muted)]">{tt('No calls yet', 'Пока нет звонков')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
