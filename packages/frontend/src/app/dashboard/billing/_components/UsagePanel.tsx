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
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  const periods: { key: Period; label: string }[] = [
    { key: '7d', label: tt('7 days', '7 дней') },
    { key: '30d', label: tt('30 days', '30 дней') },
    { key: 'all', label: tt('All time', 'Всё время') },
  ];

  const totals = data?.totals;
  const kpis = [
    { label: tt('Calls', 'Звонков'), value: totals ? String(totals.calls) : '—' },
    { label: tt('Minutes', 'Минут'), value: totals ? String(totals.minutes) : '—' },
    { label: tt('Words translated', 'Слов переведено'), value: totals ? totals.words.toLocaleString() : '—' },
    { label: tt('Spent', 'Потрачено'), value: totals ? `$${totals.cost.toFixed(2)}` : '—' },
    { label: tt('Avg / call', 'Средняя / звонок'), value: totals ? `$${totals.avgCost.toFixed(2)}` : '—' },
  ];

  const maxDaily = data?.daily.length ? Math.max(...data.daily.map(d => d.cost), 0.01) : 1;

  return (
    <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-4 md:p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
      {/* Header + period switcher */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-[var(--th-text)]">{tt('Usage', 'Использование')}</h3>
        <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'var(--th-surface)' }}>
          {periods.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
              style={period === p.key
                ? { background: 'var(--th-primary)', color: '#fff' }
                : { color: 'var(--th-text-muted)' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl p-3" style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
            <div className="text-lg font-bold text-[var(--th-text)] leading-tight">{loading ? '…' : k.value}</div>
            <div className="text-[11px] text-[var(--th-text-muted)] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Daily spend chart (simple bars) */}
      {data && data.daily.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-[var(--th-text-muted)]">{tt('Spend by day', 'Траты по дням')}</div>
          <div className="flex items-end gap-1 h-24">
            {data.daily.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative" title={`${d.date}: $${d.cost.toFixed(2)} · ${d.calls}`}>
                <div className="w-full rounded-t" style={{ height: `${Math.max(4, (d.cost / maxDaily) * 100)}%`, background: 'var(--th-primary)', opacity: 0.85 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions with cost */}
      <div className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-[var(--th-text-muted)]">{tt('Calls & cost', 'Звонки и стоимость')}</div>
      {loading ? (
        <div className="text-sm text-[var(--th-text-muted)] py-4 text-center">…</div>
      ) : data && data.sessions.length > 0 ? (
        <div className="space-y-1">
          {data.sessions.map(s => (
            <button key={s.id}
              onClick={() => router.push(s.call_id ? `/dashboard/calls?call=${s.call_id}` : '/dashboard/calls')}
              className="w-full flex items-center justify-between gap-3 py-2 px-2 rounded-lg text-left hover:bg-[var(--th-surface)] transition-colors border-b border-[var(--th-border)] last:border-0">
              <span className="text-sm text-[var(--th-text)] shrink-0">{new Date(s.created_at).toLocaleDateString()}</span>
              <span className="text-xs text-[var(--th-text-muted)] flex-1 text-right">
                {fmtDur(s.duration_seconds)} · {s.words} {tt('words', 'слов')}
              </span>
              <span className="text-sm font-semibold text-[var(--th-text)] shrink-0 w-16 text-right">${s.cost_usd.toFixed(2)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-sm text-[var(--th-text-muted)] py-4 text-center">{tt('No calls in this period yet.', 'Пока нет звонков за этот период.')}</div>
      )}
    </div>
  );
}
