'use client';
import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT, useLang } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import FloatingActionButton from '@/components/FloatingActionButton';
import MobilePageHeader from '@/components/MobilePageHeader';
import type { KnowledgeBase, KBDocument } from '../_lib/types';
import DocCard from '../_components/DocCard';
import DocFilters from '../_components/DocFilters';

export default function KnowledgeDetailPage() {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const router = useRouter();
  const { id: kbId } = useParams<{ id: string }>();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [docs, setDocs] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [docType, setDocType] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<KBDocument | null>(null);
  const [deleteError, setDeleteError] = useState('');

  function loadData() {
    setLoadError('');
    Promise.all([
      api.get<{ knowledge_bases: KnowledgeBase[] }>('/knowledge'),
      api.get<{ documents: KBDocument[] }>(`/knowledge/${kbId}/documents`),
    ])
      .then(([kbRes, docRes]) => {
        const found = kbRes.knowledge_bases?.find(k => k.id === kbId);
        if (found) setKb(found);
        setDocs(docRes.documents ?? []);
      })
      .catch((err: unknown) => setLoadError((err as Error)?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, [kbId]);

  // Filter logic
  const filtered = useMemo(() => {
    let result = docs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q)
      );
    }
    if (docType) {
      result = result.filter(d => d.doc_type === docType);
    }
    return result;
  }, [docs, search, docType]);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/knowledge/documents/${deleteTarget.id}`);
      toast.success(t('knowledge.deleted'));
      setDeleteTarget(null);
      setDeleteError('');
      loadData();
    } catch (err: unknown) {
      setDeleteError((err as Error).message);
    }
  }

  return (
    <div className="space-y-3 md:space-y-5">
      {/* Mobile header */}
      <MobilePageHeader title={kb?.name ?? '...'} subtitle={kb?.description ?? undefined} />

      {/* Desktop header */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/knowledge')}
            className="p-2 hover:bg-[var(--th-surface)] rounded-lg transition-colors" aria-label="Back">
            <svg className="w-5 h-5 text-[var(--th-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 flex items-center justify-center shadow-[0_2px_8px_var(--th-shadow-primary)]">
            <span className="material-symbols-outlined text-white text-xl">auto_stories</span>
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-[var(--th-text)]">{kb?.name ?? '...'}</h2>
            {kb?.description && <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{kb.description}</p>}
          </div>
        </div>
        <button onClick={() => router.push(`/dashboard/knowledge/${kbId}/docs/new`)}
          className="px-4 py-2.5 btn-primary shadow-lg shadow-[var(--th-shadow-primary)] flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('knowledge.newDoc')}
        </button>
      </div>

      {/* Mobile back button */}
      <div className="md:hidden -mt-4 mb-2">
        <button onClick={() => router.push('/dashboard/knowledge')}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[var(--th-surface)] rounded-lg transition-colors" aria-label="Back">
          <svg className="w-5 h-5 text-[var(--th-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* Filters */}
      {!loading && docs.length > 0 && (
        <DocFilters search={search} onSearchChange={setSearch} docType={docType} onDocTypeChange={setDocType} lang={lang} />
      )}

      {/* Content */}
      {loadError ? (
        <div className="bg-[var(--th-error-bg)] border border-[var(--th-card-border-subtle)] rounded-2xl p-4 md:p-6 text-center shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <p className="text-sm font-medium text-[var(--th-error-text)]">{loadError}</p>
          <button onClick={loadData} className="mt-3 px-4 py-2 text-sm font-medium text-[var(--th-error-text)] hover:bg-[var(--th-error-bg)] rounded-lg transition-colors">{t('common.retry')}</button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-3 md:gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-4 md:p-5 animate-pulse h-20 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--th-skeleton)] rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[var(--th-skeleton)] rounded-lg w-2/3" />
                  <div className="h-3 bg-[var(--th-skeleton)] rounded-lg w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] flex flex-col items-center justify-center py-20 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <div className="w-14 h-14 bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-[0_4px_16px_var(--th-shadow-primary)]">
            <span className="material-symbols-outlined text-white text-2xl">description</span>
          </div>
          <p className="text-sm font-semibold text-[var(--th-text-secondary)]">{t('knowledge.noDocs')}</p>
          <p className="text-xs text-[var(--th-text-muted)] mt-1 mb-4">{t('knowledge.noDocsDesc')}</p>
          <button onClick={() => router.push(`/dashboard/knowledge/${kbId}/docs/new`)} className="px-4 py-2 btn-primary">{t('knowledge.newDoc')}</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] py-12 text-center shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <p className="text-sm text-[var(--th-text-muted)]">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:gap-4">
          {filtered.map(doc => (
            <DocCard key={doc.id} doc={doc} kbId={kbId} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)} role="dialog" aria-modal="true">
          <div className="bg-[var(--th-modal)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 space-y-4">
              <div className="w-12 h-12 bg-[var(--th-surface)] rounded-2xl flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--th-error-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--th-text)]">{t('knowledge.deleteDoc')}</h3>
                <p className="text-sm text-[var(--th-text-muted)] mt-1">{t('knowledge.deleteDocConfirm', { name: deleteTarget.title })}</p>
              </div>
              {deleteError && <p className="text-sm text-[var(--th-error-text)]">{deleteError}</p>}
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg transition-colors">{t('common.cancel')}</button>
                <button onClick={handleDeleteConfirm} className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)] text-white text-sm font-semibold rounded-lg transition-all">{t('common.delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      <FloatingActionButton
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>}
        label={t('knowledge.newDoc')}
        onClick={() => router.push(`/dashboard/knowledge/${kbId}/docs/new`)}
      />
    </div>
  );
}
