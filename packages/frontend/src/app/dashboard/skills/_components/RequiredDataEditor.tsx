'use client';

import { useT } from '@/lib/i18n';
import type { RequiredDataItem } from '../_lib/types';
import { DATA_FIELD_TYPES } from '../_lib/constants';

interface Props {
  items: RequiredDataItem[];
  onChange: (items: RequiredDataItem[]) => void;
}

export default function RequiredDataEditor({ items, onChange }: Props) {
  const t = useT();

  const update = (idx: number, patch: Partial<RequiredDataItem>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const add = () => {
    onChange([...items, { name: '', type: 'text', required: true, description: '' }]);
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
      {items.map((item, idx) => (
        <div key={idx} className={cardCls}>
          {/* Delete button */}
          <button type="button" onClick={() => remove(idx)}
            className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--th-error-text)] bg-[var(--th-error-bg)] hover:opacity-80 transition-opacity">
            <span className="material-symbols-rounded text-[16px]">delete</span>
          </button>

          {/* Name + Type */}
          <div className="grid grid-cols-2 gap-3 mb-3 pr-10">
            <div>
              <label className={labelCls}>{t('skills.fieldName')}</label>
              <input className={inputCls} placeholder="full_name" value={item.name}
                onChange={e => update(idx, { name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>{t('skills.fieldType')}</label>
              <select className={inputCls} value={item.type}
                onChange={e => update(idx, { type: e.target.value })}>
                {DATA_FIELD_TYPES.map(ft => (
                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="mb-3">
            <label className={labelCls}>{t('skills.fieldDesc')}</label>
            <input className={inputCls} placeholder="Describe what to ask the caller"
              value={item.description} onChange={e => update(idx, { description: e.target.value })} />
          </div>

          {/* Required toggle */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider font-semibold text-[var(--th-text-muted)]">
              {t('skills.required')}
            </label>
            <button type="button" onClick={() => update(idx, { required: !item.required })}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                item.required ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'
              }`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                item.required ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      ))}

      <button type="button" onClick={add}
        className="w-full h-10 rounded-xl border border-dashed border-[var(--th-border)] text-sm font-semibold text-[var(--th-text-muted)] hover:border-[var(--th-primary)] hover:text-[var(--th-primary)] transition-colors flex items-center justify-center gap-1.5">
        <span className="material-symbols-rounded text-[18px]">add</span>
        {t('skills.addField')}
      </button>
    </div>
  );
}
