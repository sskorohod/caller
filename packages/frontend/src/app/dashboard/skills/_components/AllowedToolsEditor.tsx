'use client';

import { useState, type KeyboardEvent } from 'react';
import { useT } from '@/lib/i18n';

interface Props {
  tools: string[];
  onChange: (tools: string[]) => void;
}

export default function AllowedToolsEditor({ tools, onChange }: Props) {
  const t = useT();
  const [input, setInput] = useState('');

  const add = () => {
    const name = input.trim();
    if (!name || tools.includes(name)) return;
    onChange([...tools, name]);
    setInput('');
  };

  const remove = (idx: number) => onChange(tools.filter((_, i) => i !== idx));

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
  };

  const inputCls = 'w-full rounded-lg border border-[var(--th-border)] bg-[var(--th-surface)]' +
    ' text-[var(--th-text)] text-sm px-3 py-2 outline-none focus:border-[var(--th-primary)]' +
    ' transition-colors placeholder:text-[var(--th-text-muted)]';

  return (
    <div className="rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-4 space-y-3">
      {/* Pills */}
      {tools.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tools.map((tool, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[var(--th-primary)]/15 text-[var(--th-primary)] text-xs font-medium px-2.5 py-1">
              {tool}
              <button type="button" onClick={() => remove(i)} className="hover:opacity-70 text-[var(--th-primary)]">&times;</button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        className={inputCls}
        placeholder={t('skills.addTool')}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
      />
    </div>
  );
}
