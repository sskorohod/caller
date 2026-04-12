'use client';

import { useT } from '@/lib/i18n';
import type { EscalationCondition } from '../_lib/types';
import { ESCALATION_TYPES, ESCALATION_ACTIONS } from '../_lib/constants';

interface Props {
  conditions: EscalationCondition[];
  onChange: (conditions: EscalationCondition[]) => void;
}

export default function EscalationEditor({ conditions, onChange }: Props) {
  const t = useT();

  const update = (idx: number, patch: Partial<EscalationCondition>) => {
    const next = conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next);
  };

  const remove = (idx: number) => onChange(conditions.filter((_, i) => i !== idx));

  const add = () => {
    onChange([...conditions, { type: 'negative_sentiment', threshold: '', action: 'transfer_human', message: '' }]);
  };

  const labelCls = 'block text-[10px] uppercase tracking-wider font-semibold mb-1.5' +
    ' text-[var(--th-text-muted)]';
  const inputCls = 'w-full rounded-lg border border-[var(--th-border)] bg-[var(--th-surface)]' +
    ' text-[var(--th-text)] text-sm px-3 py-2 outline-none focus:border-[var(--th-primary)]' +
    ' transition-colors placeholder:text-[var(--th-text-muted)]';
  const cardCls = 'rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)]' +
    ' p-4 relative';

  return (
    <div className="space-y-3">
      {conditions.map((cond, idx) => (
        <div key={idx} className={cardCls}>
          {/* Delete button */}
          <button type="button" onClick={() => remove(idx)}
            className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--th-error-text)] bg-[var(--th-error-bg)] hover:opacity-80 transition-opacity">
            <span className="material-symbols-rounded text-[16px]">delete</span>
          </button>

          {/* Type + Threshold + Action */}
          <div className="grid grid-cols-3 gap-3 mb-3 pr-10">
            <div>
              <label className={labelCls}>{t('skills.conditionType')}</label>
              <select className={inputCls} value={cond.type}
                onChange={e => update(idx, { type: e.target.value })}>
                {ESCALATION_TYPES.map(et => (
                  <option key={et.value} value={et.value}>{et.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('skills.threshold')}</label>
              <input className={inputCls} placeholder="0.3" value={cond.threshold}
                onChange={e => update(idx, { threshold: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>{t('skills.action')}</label>
              <select className={inputCls} value={cond.action}
                onChange={e => update(idx, { action: e.target.value })}>
                {ESCALATION_ACTIONS.map(ea => (
                  <option key={ea.value} value={ea.value}>{ea.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className={labelCls}>{t('skills.escalationMsg')}</label>
            <input className={inputCls} placeholder="Let me connect you with a specialist..."
              value={cond.message} onChange={e => update(idx, { message: e.target.value })} />
          </div>
        </div>
      ))}

      <button type="button" onClick={add}
        className="w-full h-10 rounded-xl border border-dashed border-[var(--th-border)] text-sm font-semibold text-[var(--th-text-muted)] hover:border-[var(--th-primary)] hover:text-[var(--th-primary)] transition-colors flex items-center justify-center gap-1.5">
        <span className="material-symbols-rounded text-[18px]">add</span>
        {t('skills.addCondition')}
      </button>
    </div>
  );
}
