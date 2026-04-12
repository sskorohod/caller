'use client';

import { useT } from '@/lib/i18n';
import { SKILL_CATEGORIES } from '../_lib/constants';

interface SkillFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  status: 'all' | 'active' | 'inactive';
  onStatusChange: (v: 'all' | 'active' | 'inactive') => void;
  lang: string;
}

const STATUS_OPTIONS: { value: 'all' | 'active' | 'inactive'; labelEn: string; labelRu: string }[] = [
  { value: 'all', labelEn: 'All', labelRu: 'Все' },
  { value: 'active', labelEn: 'Active', labelRu: 'Активные' },
  { value: 'inactive', labelEn: 'Inactive', labelRu: 'Неактивные' },
];

export default function SkillFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  lang,
}: SkillFiltersProps) {
  const t = useT();

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
          placeholder={t('common.search')}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-[var(--th-surface)] border border-[var(--th-card-border-subtle)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:border-[var(--th-primary)] transition-colors"
        />
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onCategoryChange('all')}
          className="px-3 py-1 text-xs font-medium rounded-full transition-colors"
          style={{
            backgroundColor: category === 'all' ? 'var(--th-primary)' : 'var(--th-surface)',
            color: category === 'all' ? '#fff' : 'var(--th-text-secondary)',
          }}
        >
          {lang === 'ru' ? 'Все' : 'All'}
        </button>
        {SKILL_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.id)}
            className="px-3 py-1 text-xs font-medium rounded-full transition-colors"
            style={{
              backgroundColor: category === cat.id ? cat.color : 'var(--th-surface)',
              color: category === cat.id ? '#fff' : 'var(--th-text-secondary)',
            }}
          >
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
            className="px-3 py-1 text-[11px] font-medium rounded-full transition-colors"
            style={{
              backgroundColor: status === opt.value ? 'var(--th-primary-bg)' : 'var(--th-surface)',
              color: status === opt.value ? 'var(--th-primary-text)' : 'var(--th-text-secondary)',
            }}
          >
            {lang === 'ru' ? opt.labelRu : opt.labelEn}
          </button>
        ))}
      </div>
    </div>
  );
}
