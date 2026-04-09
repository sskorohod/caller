'use client';
import { useT } from '@/lib/i18n';
import { IconCheck } from '../../_lib/icons';

export function SaveBar({ saving, saved, error, onSave }: { saving: boolean; saved: boolean; error: string; onSave: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between mt-6 pt-5 border-t border-[var(--th-card-border-subtle)]">
      <span className="text-xs text-[var(--th-text-muted)]">
        {error ? <span className="text-[var(--th-error-text)]">{error}</span> : saved ? <span className="text-[var(--th-success-text)] flex items-center gap-1"><IconCheck className="w-3.5 h-3.5" />{t('settings.saved')}</span> : null}
      </span>
      <button
        onClick={onSave}
        disabled={saving}
        className="px-4 py-2 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-60 active:scale-[.98]"
      >
        {saving ? t('settings.saving') : t('settings.saveChanges')}
      </button>
    </div>
  );
}
