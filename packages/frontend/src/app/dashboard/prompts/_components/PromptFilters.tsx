'use client';

import { useT } from '@/lib/i18n';
import { PROMPT_CATEGORIES } from '../_lib/types';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  lang: string;
}

const STATUS_OPTIONS: { value: string; labelEn: string; labelRu: string }[] = [
  { value: '', labelEn: 'All', labelRu: 'Все' },
  { value: 'active', labelEn: 'Active', labelRu: 'Активные' },
  { value: 'inactive', labelEn: 'Inactive', labelRu: 'Неактивные' },
];

export default function PromptFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  lang,
}: Props) {
  const t = useT();

  const pillClass = (active: boolean) =>
    `shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
      active
        ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white shadow-sm'
        : 'bg-[var(--th-surface)] text-[var(--th-text-secondary)] hover:bg-[var(--th-surface-hover)]'
    }`;

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
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
          placeholder={t('prompts.searchPlaceholder')}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:border-[var(--th-primary)] transition-colors"
        />
      </div>

      {/* Category + Status pills */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => onCategoryChange('')}
            className={pillClass(category === '')}
          >
            {lang === 'ru' ? 'Все' : 'All'}
          </button>

          {PROMPT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={pillClass(category === cat.id)}
            >
              <span className="material-symbols-rounded text-sm leading-none">{cat.icon}</span>
              {lang === 'ru' ? cat.labelRu : cat.labelEn}
            </button>
          ))}
        </div>

        {/* Status pills */}
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStatusChange(opt.value)}
              className={pillClass(status === opt.value)}
            >
              {lang === 'ru' ? opt.labelRu : opt.labelEn}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
