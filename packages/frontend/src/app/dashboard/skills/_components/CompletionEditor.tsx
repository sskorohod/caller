'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';

interface Props {
  criteria: Record<string, unknown>;
  onChange: (criteria: Record<string, unknown>) => void;
}

const KNOWN_KEYS = ['success_message', 'required_confirmations', 'all_data_collected'];

export default function CompletionEditor({ criteria, onChange }: Props) {
  const t = useT();
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const successMessage = (criteria.success_message as string) ?? '';
  const requiredConfirmations = typeof criteria.required_confirmations === 'number' ? criteria.required_confirmations : 0;
  const allDataCollected = Boolean(criteria.all_data_collected);

  const customEntries = Object.entries(criteria).filter(([k]) => !KNOWN_KEYS.includes(k));

  const addCustom = () => {
    const k = newKey.trim();
    if (!k) return;
    onChange({ ...criteria, [k]: newVal });
    setNewKey('');
    setNewVal('');
  };

  const removeCustom = (key: string) => {
    const next = { ...criteria };
    delete next[key];
    onChange(next);
  };

  const labelCls = 'block text-[10px] uppercase tracking-wider font-semibold mb-1.5' +
    ' text-[var(--th-text-muted)]';
  const inputCls = 'w-full rounded-lg border border-[var(--th-border)] bg-[var(--th-surface)]' +
    ' text-[var(--th-text)] text-sm px-3 py-2 outline-none focus:border-[var(--th-primary)]' +
    ' transition-colors placeholder:text-[var(--th-text-muted)]';
  const cardCls = 'rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)]' +
    ' p-4 space-y-4';

  return (
    <div className="space-y-4">
      {/* Success Message */}
      <div className={cardCls}>
        <label className={labelCls}>{t('skills.successMessage')}</label>
        <textarea
          className={inputCls + ' min-h-[72px] resize-y'}
          placeholder="Your request has been completed successfully."
          value={successMessage}
          onChange={e => onChange({ ...criteria, success_message: e.target.value })}
        />
      </div>

      {/* Required Confirmations */}
      <div className={cardCls}>
        <label className={labelCls}>{t('skills.requiredConfirmations')}</label>
        <input
          type="number"
          min={0}
          className={inputCls + ' max-w-[120px]'}
          value={requiredConfirmations}
          onChange={e => onChange({ ...criteria, required_confirmations: parseInt(e.target.value) || 0 })}
        />
      </div>

      {/* All Data Collected toggle */}
      <div className={cardCls}>
        <div className="flex items-center gap-3">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-[var(--th-text-muted)]">
            {t('skills.allDataCollected')}
          </label>
          <button
            type="button"
            onClick={() => onChange({ ...criteria, all_data_collected: !allDataCollected })}
            className={`relative w-10 h-6 rounded-full transition-colors ${
              allDataCollected ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'
            }`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              allDataCollected ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* Custom Criteria */}
      <div className={cardCls}>
        <label className={labelCls}>{t('skills.customCriteria')}</label>
        {customEntries.map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <input className={inputCls + ' flex-1'} value={key} readOnly />
            <input
              className={inputCls + ' flex-1'}
              value={String(val ?? '')}
              onChange={e => onChange({ ...criteria, [key]: e.target.value })}
            />
            <button type="button" onClick={() => removeCustom(key)}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--th-error-text)] bg-[var(--th-error-bg)] hover:opacity-80 transition-opacity">
              <span className="material-symbols-rounded text-[18px]">delete</span>
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <input className={inputCls + ' flex-1'} placeholder="Key" value={newKey} onChange={e => setNewKey(e.target.value)} />
          <input className={inputCls + ' flex-1'} placeholder="Value" value={newVal} onChange={e => setNewVal(e.target.value)} />
          <button type="button" onClick={addCustom}
            className="shrink-0 h-9 px-3 rounded-lg text-xs font-semibold bg-[var(--th-primary)] text-white hover:opacity-90 transition-opacity">
            {t('skills.addRule')}
          </button>
        </div>
      </div>
    </div>
  );
}
