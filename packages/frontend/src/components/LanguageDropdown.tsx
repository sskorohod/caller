'use client';
import { useState, useRef, useEffect } from 'react';

export interface LangOption {
  value: string;
  label: string;
}

const DEFAULT_OPTIONS: LangOption[] = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
];

type Variant = 'landing' | 'sidebar' | 'card';

interface VariantStyles {
  trigger: string;
  menu: string;
  item: string;
  itemActive: string;
}

// Three theme contexts: the always-dark public landing pages, the always-dark
// dashboard sidebar (--th-sidebar-* vars), and the theme-aware settings cards
// (--th-* vars). Classes only (no inline styles) so :hover works.
const STYLES: Record<Variant, VariantStyles> = {
  landing: {
    trigger:
      'bg-[rgba(140,144,159,0.08)] border border-[rgba(140,144,159,0.14)] text-[#a0a8c0] hover:text-white hover:border-[#4d8eff]',
    menu: 'bg-[#15151b] border border-[rgba(140,144,159,0.18)] shadow-[0_12px_32px_rgba(0,0,0,0.5)]',
    item: 'text-[#a0a8c0] hover:bg-[rgba(255,255,255,0.05)] hover:text-white',
    itemActive: 'bg-[rgba(129,140,248,0.16)] text-white',
  },
  sidebar: {
    trigger:
      'bg-[var(--th-sidebar-hover)] border border-[var(--th-sidebar-border)] text-white hover:border-[var(--th-primary)]',
    menu: 'bg-[var(--th-sidebar)] border border-[var(--th-sidebar-border)] shadow-[0_12px_32px_rgba(0,0,0,0.5)]',
    item: 'text-[var(--th-sidebar-text)] hover:bg-[var(--th-sidebar-hover)] hover:text-white',
    itemActive: 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white',
  },
  card: {
    trigger:
      'bg-[var(--th-surface)] border border-[var(--th-border)] text-[var(--th-text)] hover:border-[var(--th-primary)]',
    menu: 'bg-[var(--th-card)] border border-[var(--th-border)] shadow-[0_12px_32px_var(--th-shadow)]',
    item: 'text-[var(--th-text)] hover:bg-[var(--th-surface-hover)]',
    itemActive: 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]',
  },
};

interface Props {
  value: string;
  onChange: (v: string) => void;
  variant?: Variant;
  options?: LangOption[];
  /** menu opens upward (e.g. near the bottom of the sidebar) */
  drop?: 'down' | 'up';
  /** menu edge aligned to the trigger */
  align?: 'start' | 'end';
  /** forwarded to the wrapper — controls width / margins at the call site */
  className?: string;
}

export default function LanguageDropdown({
  value,
  onChange,
  variant = 'card',
  options = DEFAULT_OPTIONS,
  drop = 'down',
  align = 'start',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const s = STYLES[variant];
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex w-full items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${s.trigger}`}
      >
        <span className="material-symbols-outlined text-sm leading-none">language</span>
        <span>{current.label}</span>
        <svg
          className="w-3.5 h-3.5 shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-50 min-w-[152px] py-1 rounded-xl overflow-hidden ${
            align === 'end' ? 'right-0' : 'left-0'
          } ${drop === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} ${s.menu}`}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                  active ? s.itemActive : s.item
                }`}
              >
                {o.label}
                {active && (
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
