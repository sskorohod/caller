'use client';

import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';
import type { SkillPack } from '../_lib/types';
import { getCategoryForIntent } from '../_lib/constants';

interface SkillCardProps {
  pack: SkillPack;
  onToggle: (id: string, active: boolean) => void;
  onDuplicate: (pack: SkillPack) => void;
  onDelete: (pack: SkillPack) => void;
}

export default function SkillCard({ pack, onToggle, onDuplicate, onDelete }: SkillCardProps) {
  const router = useRouter();
  const t = useT();
  const category = getCategoryForIntent(pack.intent);

  const createdDate = new Date(pack.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      onClick={() => router.push(`/dashboard/skills/${pack.id}/edit`)}
      className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-4 md:p-5 hover:border-[var(--th-border)] hover:shadow-[0_4px_16px_var(--th-card-glow)] transition-shadow group shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] cursor-pointer"
    >
      {/* Header: icon + toggle */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: category.gradient }}
        >
          <span className="material-symbols-outlined text-white text-xl">{category.icon}</span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={pack.is_active}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(pack.id, !pack.is_active);
          }}
          className="relative w-9 h-[18px] rounded-full transition-colors shrink-0"
          style={{
            backgroundColor: pack.is_active ? 'var(--th-primary)' : 'var(--th-surface)',
          }}
        >
          <span
            className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform shadow-sm"
            style={{
              left: pack.is_active ? '20px' : '2px',
            }}
          />
        </button>
      </div>

      {/* Name */}
      <h3 className="font-semibold text-sm text-[var(--th-text)] mb-1 truncate">
        {pack.name}
      </h3>

      {/* Description */}
      <p className="text-xs text-[var(--th-text-muted)] line-clamp-2 mb-3 min-h-[2lh]">
        {pack.description || '\u00A0'}
      </p>

      {/* Intent badge */}
      <span
        className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-3"
        style={{
          backgroundColor: 'var(--th-primary-bg)',
          color: 'var(--th-primary-text)',
        }}
      >
        {pack.intent}
      </span>

      {/* Footer: date + actions */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--th-card-border-subtle)]">
        <span className="text-[10px] text-[var(--th-text-muted)]">{createdDate}</span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/skills/${pack.id}/edit`);
            }}
            className="p-1 rounded-md hover:bg-[var(--th-surface)] text-[var(--th-text-secondary)] hover:text-[var(--th-text)] transition-colors"
            title={t('common.edit')}
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(pack);
            }}
            className="p-1 rounded-md hover:bg-[var(--th-surface)] text-[var(--th-text-secondary)] hover:text-[var(--th-text)] transition-colors"
            title="Duplicate"
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(pack);
            }}
            className="p-1 rounded-md hover:bg-[var(--th-surface)] text-[var(--th-text-secondary)] hover:text-red-500 transition-colors"
            title={t('common.delete')}
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
