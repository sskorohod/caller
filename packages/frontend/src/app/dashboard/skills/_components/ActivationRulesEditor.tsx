'use client';

import { useState, type KeyboardEvent } from 'react';
import { useT } from '@/lib/i18n';

interface Props {
  rules: Record<string, unknown>;
  onChange: (rules: Record<string, unknown>) => void;
}

const KNOWN_KEYS = ['keywords', 'intent_match', 'confidence_threshold'];

export default function ActivationRulesEditor({ rules, onChange }: Props) {
  const t = useT();
  const [kwInput, setKwInput] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const keywords = Array.isArray(rules.keywords) ? (rules.keywords as string[]) : [];
  const intentMatch = (rules.intent_match as string) ?? '';
  const confidence = typeof rules.confidence_threshold === 'number' ? rules.confidence_threshold : 0.5;

  const customEntries = Object.entries(rules).filter(([k]) => !KNOWN_KEYS.includes(k));

  const addKeyword = () => {
    const word = kwInput.trim();
    if (!word || keywords.includes(word)) return;
    onChange({ ...rules, keywords: [...keywords, word] });
    setKwInput('');
  };

  const removeKeyword = (idx: number) => {
    onChange({ ...rules, keywords: keywords.filter((_, i) => i !== idx) });
  };

  const handleKwKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addKeyword(); }
  };

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
      {/* Keywords */}
      <div className={cardCls}>
        <label className={labelCls}>{t('skills.keywords')}</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {keywords.map((kw, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[var(--th-primary)]/15 text-[var(--th-primary)] text-xs font-medium px-2.5 py-1">
              {kw}
              <button type="button" onClick={() => removeKeyword(i)} className="hover:opacity-70 text-[var(--th-primary)]">&times;</button>
            </span>
          ))}
        </div>
        <input
          className={inputCls}
          placeholder={t('skills.keywordsPlaceholder')}
          value={kwInput}
          onChange={e => setKwInput(e.target.value)}
          onKeyDown={handleKwKey}
        />
      </div>

      {/* Intent Match */}
      <div className={cardCls}>
        <label className={labelCls}>{t('skills.intentMatch')}</label>
        <input
          className={inputCls}
          value={intentMatch}
          onChange={e => onChange({ ...rules, intent_match: e.target.value })}
          placeholder="e.g. schedule_*"
        />
      </div>

      {/* Confidence Threshold */}
      <div className={cardCls}>
        <label className={labelCls}>{t('skills.confidenceThreshold')}</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={confidence}
            onChange={e => onChange({ ...rules, confidence_threshold: parseFloat(e.target.value) })}
            className="flex-1 accent-[var(--th-primary)]"
          />
          <span className="text-sm font-mono font-semibold text-[var(--th-text)] min-w-[3ch] text-right">
            {confidence.toFixed(2)}
          </span>
        </div>
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
