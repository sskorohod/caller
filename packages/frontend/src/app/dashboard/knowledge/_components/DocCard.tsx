'use client';

import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';
import type { KBDocument } from '../_lib/types';
import { getDocType } from '../_lib/types';

interface Props {
  doc: KBDocument;
  kbId: string;
  onDelete: (doc: KBDocument) => void;
}

export default function DocCard({ doc, kbId, onDelete }: Props) {
  const router = useRouter();
  const t = useT();
  const docType = getDocType(doc.doc_type);
  const preview = doc.content?.length > 100 ? doc.content.slice(0, 100) + '...' : (doc.content ?? '');

  return (
    <div
      className="group flex items-center gap-4 bg-[var(--th-card)] rounded-2xl border border-white/10 p-4 shadow-md shadow-black/5 hover:shadow-lg hover:shadow-black/10 cursor-pointer transition-all"
      onClick={() => router.push(`/dashboard/knowledge/${kbId}/docs/${doc.id}`)}
    >
      {/* Icon badge */}
      <div
        className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full"
        style={{ backgroundColor: `${docType.color}26` }}
      >
        <span className="material-symbols-outlined text-lg" style={{ color: docType.color }}>
          {docType.icon}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{doc.title}</p>
        {preview && (
          <p className="text-xs text-[var(--th-muted)] line-clamp-1 mt-0.5">{preview}</p>
        )}
      </div>

      {/* Type pill */}
      <span
        className="flex-shrink-0 text-[11px] font-medium px-2.5 py-0.5 rounded-full"
        style={{ backgroundColor: `${docType.color}26`, color: docType.color }}
      >
        {docType.labelEn}
      </span>

      {/* Date */}
      <span className="flex-shrink-0 text-xs text-[var(--th-muted)] whitespace-nowrap">
        {new Date(doc.created_at).toLocaleDateString()}
      </span>

      {/* Delete button */}
      <button
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-500/10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(doc);
        }}
        title={t('common.delete')}
      >
        <span className="material-symbols-outlined text-lg">delete</span>
      </button>
    </div>
  );
}
