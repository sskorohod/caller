'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Workspace } from '../_lib/types';
import { IconCheck } from '../_lib/icons';

export function GeneralSection({ workspace, onUpdated }: { workspace: Workspace | null; onUpdated: (w: Workspace) => void }) {
  const t = useT();
  const [ownerName, setOwnerName] = useState((workspace as any)?.owner_name ?? '');
  const [phoneNums, setPhoneNums] = useState<string[]>((workspace as any)?.phone_numbers ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (workspace) {
      setOwnerName((workspace as any).owner_name ?? '');
      setPhoneNums((workspace as any).phone_numbers ?? []);
    }
  }, [workspace]);

  async function save() {
    setSaving(true); setError(''); setSaved(false);
    try {
      const updated = await api.patch<Workspace>('/workspaces/current', {
        owner_name: ownerName.trim() || null,
        phone_numbers: phoneNums.map(n => n.replace(/[\s\-\(\)\.]/g, '')).filter(n => n && /^\+[1-9]\d{1,14}$/.test(n)),
      });
      onUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] bg-[var(--th-card)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all";

  return (
    <div className="space-y-3 md:space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--th-text)]">{t('settings.general') || 'Settings'}</h2>
      </div>

      {/* Workspace Identity Card */}
      <div className="relative overflow-hidden bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
        <div className="p-4 md:p-6 space-y-4 md:space-y-5">
          {/* Owner name */}
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">
              {t('settings.ownerName') || 'Your Name'}
            </label>
            <input
              type="text"
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              placeholder="Slava"
              className={`${inputCls} !text-base !py-3 font-medium`}
            />
            <p className="text-[11px] text-[var(--th-text-muted)]">{t('settings.ownerNameHint') || 'Used as client name in mission calls so the agent doesn\'t ask every time.'}</p>
          </div>

          {/* Phone numbers */}
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">
              {t('settings.phoneNumbers')}
            </label>
            <p className="text-[11px] text-[var(--th-text-muted)]">{t('settings.phoneNumbersHint')}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[0, 1, 2].map(i => {
                const val = phoneNums[i] || '';
                const normalized = val.replace(/[\s\-\(\)\.]/g, '');
                const isValid = !val || /^\+[1-9]\d{1,14}$/.test(normalized);
                return (
                  <div key={i}>
                    <input
                      type="tel"
                      value={val}
                      placeholder={i === 0 ? '+14155551234' : `Phone ${i + 1} (optional)`}
                      onChange={e => {
                        let v = e.target.value;
                        if (v && !v.startsWith('+') && /^\d/.test(v)) v = '+' + v;
                        const updated = [...phoneNums];
                        updated[i] = v;
                        setPhoneNums(updated.slice(0, 3));
                      }}
                      onBlur={() => {
                        if (!val) return;
                        const clean = val.replace(/[\s\-\(\)\.]/g, '');
                        if (clean !== val) {
                          const updated = [...phoneNums];
                          updated[i] = clean;
                          setPhoneNums(updated.slice(0, 3));
                        }
                      }}
                      className={`${inputCls} ${!isValid ? '!border-red-500/50 !focus:ring-red-500/20' : ''}`}
                    />
                    {val && !isValid && (
                      <p className="text-[10px] text-red-400 mt-0.5">E.164: +14155551234</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Save bar */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-t border-[var(--th-card-border-subtle)] bg-[var(--th-surface)]/50 rounded-b-2xl">
          <span className="text-xs text-[var(--th-text-muted)]">
            {error ? <span className="text-[var(--th-error-text)]">{error}</span> : saved ? <span className="text-[var(--th-success-text)] flex items-center gap-1"><IconCheck className="w-3.5 h-3.5" />{t('settings.saved')}</span> : null}
          </span>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 min-h-[44px] w-full sm:w-auto btn-primary shadow-sm"
          >
            {saving ? t('settings.saving') : t('settings.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}
