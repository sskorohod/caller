'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT, useI18n } from '@/lib/i18n';
import type { Workspace } from '../_lib/types';
import { SectionCard } from './SectionCard';

const E164 = /^\+[1-9]\d{1,14}$/;
const normalize = (v: string) => v.replace(/[\s\-\(\)\.]/g, '');

export function GeneralSection({ workspace, onUpdated }: { workspace: Workspace | null; onUpdated: (w: Workspace) => void }) {
  const t = useT();
  const { lang } = useI18n();
  const [ownerName, setOwnerName] = useState((workspace as any)?.owner_name ?? '');
  const [phoneNums, setPhoneNums] = useState<string[]>((workspace as any)?.phone_numbers ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  // Deferred signup-bonus result from PATCH /workspaces/current (first phone added)
  const [bonusNote, setBonusNote] = useState<'granted' | 'blocked' | null>(null);

  useEffect(() => {
    if (workspace) {
      setOwnerName((workspace as any).owner_name ?? '');
      setPhoneNums((workspace as any).phone_numbers ?? []);
    }
  }, [workspace]);

  const initialName = (workspace as any)?.owner_name ?? '';
  const initialPhones = JSON.stringify(((workspace as any)?.phone_numbers ?? []).filter(Boolean));
  // Compare only valid E.164 phones — a stray browser/password-manager
  // autofill (e.g. an email injected into an empty field) must not wedge the
  // form into a permanent "unsaved changes" state.
  const validPhones = phoneNums.map(normalize).filter(n => n && E164.test(n));
  const dirty = ownerName !== initialName || JSON.stringify(validPhones) !== initialPhones;

  async function save() {
    setSaving(true); setError(''); setSaved(false);
    try {
      const updated = await api.patch<Workspace & { signup_bonus?: { granted: boolean; blocked: boolean } }>('/workspaces/current', {
        owner_name: ownerName.trim() || null,
        phone_numbers: phoneNums.map(normalize).filter(n => n && E164.test(n)),
      });
      onUpdated(updated);
      if (updated.signup_bonus?.granted) setBonusNote('granted');
      else if (updated.signup_bonus?.blocked) setBonusNote('blocked');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-input-border)] text-sm text-[var(--th-text)] bg-[var(--th-input)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all";

  return (
    <SectionCard
      id="general"
      icon="person"
      tint="indigo"
      title={t('settings.general') || 'General'}
      description={t('settings.generalDesc')}
      footer={
        <>
          <span className="text-xs min-w-0 truncate">
            {error ? (
              <span className="font-medium text-[var(--th-error-text)]">{error}</span>
            ) : saved ? (
              <span className="inline-flex items-center gap-1 font-medium text-[var(--th-success-text)]">
                <span className="material-symbols-outlined text-[15px] leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {t('settings.saved')}
              </span>
            ) : dirty ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--th-text-muted)]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {t('settings.unsavedChanges')}
              </span>
            ) : null}
          </span>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="btn-primary shrink-0 px-5 py-2 min-h-[38px] text-sm"
          >
            {saving ? t('settings.saving') : t('settings.saveChanges')}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Off-screen decoy credential pair. Chrome shows its "fill saved
            password" dropdown on text fields whenever the origin has a saved
            login (lingoline.net does). This live (non-readonly) username +
            password pair, placed first and hidden OFF-SCREEN (not display:none,
            which Chrome skips), gives the password manager a dedicated target
            so it parks its UI here instead of the visible name/phone fields.
            Hidden from keyboard (tabIndex=-1) and screen readers (aria-hidden);
            uncontrolled, so its value never enters React state or the save. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 0, width: 1, height: 1, overflow: 'hidden' }}>
          <input type="text" name="username" autoComplete="username" tabIndex={-1} />
          <input type="password" name="password" autoComplete="new-password" tabIndex={-1} data-1p-ignore data-lpignore="true" />
        </div>
        {bonusNote && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${bonusNote === 'granted'
              ? 'bg-[var(--th-success-bg)] border border-[var(--th-success-border)] text-[var(--th-success-text)]'
              : 'bg-[var(--th-warning-bg)] border border-[var(--th-warning-border)] text-[var(--th-warning-text)]'}`}
          >
            {bonusNote === 'granted'
              ? (lang === 'ru' ? 'Подарочные $2 начислены на баланс.' : '$2 welcome gift credited to your balance.')
              : (lang === 'ru'
                ? 'Подарочные $2 уже были использованы с этим номером телефона ранее — бонус не начислен.'
                : 'The $2 welcome gift was already used with this phone number — no bonus credited.')}
          </div>
        )}
        {/* Owner name */}
        <div className="space-y-1.5">
          <label htmlFor="settings-owner-name" className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">
            {t('settings.ownerName') || 'Your Name'}
          </label>
          <input
            id="settings-owner-name"
            type="text"
            name="account-owner-name"
            autoComplete="off"
            // Same read-only-until-touched guard as the phone fields, so Chrome
            // can't move the password prompt here once the phones are protected.
            readOnly
            onFocus={e => { e.currentTarget.readOnly = false; }}
            onPointerDown={e => { e.currentTarget.readOnly = false; }}
            value={ownerName}
            onChange={e => setOwnerName(e.target.value)}
            placeholder={lang === 'ru' ? 'Ваше имя' : 'Your name'}
            className={`${inputCls} max-w-sm font-medium`}
          />
          <p className="text-[11px] leading-relaxed text-[var(--th-text-muted)]">
            {t('settings.ownerNameHint') || 'Used as the account holder name on billing and system notifications.'}
          </p>
        </div>

        <div className="h-px bg-[var(--th-border-light)]" />

        {/* Phone numbers */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">
            {t('settings.phoneNumbers')}
          </label>
          <p className="text-[11px] leading-relaxed text-[var(--th-text-muted)]">{t('settings.phoneNumbersHint')}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 pt-1">
            {[0, 1, 2].map(i => {
              const val = phoneNums[i] || '';
              const isValid = !val || E164.test(normalize(val));
              return (
                <div key={i}>
                  <input
                    type="tel"
                    inputMode="tel"
                    name={`authorized-phone-${i + 1}`}
                    autoComplete="tel"
                    data-1p-ignore
                    data-lpignore="true"
                    // Chrome's password-manager form-parser is a SEPARATE pass
                    // from autocomplete; it ignored "tel" and tagged the empty
                    // last field as a credential slot (password prompt on
                    // field 3). The only reliable fix is to make the field
                    // read-only at initial parse so Chrome's classifier skips
                    // it entirely, then unlock it the instant the user touches
                    // it. Mutating the DOM node directly (not React state)
                    // survives re-renders because the static readOnly prop
                    // never changes value, so React never re-applies it.
                    readOnly
                    onFocus={e => { e.currentTarget.readOnly = false; }}
                    onPointerDown={e => { e.currentTarget.readOnly = false; }}
                    value={val}
                    aria-label={`${t('settings.phoneNumbers')} ${i + 1}`}
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
                      const clean = normalize(val);
                      if (clean !== val) {
                        const updated = [...phoneNums];
                        updated[i] = clean;
                        setPhoneNums(updated.slice(0, 3));
                      }
                    }}
                    className={`${inputCls} tabular-nums ${!isValid ? '!border-red-500/50' : ''}`}
                  />
                  {val && !isValid && (
                    <p className="text-[10px] text-red-400 mt-1">E.164: +14155551234</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
