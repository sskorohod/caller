'use client';
import { useEffect, useState } from 'react';
import type { DowngradePreview } from '../_lib/types';
import { PLAN_FEATURES, PLAN_DISPLAY_NAMES } from '../_lib/constants';

interface DowngradeConfirmModalProps {
  open: boolean;
  targetPlan: string;
  currentPlan: string;
  fetchPreview: (plan: string) => Promise<DowngradePreview>;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  t: (k: string) => string;
}

export function DowngradeConfirmModal({
  open, targetPlan, currentPlan, fetchPreview, onConfirm, onClose, loading, t,
}: DowngradeConfirmModalProps) {
  const [preview, setPreview] = useState<DowngradePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (open && targetPlan) {
      setPreviewLoading(true);
      setPreview(null);
      fetchPreview(targetPlan).then(setPreview).finally(() => setPreviewLoading(false));
    }
  }, [open, targetPlan, fetchPreview]);

  if (!open) return null;

  const targetName = PLAN_DISPLAY_NAMES[targetPlan] || targetPlan;
  const isToTranslator = targetPlan === 'translator';

  // Features lost: features in current plan that are NOT in target plan
  const currentFeatures = PLAN_FEATURES[currentPlan] || [];
  const targetFeatures = PLAN_FEATURES[targetPlan] || [];
  const targetIncluded = new Set(targetFeatures.filter(f => f.included).map(f => f.key));
  const lostFeatures = currentFeatures.filter(f => f.included && !targetIncluded.has(f.key));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--th-overlay)' }}>
      <div
        className="w-full max-w-md rounded-2xl border shadow-xl animate-scale-in"
        style={{ background: 'var(--th-modal)', borderColor: 'var(--th-border)' }}
      >
        {/* Header */}
        <div className="p-5 pb-0 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--th-text)]">
            {t('billing.downgradeToTitle').replace('{plan}', targetName)}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--th-surface)] transition-colors"
          >
            <span className="material-symbols-outlined text-lg text-[var(--th-text-muted)]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {previewLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-[var(--th-text-muted)]">
              <span className="material-symbols-outlined text-base animate-spin mr-2">progress_activity</span>
              {t('billing.loadingPreview')}
            </div>
          ) : (
            <>
              {/* Features lost */}
              {lostFeatures.length > 0 && (
                <div className="rounded-xl p-4 border" style={{ background: 'var(--th-error-bg)', borderColor: 'var(--th-error-border)' }}>
                  <p className="text-sm font-semibold text-[var(--th-error-text)] mb-2">
                    {t('billing.cancelWhatYouLose')}
                  </p>
                  <ul className="space-y-1.5">
                    {lostFeatures.map(f => (
                      <li key={f.key} className="flex items-center gap-2 text-sm text-[var(--th-error-text)]">
                        <span className="material-symbols-outlined text-sm">remove_circle</span>
                        {t(`billing.planFeature.${f.key}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Resource warnings */}
              {preview?.resource_warnings.agents.over && (
                <div className="rounded-xl p-4 border" style={{ background: 'var(--th-warning-bg)', borderColor: 'var(--th-warning-border)' }}>
                  <p className="text-sm text-[var(--th-warning-text)]">
                    {t('billing.resourceWarningAgents')
                      .replace('{current}', String(preview.resource_warnings.agents.current))
                      .replace('{limit}', String(preview.resource_warnings.agents.new_limit))}
                  </p>
                </div>
              )}
              {preview?.resource_warnings.connections.over && (
                <div className="rounded-xl p-4 border" style={{ background: 'var(--th-warning-bg)', borderColor: 'var(--th-warning-border)' }}>
                  <p className="text-sm text-[var(--th-warning-text)]">
                    {t('billing.resourceWarningConnections')
                      .replace('{current}', String(preview.resource_warnings.connections.current))
                      .replace('{limit}', String(preview.resource_warnings.connections.new_limit))}
                  </p>
                </div>
              )}

              {/* Proration info */}
              {!isToTranslator && preview && (
                <div className="rounded-xl p-4 border" style={{ background: 'var(--th-surface)', borderColor: 'var(--th-border)' }}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-[var(--th-text-secondary)]">{t('billing.prorationCredit')}</span>
                    <span className="font-semibold text-[var(--th-success-text)]">
                      +${preview.proration_credit_usd.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--th-text-secondary)]">{t('billing.newMonthlyRate')}</span>
                    <span className="font-semibold text-[var(--th-text)]">
                      ${preview.new_monthly_usd}/{t('billing.month')}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--th-text-muted)] mt-2">
                    {t('billing.immediateDowngrade')}
                  </p>
                </div>
              )}

              {/* Translator = cancel at period end */}
              {isToTranslator && (
                <div className="rounded-xl p-4 border" style={{ background: 'var(--th-info-bg)', borderColor: 'var(--th-info-border)' }}>
                  <p className="text-sm text-[var(--th-info-text)]">
                    {t('billing.cancelToTranslator')}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onConfirm}
              disabled={loading || previewLoading}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-opacity text-white"
              style={{
                background: 'var(--th-error-text)',
                opacity: loading || previewLoading ? 0.5 : 1,
                cursor: loading || previewLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  ...
                </span>
              ) : t('billing.confirmDowngrade')}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-[var(--th-border)] text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] transition-colors"
            >
              {t('billing.keepCurrentPlan')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
