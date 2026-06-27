'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useT, useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-context';
import { SectionCard } from './SectionCard';

export function DangerZone() {
  const t = useT();
  const { lang } = useI18n();
  const tt = (en: string, ru: string, es?: string) => { if (lang === 'ru') return ru; if (lang === 'es') return es ?? en; return en; };
  const { logout } = useAuth();

  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirmDelete() {
    if (!ack) return;
    setBusy(true); setError('');
    try {
      await api.delete('/workspaces/current');
      logout();
    } catch (e: any) {
      setError(e?.message || tt('Failed to delete account', 'Не удалось удалить аккаунт'));
      setBusy(false);
    }
  }

  return (
    <SectionCard
      id="danger"
      icon="warning"
      tint="red"
      title={tt('Delete account', 'Удалить аккаунт')}
      description={tt(
        'Permanently deletes your account and all data — sessions, transcripts, history and remaining balance. This cannot be undone.',
        'Безвозвратно удаляет ваш аккаунт и все данные — сессии, расшифровки, историю и остаток баланса. Отменить нельзя.',
      )}
    >
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 rounded-xl text-xs font-semibold transition hover:opacity-90"
          style={{ background: 'var(--th-error-bg)', border: '1px solid var(--th-error-border)', color: 'var(--th-error-text)' }}
        >
          {tt('Delete my account', 'Удалить мой аккаунт')}
        </button>
      ) : (
        <div className="rounded-xl p-3 md:p-4 space-y-3" style={{ background: 'var(--th-error-bg)', border: '1px solid var(--th-error-border)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--th-text)' }}>
            {tt(
              'Your phone number(s) will stay in our database. If you register again later with the same number, you will NOT receive the welcome bonus you got on first signup.',
              'Ваш(и) номер(а) телефона останутся в нашей базе данных. Если позже вы зарегистрируетесь снова с тем же номером, приветственный бонус, который вы получили при первой регистрации, начислен НЕ будет.',
            )}
          </p>
          <label className="flex items-start gap-2 text-xs cursor-pointer" style={{ color: 'var(--th-text)' }}>
            <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="mt-0.5" />
            <span>{tt('I understand this is permanent and cannot be undone.', 'Я понимаю, что это навсегда и отменить нельзя.')}</span>
          </label>
          {error && <p className="text-xs" style={{ color: 'var(--th-error-text)' }}>{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={confirmDelete}
              disabled={!ack || busy}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50"
              style={{ background: 'var(--th-error-text)', color: '#fff' }}
            >
              {busy ? tt('Deleting…', 'Удаление…') : tt('Permanently delete', 'Удалить навсегда')}
            </button>
            <button
              onClick={() => { setOpen(false); setAck(false); setError(''); }}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-xs font-medium transition"
              style={{ background: 'var(--th-card)', border: '1px solid var(--th-border)', color: 'var(--th-text)' }}
            >
              {t('settings.cancel') || tt('Cancel', 'Отмена')}
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
