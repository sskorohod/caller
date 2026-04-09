'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import type { Provider, ProviderConfig } from '../_lib/types';
import { PROVIDER_META, fmtDate } from '../_lib/constants';
import { IconCheck, IconTrash } from '../_lib/icons';
import { Field } from './shared/Field';

export function ProviderCard({
  providerKey,
  existingProvider,
  providerConfig,
  onSaved,
  onConfigChange,
}: {
  providerKey: string;
  existingProvider: Provider | undefined;
  providerConfig: ProviderConfig;
  onSaved: () => void;
  onConfigChange: (provider: string, mode: 'platform' | 'own') => void;
}) {
  const t = useT();
  const toast = useToast();
  const meta = PROVIDER_META[providerKey];
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(meta.fields.map(f => [f.key, '']))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOwnOnly = !!(meta as any).ownOnly;
  const mode = isOwnOnly ? 'own' : (providerConfig[providerKey] || 'platform');
  const isConnected = !!existingProvider;

  async function handleSave() {
    const filled = Object.values(fields).some(v => v.trim());
    if (!filled) { setError(t('settings.enterCredential')); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.put(`/auth/providers/${providerKey}`, { credentials: fields });
      setSaved(true);
      toast.success(t('toast.providerSaved'));
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    setDeleting(true);
    try {
      await api.delete(`/auth/providers/${providerKey}`);
      setConfirmDelete(false);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${meta.color}`}>
            {meta.label.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--th-text)]">{meta.label}</div>
            {isConnected ? (
              <div className="flex items-center gap-1 text-xs text-[var(--th-success-text)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--th-success-icon)]" />
                {t('settings.connected')} · {fmtDate(existingProvider.updated_at)}
              </div>
            ) : (
              <div className="text-xs text-[var(--th-text-muted)]">{t('settings.notConfigured')}</div>
            )}
          </div>
        </div>
        {isConnected && (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <button onClick={handleDeleteConfirm} disabled={deleting} className="text-xs text-[var(--th-error-text)] font-medium transition-colors">{deleting ? t('settings.removing') : t('settings.confirm')}</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-[var(--th-text-muted)] hover:text-[var(--th-text-secondary)] font-medium transition-colors">{t('common.cancel')}</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 hover:bg-[var(--th-error-bg)] rounded-lg text-[var(--th-text-muted)] hover:text-[var(--th-error-text)] transition-colors"
              aria-label="Remove credentials"
            >
              <IconTrash className="w-4 h-4" />
            </button>
          )
        )}
      </div>

      {/* Platform / Own toggle — hidden for ownOnly providers */}
      {!isOwnOnly && (
        <div className="flex items-center gap-1 mb-4 p-0.5 bg-[var(--th-surface)] rounded-lg border border-[var(--th-card-border-subtle)]">
          {(['platform', 'own'] as const).map(m => (
            <button
              key={m}
              onClick={() => onConfigChange(providerKey, m)}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                mode === m
                  ? 'bg-[var(--th-card)] text-[var(--th-text)] shadow-sm'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text-secondary)]'
              }`}
            >
              {m === 'platform' ? t('settings.usePlatform') || 'Platform' : t('settings.useOwnKey') || 'Own Key'}
            </button>
          ))}
        </div>
      )}

      {/* Credential fields — shown when "Own Key" selected */}
      {mode === 'own' && (
        <>
          <div className="space-y-3">
            {meta.fields.map(f => (
              <Field
                key={f.key}
                label={f.label}
                value={fields[f.key]}
                onChange={v => setFields(p => ({ ...p, [f.key]: v }))}
                placeholder={isConnected ? '••••••••••••••••' : f.placeholder}
                type={f.secret ? 'password' : 'text'}
              />
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--th-card-border-subtle)]">
            <span className="text-xs">
              {error ? <span className="text-[var(--th-error-text)]">{error}</span>
                : saved ? <span className="text-[var(--th-success-text)] flex items-center gap-1"><IconCheck className="w-3 h-3" />{t('settings.saved')}</span>
                : null}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3.5 py-2 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-60 active:scale-[.98]"
            >
              {saving ? t('settings.saving') : isConnected ? t('settings.update') : t('settings.saveConnect')}
            </button>
          </div>
        </>
      )}

      {/* Telegram pairing hint */}
      {providerKey === 'telegram' && isConnected && (
        <div className="mt-3 p-3 rounded-xl bg-[#0088cc]/5 border border-[#0088cc]/15">
          <p className="text-xs text-[var(--th-text)]">
            <span className="font-semibold">Pairing:</span> Open your bot in Telegram and send <code className="px-1.5 py-0.5 rounded bg-[var(--th-surface)] font-mono text-[11px]">/start</code> — chat ID will be saved automatically.
          </p>
          {existingProvider && (existingProvider as any).verify_error && (
            <p className="text-xs text-[var(--th-warning-text)] mt-1">Waiting for /start...</p>
          )}
        </div>
      )}

      {mode === 'platform' && !isOwnOnly && (
        <p className="text-xs text-[var(--th-text-muted)] italic">
          {t('settings.platformModeHint') || 'Using platform-managed credentials. Usage is billed to your account.'}
        </p>
      )}
    </div>
  );
}
