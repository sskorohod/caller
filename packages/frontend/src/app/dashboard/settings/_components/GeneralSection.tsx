'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Workspace } from '../_lib/types';
import { TIMEZONES } from '../_lib/constants';
import { Field } from './shared/Field';
import { SaveBar } from './shared/SaveBar';

export function GeneralSection({ workspace, onUpdated }: { workspace: Workspace | null; onUpdated: (w: Workspace) => void }) {
  const t = useT();
  const [name, setName] = useState(workspace?.name ?? '');
  const [phoneNums, setPhoneNums] = useState<string[]>((workspace as any)?.phone_numbers ?? []);
  const [timezone, setTimezone] = useState(workspace?.timezone ?? '');
  const [convOwner, setConvOwner] = useState(workspace?.conversation_owner_default ?? 'internal');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
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

  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-6 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
      <h3 className="text-sm font-semibold text-[var(--th-text)] mb-5">{t('settings.workspaceSettings')}</h3>
      <div className="space-y-4">
        <Field label={t('settings.workspaceName')} value={name} onChange={setName} placeholder="My Company" />

        {/* Phone numbers */}
        <div>
          <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">
            {t('settings.phoneNumbers') || 'Phone Numbers'}
          </label>
          <p className="text-[10px] text-[var(--th-text-muted)] mb-1.5">
            {t('settings.phoneNumbersHint') || 'Up to 3 phone numbers for translator service identification (E.164: +1...)'}
          </p>
          <div className="space-y-2">
            {[0, 1, 2].map(i => {
              const val = phoneNums[i] || '';
              const normalized = val.replace(/[\s\-\(\)\.]/g, '');
              const isValid = !val || /^\+[1-9]\d{1,14}$/.test(normalized);
              return (
                <div key={i} className="relative">
                  <input
                    type="tel"
                    value={val}
                    placeholder={i === 0 ? '+14155551234' : 'Optional'}
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
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-[var(--th-text)] bg-[var(--th-card)] focus:outline-none focus:ring-2 transition-all ${
                      isValid
                        ? 'border-[var(--th-card-border-subtle)] focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]'
                        : 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500'
                    }`}
                  />
                  {val && !isValid && (
                    <p className="text-[10px] text-red-400 mt-0.5">Invalid format. Use E.164: +14155551234</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Timezone + Owner */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('settings.timezone')}</label>
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] bg-[var(--th-card)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
          >
            <option value="">{t('settings.selectTimezone')}</option>
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('settings.defaultConversationOwner')}</label>
          <select
            value={convOwner}
            onChange={e => setConvOwner(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] bg-[var(--th-card)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
          >
            <option value="internal">{t('settings.internalAgent')}</option>
            <option value="external">{t('settings.externalAgent')}</option>
          </select>
          <p className="text-xs text-[var(--th-text-secondary)]">{t('settings.convOwnerHint')}</p>
        </div>
      </div>
      <SaveBar saving={saving} saved={saved} error={error} onSave={save} />
    </div>
  );
}
