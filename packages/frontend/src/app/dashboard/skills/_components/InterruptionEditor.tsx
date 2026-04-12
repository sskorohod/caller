'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';

interface Props {
  rules: Record<string, unknown>;
  onChange: (rules: Record<string, unknown>) => void;
}

const KNOWN_KEYS = ['allow_interruption', 'pause_on_interrupt', 'max_interruptions'];

export default function InterruptionEditor({ rules, onChange }: Props) {
  const t = useT();
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const allowInterruption = Boolean(rules.allow_interruption);
  const pauseOnInterrupt = Boolean(rules.pause_on_interrupt);
  const maxInterruptions = typeof rules.max_interruptions === 'number' ? rules.max_interruptions : 0;

  const customEntries = Object.entries(rules).filter(([k]) => !KNOWN_KEYS.includes(k));

  const addCustom = () => {
    const k = newKey.trim();
    if (!k) return;
    onChange({ ...rules, [k]: newVal });
    setNewKey('');
    setNewVal('');
  };

  const removeCustom = (key: string) => {
    const next = { ...rules };
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
      {/* Allow Interruption */}
      <div className={cardCls}>
        <div className="flex items-center gap-3">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-[var(--th-text-muted)]">
            {t('skills.allowInterruption')}
          </label>
          <button
            type="button"
            onClick={() => onChange({ ...rules, allow_interruption: !allowInterruption })}
            className={`relative w-10 h-6 rounded-full transition-colors ${
              allowInterruption ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'
            }`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              allowInterruption ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* Pause on Interrupt */}
      <div className={cardCls}>
        <div className="flex items-center gap-3">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-[var(--th-text-muted)]">
            {t('skills.pauseOnInterrupt')}
          </label>
          <button
            type="button"
            onClick={() => onChange({ ...rules, pause_on_interrupt: !pauseOnInterrupt })}
            className={`relative w-10 h-6 rounded-full transition-colors ${
              pauseOnInterrupt ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'
            }`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              pauseOnInterrupt ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* Max Interruptions */}
      <div className={cardCls}>
        <label className={labelCls}>{t('skills.maxInterruptions')}</label>
        <input
          type="number"
          min={0}
          className={inputCls + ' max-w-[120px]'}
          value={maxInterruptions}
          onChange={e => onChange({ ...rules, max_interruptions: parseInt(e.target.value) || 0 })}
        />
      </div>

      {/* Custom Rules */}
      <div className={cardCls}>
        <label className={labelCls}>{t('skills.customRules')}</label>
        {customEntries.map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <input className={inputCls + ' flex-1'} value={key} readOnly />
            <input
              className={inputCls + ' flex-1'}
              value={String(val ?? '')}
              onChange={e => onChange({ ...rules, [key]: e.target.value })}
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
