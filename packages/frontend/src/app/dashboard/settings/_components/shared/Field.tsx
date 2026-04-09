'use client';
import { useState } from 'react';
import { IconEye, IconEyeOff } from '../../_lib/icons';

export function Field({
  label, value, onChange, placeholder, type = 'text', hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  const isSecret = type === 'password';
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{label}</label>
      <div className="relative">
        <input
          type={isSecret && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)]
                     placeholder:text-[var(--th-text-muted)] bg-[var(--th-card)]
                     focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]
                     transition-all pr-10"
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--th-text-muted)] hover:text-[var(--th-text-secondary)] transition-colors"
            aria-label={show ? 'Hide value' : 'Show value'}
          >
            {show ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-[var(--th-text-secondary)]">{hint}</p>}
    </div>
  );
}
