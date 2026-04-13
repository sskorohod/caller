'use client';

import { useRouter } from 'next/navigation';
import { useT, useLang } from '@/lib/i18n';
import type { PromptPack } from '../_lib/types';
import { getCategory } from '../_lib/types';

interface Props {
  pack: PromptPack;
  onToggle: (pack: PromptPack) => void;
  onDelete: (pack: PromptPack) => void;
}

export default function PromptCard({ pack, onToggle, onDelete }: Props) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const category = getCategory(pack.category);

  const createdDate = new Date(pack.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const categoryLabel = lang === 'ru' ? category.labelRu : category.labelEn;
  const contentPreview =
    pack.content.length > 80 ? pack.content.slice(0, 80) + '...' : pack.content;

  return (
    <div
      onClick={() => router.push(`/dashboard/prompts/${pack.id}/edit`)}
      className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-4 md:p-5 hover:border-[var(--th-border)] hover:shadow-[0_4px_16px_var(--th-card-glow)] transition-shadow group shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] cursor-pointer"
    >
      {/* Header: icon + toggle + delete */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: category.gradient }}
        >
          <span className="material-symbols-outlined text-white text-xl">
            {category.icon}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={pack.is_active}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(pack);
            }}
            className={`relative w-10 h-6 rounded-full transition-colors ${
              pack.is_active
                ? 'bg-[var(--th-primary)]'
                : 'bg-[var(--th-border)]'
            }`}
          >
            <span
              className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-transform shadow-sm"
              style={{ left: pack.is_active ? '19px' : '3px' }}
            />
          </button>

          {/* Delete button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(pack);
            }}
            className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-[var(--th-text-secondary)] hover:text-red-500 hover:bg-[var(--th-surface)]"
            title={t('common.delete')}
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </div>
      </div>

      {/* Name */}
      <h3 className="font-semibold text-sm text-[var(--th-text)] mb-1 truncate">
        {pack.name}
      </h3>

      {/* Description */}
      <p className="text-xs text-[var(--th-text-muted)] line-clamp-2 mb-3 min-h-[2lh]">
        {pack.description || '\u00A0'}
      </p>

      {/* Content preview */}
      <div className="bg-[var(--th-surface)] rounded-lg px-3 py-2 mb-3">
        <p className="text-xs font-mono text-[var(--th-text-secondary)] truncate">
          {contentPreview}
        </p>
      </div>

      {/* Footer: category pill + date */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--th-card-border-subtle)]">
        <span
          className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: category.color + '26',
            color: category.color,
          }}
        >
          {categoryLabel}
        </span>

        <span className="text-[10px] text-[var(--th-text-muted)]">
          {createdDate}
        </span>
      </div>
    </div>
  );
}
