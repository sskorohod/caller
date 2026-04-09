'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Workspace } from '../_lib/types';
import { SaveBar } from './shared/SaveBar';

export function ComplianceSection({ workspace, onUpdated }: { workspace: Workspace | null; onUpdated: (w: Workspace) => void }) {
  const t = useT();
  const [recording, setRecording] = useState(workspace?.call_recording_disclosure ?? true);
  const [aiDisclosure, setAiDisclosure] = useState(workspace?.ai_disclosure ?? true);
  const [autoAnswerDelay, setAutoAnswerDelay] = useState(workspace?.inbound_auto_answer_delay_seconds ?? 30);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (workspace) {
      setRecording(workspace.call_recording_disclosure ?? true);
      setAiDisclosure(workspace.ai_disclosure ?? true);
      setAutoAnswerDelay(workspace.inbound_auto_answer_delay_seconds ?? 30);
    }
  }, [workspace]);

  async function save() {
    setSaving(true); setError(''); setSaved(false);
    try {
      const updated = await api.patch<Workspace>('/workspaces/current', {
        call_recording_disclosure: recording,
        ai_disclosure: aiDisclosure,
        inbound_auto_answer_delay_seconds: autoAnswerDelay,
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
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('settings.complianceSettings')}</h3>
        <p className="text-xs text-[var(--th-text-muted)] mt-1">
          {t('settings.complianceHint') || 'Configure required disclosures for call recording and AI identity laws.'}
        </p>
      </div>

      <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-6 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] space-y-5">
        {/* Recording disclosure */}
        <div className="flex items-start gap-4">
          <button
            type="button"
            role="switch"
            aria-checked={recording}
            aria-label="Toggle call recording disclosure"
            onClick={() => setRecording(v => !v)}
            className={`mt-0.5 relative w-10 h-6 rounded-full transition-all shrink-0 ${recording ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${recording ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
          <div>
            <div className="text-sm font-medium text-[var(--th-text)]">{t('settings.callRecordingDisclosure')}</div>
            <div className="text-xs text-[var(--th-text-muted)] mt-0.5">{t('settings.callRecordingHint')}</div>
          </div>
        </div>

        {/* AI disclosure */}
        <div className="flex items-start gap-4">
          <button
            type="button"
            role="switch"
            aria-checked={aiDisclosure}
            aria-label="Toggle AI identity disclosure"
            onClick={() => setAiDisclosure(v => !v)}
            className={`mt-0.5 relative w-10 h-6 rounded-full transition-all shrink-0 ${aiDisclosure ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${aiDisclosure ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
          <div>
            <div className="text-sm font-medium text-[var(--th-text)]">{t('settings.aiDisclosure')}</div>
            <div className="text-xs text-[var(--th-text-muted)] mt-0.5">{t('settings.aiDisclosureHint')}</div>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-center gap-3 p-3 bg-[var(--th-warning-bg)] border border-[var(--th-warning-border)] rounded-lg">
          <svg className="w-4 h-4 text-[#d97706] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-[var(--th-warning-text)]">
            {t('settings.complianceWarning') || 'We recommend keeping both disclosures enabled. Disabling them may expose you to legal liability depending on your jurisdiction.'}
          </p>
        </div>

        {/* Auto-answer delay */}
        <div className="pt-4 border-t border-[var(--th-border)]">
          <div className="text-sm font-medium text-[var(--th-text)] mb-1">{t('settings.autoAnswerDelay')}</div>
          <div className="text-xs text-[var(--th-text-muted)] mb-3">{t('settings.autoAnswerHint')}</div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={autoAnswerDelay}
              onChange={e => setAutoAnswerDelay(parseInt(e.target.value))}
              className="flex-1 accent-[var(--th-primary)]"
            />
            <span className="text-sm font-mono font-bold text-[var(--th-primary-text)] w-12 text-right">
              {autoAnswerDelay}s
            </span>
          </div>
        </div>

        <SaveBar saving={saving} saved={saved} error={error} onSave={save} />
      </div>
    </div>
  );
}
