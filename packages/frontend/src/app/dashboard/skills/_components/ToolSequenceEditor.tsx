'use client';

import { useT } from '@/lib/i18n';
import type { ToolStep } from '../_lib/types';

interface Props {
  steps: ToolStep[];
  onChange: (steps: ToolStep[]) => void;
}

export default function ToolSequenceEditor({ steps, onChange }: Props) {
  const t = useT();

  const update = (idx: number, patch: Partial<ToolStep>) => {
    const next = steps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };

  const remove = (idx: number) => onChange(steps.filter((_, i) => i !== idx));

  const add = () => {
    onChange([...steps, { tool: '', action: '', parameters: {} }]);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...steps];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  };

  const moveDown = (idx: number) => {
    if (idx >= steps.length - 1) return;
    const next = [...steps];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  };

  const labelCls = 'block text-[10px] uppercase tracking-wider font-semibold mb-1.5' +
    ' text-[var(--th-text-muted)]';
  const inputCls = 'w-full rounded-lg border border-[var(--th-border)] bg-[var(--th-surface)]' +
    ' text-[var(--th-text)] text-sm px-3 py-2 outline-none focus:border-[var(--th-primary)]' +
    ' transition-colors placeholder:text-[var(--th-text-muted)]';
  const cardCls = 'rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)]' +
    ' p-4';

  const btnIcon = 'w-7 h-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80';

  return (
    <div className="space-y-3">
      {steps.map((step, idx) => (
        <div key={idx} className={cardCls}>
          <div className="flex items-start gap-3">
            {/* Step number badge */}
            <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--th-primary)] text-white text-sm font-bold flex items-center justify-center mt-0.5">
              {idx + 1}
            </div>

            <div className="flex-1 space-y-3">
              {/* Tool + Action */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('skills.toolName')}</label>
                  <input className={inputCls} placeholder="crm_lookup"
                    value={step.tool} onChange={e => update(idx, { tool: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>{t('skills.toolAction')}</label>
                  <input className={inputCls} placeholder="Check if contact exists"
                    value={step.action} onChange={e => update(idx, { action: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="shrink-0 flex flex-col gap-1">
              <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0}
                className={`${btnIcon} text-[var(--th-text-muted)] ${idx === 0 ? 'opacity-30' : ''}`}>
                <span className="material-symbols-rounded text-[18px]">arrow_upward</span>
              </button>
              <button type="button" onClick={() => moveDown(idx)} disabled={idx >= steps.length - 1}
                className={`${btnIcon} text-[var(--th-text-muted)] ${idx >= steps.length - 1 ? 'opacity-30' : ''}`}>
                <span className="material-symbols-rounded text-[18px]">arrow_downward</span>
              </button>
              <button type="button" onClick={() => remove(idx)}
                className={`${btnIcon} text-[var(--th-error-text)] bg-[var(--th-error-bg)]`}>
                <span className="material-symbols-rounded text-[16px]">delete</span>
              </button>
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={add}
        className="w-full h-10 rounded-xl border border-dashed border-[var(--th-border)] text-sm font-semibold text-[var(--th-text-muted)] hover:border-[var(--th-primary)] hover:text-[var(--th-primary)] transition-colors flex items-center justify-center gap-1.5">
        <span className="material-symbols-rounded text-[18px]">add</span>
        {t('skills.addStep')}
      </button>
    </div>
  );
}
