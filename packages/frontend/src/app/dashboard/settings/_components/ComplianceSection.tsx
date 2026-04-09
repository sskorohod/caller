'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Workspace } from '../_lib/types';
import { IconCheck } from '../_lib/icons';

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
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_2px_8px_rgba(16,185,129,0.3)]">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--th-text)]">{t('settings.complianceSettings')}</h2>
          <p className="text-xs text-[var(--th-text-muted)]">{t('settings.complianceHint')}</p>
        </div>
      </div>

      {/* Disclosure toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recording Disclosure Card */}
        <div className={`relative overflow-hidden bg-[var(--th-card)] rounded-2xl border transition-all duration-200 p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] ${
          recording ? 'border-emerald-500/30' : 'border-[var(--th-card-border-subtle)]'
        }`}>
          {recording && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                recording ? 'bg-emerald-500/10' : 'bg-[var(--th-surface)]'
              }`}>
                <svg className={`w-4.5 h-4.5 transition-colors ${recording ? 'text-emerald-500' : 'text-[var(--th-text-muted)]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--th-text)]">{t('settings.callRecordingDisclosure')}</div>
                <div className="text-xs text-[var(--th-text-muted)] mt-1 leading-relaxed">{t('settings.callRecordingHint')}</div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={recording}
              onClick={() => setRecording(v => !v)}
              className={`mt-0.5 relative w-11 h-6 rounded-full transition-all shrink-0 ${recording ? 'bg-emerald-500' : 'bg-[var(--th-border)]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${recording ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
            recording ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[var(--th-surface)] text-[var(--th-text-muted)]'
          }`}>
            {recording ? <IconCheck className="w-3 h-3" /> : null}
            {recording ? 'Enabled' : 'Disabled'}
          </div>
        </div>

        {/* AI Disclosure Card */}
        <div className={`relative overflow-hidden bg-[var(--th-card)] rounded-2xl border transition-all duration-200 p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] ${
          aiDisclosure ? 'border-blue-500/30' : 'border-[var(--th-card-border-subtle)]'
        }`}>
          {aiDisclosure && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500" />}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                aiDisclosure ? 'bg-blue-500/10' : 'bg-[var(--th-surface)]'
              }`}>
                <svg className={`w-4.5 h-4.5 transition-colors ${aiDisclosure ? 'text-blue-500' : 'text-[var(--th-text-muted)]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--th-text)]">{t('settings.aiDisclosure')}</div>
                <div className="text-xs text-[var(--th-text-muted)] mt-1 leading-relaxed">{t('settings.aiDisclosureHint')}</div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={aiDisclosure}
              onClick={() => setAiDisclosure(v => !v)}
              className={`mt-0.5 relative w-11 h-6 rounded-full transition-all shrink-0 ${aiDisclosure ? 'bg-blue-500' : 'bg-[var(--th-border)]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${aiDisclosure ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
            aiDisclosure ? 'bg-blue-500/10 text-blue-600' : 'bg-[var(--th-surface)] text-[var(--th-text-muted)]'
          }`}>
            {aiDisclosure ? <IconCheck className="w-3 h-3" /> : null}
            {aiDisclosure ? 'Enabled' : 'Disabled'}
          </div>
        </div>
      </div>

      {/* Warning banner */}
      {(!recording || !aiDisclosure) && (
        <div className="flex items-center gap-3 p-4 bg-[var(--th-warning-bg)] border border-[var(--th-warning-border)] rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-xs text-[var(--th-warning-text)] leading-relaxed">{t('settings.complianceWarning')}</p>
        </div>
      )}

      {/* Auto-answer delay card */}
      <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('settings.autoAnswerDelay')}</h3>
          </div>
          <p className="text-xs text-[var(--th-text-muted)] leading-relaxed">{t('settings.autoAnswerHint')}</p>

          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={autoAnswerDelay}
                onChange={e => setAutoAnswerDelay(parseInt(e.target.value))}
                className="w-full accent-[var(--th-primary)] h-2"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-[var(--th-text-muted)]">5s</span>
                <span className="text-[9px] text-[var(--th-text-muted)]">60s</span>
                <span className="text-[9px] text-[var(--th-text-muted)]">120s</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[var(--th-primary-bg)] to-[var(--th-surface)] border border-[var(--th-card-border-subtle)] flex flex-col items-center justify-center shrink-0">
              <span className="text-xl font-bold text-[var(--th-primary-text)] leading-none">{autoAnswerDelay}</span>
              <span className="text-[9px] text-[var(--th-text-muted)] uppercase font-semibold">sec</span>
            </div>
          </div>
        </div>

        {/* Save bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--th-card-border-subtle)] bg-[var(--th-surface)]/50 rounded-b-2xl">
          <span className="text-xs text-[var(--th-text-muted)]">
            {error ? <span className="text-[var(--th-error-text)]">{error}</span> : saved ? <span className="text-[var(--th-success-text)] flex items-center gap-1"><IconCheck className="w-3.5 h-3.5" />{t('settings.saved')}</span> : null}
          </span>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-60 active:scale-[.98] shadow-sm"
          >
            {saving ? t('settings.saving') : t('settings.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}
