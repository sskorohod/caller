'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Workspace } from '../_lib/types';
import { TIMEZONES } from '../_lib/constants';
import { IconCheck } from '../_lib/icons';

export function GeneralSection({ workspace, onUpdated }: { workspace: Workspace | null; onUpdated: (w: Workspace) => void }) {
  const t = useT();
  const [name, setName] = useState(workspace?.name ?? '');
  const [ownerName, setOwnerName] = useState((workspace as any)?.owner_name ?? '');
  const [phoneNums, setPhoneNums] = useState<string[]>((workspace as any)?.phone_numbers ?? []);
  const [timezone, setTimezone] = useState(workspace?.timezone ?? '');
  const [convOwner, setConvOwner] = useState(workspace?.conversation_owner_default ?? 'internal');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setOwnerName((workspace as any).owner_name ?? '');
      setPhoneNums((workspace as any).phone_numbers ?? []);
      setTimezone(workspace.timezone ?? '');
      setConvOwner(workspace.conversation_owner_default ?? 'internal');
    }
  }, [workspace]);

  async function save() {
    setSaving(true); setError(''); setSaved(false);
    try {
      const updated = await api.patch<Workspace>('/workspaces/current', {
        name: name.trim(),
        owner_name: ownerName.trim() || null,
        phone_numbers: phoneNums.map(n => n.replace(/[\s\-\(\)\.]/g, '')).filter(n => n && /^\+[1-9]\d{1,14}$/.test(n)),
        timezone: timezone || undefined,
        conversation_owner_default: convOwner,
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
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_2px_8px_rgba(59,130,246,0.3)]">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--th-text)]">{t('settings.workspaceSettings')}</h2>
          <p className="text-xs text-[var(--th-text-muted)]">{t('settings.generalHint') || 'Configure your workspace identity and preferences.'}</p>
        </div>
      </div>

      {/* Workspace Identity Card */}
      <div className="relative overflow-hidden bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
        {/* Gradient accent bar */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        <div className="p-4 md:p-6 space-y-4 md:space-y-5">
          {/* Workspace name — prominently displayed */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18" />
              </svg>
              {t('settings.workspaceName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Company"
              className={`${inputCls} !text-base !py-3 font-medium`}
            />
          </div>

          {/* Owner name */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
              </svg>
              {t('settings.ownerName') || 'Your Name'}
            </label>
            <input
              type="text"
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              placeholder="Slava"
              className={inputCls}
            />
            <p className="text-[10px] text-[var(--th-text-muted)]">{t('settings.ownerNameHint') || 'Used as client name in mission calls so the agent doesn\'t ask every time.'}</p>
          </div>

          {/* Phone numbers */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              {t('settings.phoneNumbers')}
            </label>
            <p className="text-[10px] text-[var(--th-text-muted)]">{t('settings.phoneNumbersHint')}</p>
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
      </div>

      {/* Preferences Card */}
      <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
        <div className="p-4 md:p-6 space-y-4 md:space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('settings.preferences') || 'Preferences'}</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Timezone */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide flex items-center gap-1.5">
                <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('settings.timezone')}
              </label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className={inputCls}>
                <option value="">{t('settings.selectTimezone')}</option>
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            {/* Conversation Owner */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide flex items-center gap-1.5">
                <svg className="w-3 h-3 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                </svg>
                {t('settings.defaultConversationOwner')}
              </label>
              <select value={convOwner} onChange={e => setConvOwner(e.target.value)} className={inputCls}>
                <option value="internal">{t('settings.internalAgent')}</option>
                <option value="external">{t('settings.externalAgent')}</option>
              </select>
              <p className="text-[10px] text-[var(--th-text-muted)] leading-relaxed">{t('settings.convOwnerHint')}</p>
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
