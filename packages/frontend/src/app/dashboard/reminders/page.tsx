'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import MobilePageHeader from '@/components/MobilePageHeader';

interface Reminder {
  id: string;
  kind: string;
  text: string;
  remind_at: string;
  timezone: string;
  recurrence: string | null;
  status: string;
}

const RECUR: Record<string, string> = {
  daily: 'каждый день', weekdays: 'по будням', weekly: 'каждую неделю',
};

export default function RemindersPage() {
  const t = useT();
  const toast = useToast();
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'done'>('pending');

  // Create form
  const [text, setText] = useState('');
  const [when, setWhen] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ reminders: Reminder[] }>(`/reminders?status=${tab}`)
      .then(r => setItems((r.reminders ?? []).filter(x => x.kind === 'generic')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!text.trim() || !when) {
      toast.error('Заполни текст и время');
      return;
    }
    setSaving(true);
    try {
      await api.post('/reminders', {
        text: text.trim(),
        remind_at: new Date(when).toISOString(),
        recurrence: recurrence || null,
      });
      setText(''); setWhen(''); setRecurrence('');
      toast.success('Напоминание создано');
      if (tab === 'pending') load(); else setTab('pending');
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  async function complete(id: string) {
    try { await api.patch(`/reminders/${id}`, { action: 'complete' }); load(); }
    catch { /* ignore */ }
  }
  async function remove(id: string) {
    try { await api.delete(`/reminders/${id}`); load(); }
    catch { /* ignore */ }
  }
  async function snooze(id: string, minutes: number) {
    try { await api.patch(`/reminders/${id}`, { action: 'snooze', snooze_minutes: minutes }); load(); }
    catch { /* ignore */ }
  }

  const fmt = (iso: string, tz: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      timeZone: tz, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });

  const inputCls = 'w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all';

  return (
    <div className="space-y-3 md:space-y-5">
      <MobilePageHeader title={t('nav.reminders')} subtitle="Напоминания" />

      <div className="hidden md:flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 flex items-center justify-center shadow-[0_2px_8px_var(--th-shadow-primary)]">
          <span className="material-symbols-outlined text-white text-xl">alarm</span>
        </div>
        <div>
          <h2 className="text-lg md:text-xl font-bold text-[var(--th-text)]">{t('nav.reminders')}</h2>
          <p className="text-sm text-[var(--th-text-muted)] mt-0.5">Напоминания приходят в Telegram. Создать можно и здесь, и командой /remind в боте.</p>
        </div>
      </div>

      {/* Create form */}
      <div className="rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] p-4 space-y-3">
        <input type="text" value={text} onChange={e => setText(e.target.value)}
          placeholder="Что напомнить — например, «позвонить маме»" className={inputCls} />
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)}
            className={`${inputCls} sm:flex-1`} />
          <select value={recurrence} onChange={e => setRecurrence(e.target.value)}
            className={`${inputCls} sm:w-48`}>
            <option value="">Один раз</option>
            <option value="daily">Каждый день</option>
            <option value="weekdays">По будням</option>
            <option value="weekly">Каждую неделю</option>
          </select>
          <button type="button" onClick={create} disabled={saving}
            className="px-4 py-2.5 min-h-[44px] btn-primary disabled:opacity-40">
            {saving ? '...' : 'Создать'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {(['pending', 'done'] as const).map(s => (
          <button key={s} type="button" onClick={() => setTab(s)}
            className={`px-3.5 py-1.5 text-sm rounded-lg transition-all ${
              tab === s
                ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white font-semibold'
                : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)]'
            }`}>
            {s === 'pending' ? 'Активные' : 'Выполненные'}
          </button>
        ))}
      </div>

      {loading && <div className="text-[var(--th-text-muted)] text-sm">{t('common.loading')}</div>}
      {!loading && items.length === 0 && (
        <div className="text-center py-12 text-[var(--th-text-muted)] text-sm">
          {tab === 'pending' ? 'Активных напоминаний нет.' : 'Выполненных напоминаний нет.'}
        </div>
      )}

      <div className="space-y-2">
        {items.map(r => (
          <div key={r.id}
            className="rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] p-3.5 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--th-text)]">{r.text}</p>
              <p className="text-xs text-[var(--th-text-muted)] mt-0.5">
                📅 {fmt(r.remind_at, r.timezone)}
                {r.recurrence && <span> · 🔁 {RECUR[r.recurrence] ?? r.recurrence}</span>}
              </p>
            </div>
            {tab === 'pending' && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" onClick={() => snooze(r.id, 60)} title="Отложить на час"
                  className="w-8 h-8 rounded-lg text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-base">snooze</span>
                </button>
                <button type="button" onClick={() => complete(r.id)} title="Выполнено"
                  className="w-8 h-8 rounded-lg text-[var(--th-success-text)] hover:bg-[var(--th-success-bg)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-base">check</span>
                </button>
                <button type="button" onClick={() => remove(r.id)} title="Удалить"
                  className="w-8 h-8 rounded-lg text-[var(--th-error-text)] hover:bg-[var(--th-error-bg)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
