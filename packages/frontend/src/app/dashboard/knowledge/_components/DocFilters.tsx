'use client';

import { useT } from '@/lib/i18n';
import { DOC_TYPES } from '../_lib/types';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  docType: string;
  onDocTypeChange: (v: string) => void;
  lang: string;
}

export default function DocFilters({
  search,
  onSearchChange,
  docType,
  onDocTypeChange,
  lang,
}: Props) {
  const t = useT();

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-0">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--th-text-muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('knowledge.searchPlaceholder')}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-[var(--th-surface)] border border-[var(--th-card-border-subtle)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:border-[var(--th-primary)] transition-colors"
        />
      </div>

      {/* Doc type pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {/* All pill */}
        <button
          type="button"
          onClick={() => onDocTypeChange('')}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
            docType === ''
              ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white shadow-sm'
              : 'bg-[var(--th-surface)] text-[var(--th-text-secondary)] hover:bg-[var(--th-surface-hover)]'
          }`}
        >
          {t('knowledge.allTypes')}
        </button>

        {DOC_TYPES.map((dt) => (
          <button
            key={dt.value}
            type="button"
            onClick={() => onDocTypeChange(dt.value)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              docType === dt.value
                ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white shadow-sm'
                : 'bg-[var(--th-surface)] text-[var(--th-text-secondary)] hover:bg-[var(--th-surface-hover)]'
            }`}
          >
            <span className="material-symbols-rounded text-sm leading-none">{dt.icon}</span>
            {lang === 'ru' ? dt.labelRu : dt.labelEn}
          </button>
        ))}
      </div>
    </div>
  );
}
