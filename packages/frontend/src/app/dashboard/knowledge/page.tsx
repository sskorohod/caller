'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { useIsMobile } from '@/lib/useBreakpoint';
import FloatingActionButton from '@/components/FloatingActionButton';
import MobilePageHeader from '@/components/MobilePageHeader';
import type { KnowledgeBase } from './_lib/types';
import KBCard from './_components/KBCard';

export default function KnowledgePage() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  // Create KB modal
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBase | null>(null);
  const [deleteError, setDeleteError] = useState('');

  function load() {
    setLoadError('');
    api.get<{ knowledge_bases: KnowledgeBase[] }>('/knowledge')
      .then(r => setBases(r.knowledge_bases ?? []))
      .catch((err: unknown) => setLoadError((err as Error)?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Filter
  const filtered = useMemo(() => {
    if (!search) return bases;
    const q = search.toLowerCase();
    return bases.filter(kb =>
      kb.name.toLowerCase().includes(q) ||
      (kb.description ?? '').toLowerCase().includes(q)
    );
  }, [bases, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/knowledge', { name, description: desc || undefined });
      toast.success(t('knowledge.created'));
      setShowCreate(false);
      setName(''); setDesc('');
      load();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally { setSaving(false); }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/knowledge/${deleteTarget.id}`);
      toast.success(t('knowledge.deleted'));
      setDeleteTarget(null);
      setDeleteError('');
      load();
    } catch (err: unknown) {
      setDeleteError((err as Error).message);
    }
  }

  return (
    <div className="space-y-3 md:space-y-5">
      {/* Mobile header */}
      <MobilePageHeader title={t('knowledge.title')} subtitle={t('knowledge.subtitle')} />

      {/* Desktop header */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 flex items-center justify-center shadow-[0_2px_8px_var(--th-shadow-primary)]">
            <span className="material-symbols-outlined text-white text-xl">auto_stories</span>
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-[var(--th-text)]">{t('knowledge.title')}</h2>
            <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{t('knowledge.subtitle')}</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 btn-primary shadow-lg shadow-[var(--th-shadow-primary)] flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('knowledge.newKB')}
        </button>
      </div>

      {/* Search */}
      {!loading && bases.length > 0 && (
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('knowledge.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all max-w-md" />
        </div>
      )}

      {/* Content */}
      {loadError ? (
        <div className="bg-[var(--th-error-bg)] border border-[var(--th-card-border-subtle)] rounded-2xl p-4 md:p-6 text-center shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <p className="text-sm font-medium text-[var(--th-error-text)]">{loadError}</p>
          <button onClick={load} className="mt-3 px-4 py-2 text-sm font-medium text-[var(--th-error-text)] hover:bg-[var(--th-error-bg)] rounded-lg transition-colors">{t('common.retry')}</button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-4 md:p-5 animate-pulse space-y-3 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
              <div className="w-10 h-10 bg-[var(--th-skeleton)] rounded-xl" />
              <div className="h-4 bg-[var(--th-skeleton)] rounded-lg w-2/3" />
              <div className="h-3 bg-[var(--th-skeleton)] rounded-lg w-1/2" />
            </div>
          ))}
        </div>
      ) : bases.length === 0 ? (
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] flex flex-col items-center justify-center py-20 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <div className="w-14 h-14 bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-[0_4px_16px_var(--th-shadow-primary)]">
            <span className="material-symbols-outlined text-white text-2xl">auto_stories</span>
          </div>
          <p className="text-sm font-semibold text-[var(--th-text-secondary)]">{t('knowledge.noBases')}</p>
          <p className="text-xs text-[var(--th-text-muted)] mt-1 mb-4">{t('knowledge.noBasesDesc')}</p>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 btn-primary">{t('knowledge.createKB')}</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] py-12 text-center shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <p className="text-sm text-[var(--th-text-muted)]">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
          {filtered.map(kb => (
            <KBCard key={kb.id} kb={kb} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {/* Create KB Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)} role="dialog" aria-modal="true">
          <div className="bg-[var(--th-modal)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--th-card-border-subtle)]">
              <h2 className="text-base font-semibold text-[var(--th-text)]">{t('knowledge.newKB')}</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-[var(--th-surface)] rounded-lg" aria-label="Close">
                <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('knowledge.name')} *</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder={t('knowledge.kbNamePlaceholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('knowledge.description')}</label>
                <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('knowledge.kbDescPlaceholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} className="px-4 py-2.5 btn-primary disabled:opacity-60">
                  {saving ? t('knowledge.creating') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
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
                <h3 className="text-base font-semibold text-[var(--th-text)]">{t('knowledge.deleteKB')}</h3>
                <p className="text-sm text-[var(--th-text-muted)] mt-1">{t('knowledge.deleteConfirm')}</p>
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
        label={t('knowledge.newKB')}
        onClick={() => setShowCreate(true)}
      />
    </div>
  );
}
