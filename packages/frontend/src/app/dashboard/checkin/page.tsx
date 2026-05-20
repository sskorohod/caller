'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import MobilePageHeader from '@/components/MobilePageHeader';

interface CheckIn {
  id: string;
  checkin_date: string;
  status: string;
  energy_level: string | null;
  lunch: string | null;
  dinner: string | null;
  highlight: string | null;
  created_at: string;
}

const ENERGY: Record<string, { label: string; emoji: string; bg: string; fg: string }> = {
  great:   { label: 'Отличная', emoji: '🔥', bg: 'rgba(16,185,129,0.12)', fg: 'var(--th-success-text)' },
  good:    { label: 'Хорошая',  emoji: '🙂', bg: 'rgba(59,130,246,0.12)', fg: '#2563eb' },
  ok:      { label: 'Средняя',  emoji: '😐', bg: 'rgba(245,158,11,0.12)', fg: '#d97706' },
  low:     { label: 'Низкая',   emoji: '😕', bg: 'rgba(249,115,22,0.12)', fg: '#ea580c' },
  drained: { label: 'Выжат',    emoji: '😴', bg: 'rgba(239,68,68,0.12)',  fg: 'var(--th-error-text)' },
};

export default function CheckinPage() {
  const t = useT();
  const [items, setItems] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ checkins: CheckIn[] }>('/checkins')
      .then(r => setItems(r.checkins ?? []))
      .catch((e: unknown) => setError((e as Error)?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-3 md:space-y-5">
      <MobilePageHeader title={t('nav.checkin')} subtitle="Вечерние чек-ины" />

      {/* Desktop header */}
      <div className="hidden md:flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 flex items-center justify-center shadow-[0_2px_8px_var(--th-shadow-primary)]">
          <span className="material-symbols-outlined text-white text-xl">event_available</span>
        </div>
        <div>
          <h2 className="text-lg md:text-xl font-bold text-[var(--th-text)]">{t('nav.checkin')}</h2>
          <p className="text-sm text-[var(--th-text-muted)] mt-0.5">Вечерние чек-ины — энергия, еда, важное за день</p>
        </div>
      </div>

      {loading && <div className="text-[var(--th-text-muted)] text-sm">{t('common.loading')}</div>}
      {error && <div className="text-[var(--th-error-text)] text-sm">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="text-center py-16 text-[var(--th-text-muted)]">
          <p className="text-sm">Чек-инов пока нет.</p>
          <p className="text-xs mt-1">Бот пришлёт опрос вечером, или начни вручную командой /checkin в Telegram.</p>
        </div>
      )}

      <div className="space-y-2.5">
        {items.map(c => {
          const e = c.energy_level ? ENERGY[c.energy_level] : null;
          return (
            <div key={c.id}
              className="rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] p-4 shadow-[0_1px_3px_var(--th-shadow)]">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-semibold text-[var(--th-text)]">{fmtDate(c.checkin_date)}</span>
                <div className="flex items-center gap-2">
                  {e && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: e.bg, color: e.fg }}>
                      {e.emoji} {e.label}
                    </span>
                  )}
                  {c.status !== 'completed' && (
                    <span className="text-[10px] text-[var(--th-text-muted)] italic">не завершён</span>
                  )}
                </div>
              </div>
              <div className="space-y-1 text-sm text-[var(--th-text-secondary)]">
                {c.lunch && <p><span className="text-[var(--th-text-muted)]">🍽 Обед:</span> {c.lunch}</p>}
                {c.dinner && <p><span className="text-[var(--th-text-muted)]">🌙 Ужин:</span> {c.dinner}</p>}
                {c.highlight && <p><span className="text-[var(--th-text-muted)]">⭐️ Важное:</span> {c.highlight}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
