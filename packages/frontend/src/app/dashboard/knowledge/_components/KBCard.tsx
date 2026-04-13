'use client';

import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';
import type { KnowledgeBase } from '../_lib/types';

interface Props {
  kb: KnowledgeBase;
  onDelete: (kb: KnowledgeBase) => void;
}

export default function KBCard({ kb, onDelete }: Props) {
  const router = useRouter();
  const t = useT();

  const createdDate = new Date(kb.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      onClick={() => router.push(`/dashboard/knowledge/${kb.id}`)}
      className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-4 md:p-5 hover:border-[var(--th-border)] hover:shadow-[0_4px_16px_var(--th-card-glow)] transition-shadow group shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] cursor-pointer"
    >
      {/* Header: icon + delete */}
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-[var(--th-primary)] to-indigo-600">
          <span className="material-symbols-outlined text-white text-xl">auto_stories</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(kb);
          }}
          className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-[var(--th-text-secondary)] hover:text-red-500 hover:bg-[var(--th-surface)]"
          title={t('common.delete')}
        >
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>

      {/* Name */}
      <h3 className="font-semibold text-sm text-[var(--th-text)] mb-1 truncate">
        {kb.name}
      </h3>

      {/* Description */}
      <p className="text-xs text-[var(--th-text-muted)] line-clamp-2 mb-3 min-h-[2lh]">
        {kb.description || '\u00A0'}
      </p>

      {/* Footer: doc count + date */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--th-card-border-subtle)]">
        <span
          className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: 'var(--th-primary-bg)',
            color: 'var(--th-primary-text)',
          }}
        >
          {kb.document_count} {kb.document_count === 1 ? 'doc' : 'docs'}
        </span>

        <span className="text-[10px] text-[var(--th-text-muted)]">{createdDate}</span>
      </div>
    </div>
  );
}
