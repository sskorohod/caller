'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT, useLang } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { useIsMobile } from '@/lib/useBreakpoint';
import FloatingActionButton from '@/components/FloatingActionButton';
import MobilePageHeader from '@/components/MobilePageHeader';
import type { SkillPack } from './_lib/types';
import { getCategoryForIntent, SKILL_CATEGORIES } from './_lib/constants';
import SkillCard from './_components/SkillCard';
import SkillFilters from './_components/SkillFilters';

export default function SkillsPage() {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [packs, setPacks] = useState<SkillPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SkillPack | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');

  function loadPacks() {
    setLoadError('');
    api.get<{ skill_packs: SkillPack[] }>('/skill-packs')
      .then(r => setPacks(r.skill_packs ?? []))
      .catch((err: unknown) => setLoadError((err as Error)?.message ?? 'Failed to load skill packs'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPacks(); }, []);

  // Filter logic
  const filtered = useMemo(() => {
    let result = packs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        p.intent.toLowerCase().includes(q)
      );
    }
    if (category !== 'all') {
      result = result.filter(p => getCategoryForIntent(p.intent).id === category);
    }
    if (status === 'active') result = result.filter(p => p.is_active);
    if (status === 'inactive') result = result.filter(p => !p.is_active);
    return result;
  }, [packs, search, category, status]);

  async function handleToggle(id: string, active: boolean) {
    try {
      await api.patch(`/skill-packs/${id}`, { is_active: active });
      loadPacks();
    } catch { /* ignore */ }
  }

  async function handleDuplicate(pack: SkillPack) {
    try {
      await api.post('/skill-packs', {
        name: pack.name + ' (Copy)',
        description: pack.description,
        intent: pack.intent + '_copy',
        conversation_rules: pack.conversation_rules,
        activation_rules: pack.activation_rules,
        required_data: pack.required_data,
        tool_sequence: pack.tool_sequence,
        allowed_tools: pack.allowed_tools,
        escalation_conditions: pack.escalation_conditions,
        completion_criteria: pack.completion_criteria,
      });
      toast.success(t('skills.duplicated'));
      loadPacks();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/skill-packs/${deleteTarget.id}`);
      toast.success(t('skills.deleted'));
      setDeleteTarget(null);
      setDeleteError('');
      loadPacks();
    } catch (err: unknown) {
      setDeleteError((err as Error).message);
    }
  }

  return (
    <div className="space-y-3 md:space-y-5">
      {/* Mobile header */}
      <MobilePageHeader title={t('skills.title')} subtitle={t('skills.subtitle')} />

      {/* Desktop header */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 flex items-center justify-center shadow-[0_2px_8px_var(--th-shadow-primary)]">
            <span className="material-symbols-outlined text-white text-xl">bolt</span>
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-[var(--th-text)]">{t('skills.title')}</h2>
            <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{t('skills.subtitle')}</p>
          </div>
        </div>
        <button onClick={() => router.push('/dashboard/skills/new')}
          className="px-4 py-2.5 btn-primary shadow-lg shadow-[var(--th-shadow-primary)] flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('skills.newPack')}
        </button>
      </div>

      {/* Filters */}
      {!loading && packs.length > 0 && (
        <SkillFilters search={search} onSearchChange={setSearch} category={category} onCategoryChange={setCategory}
          status={status} onStatusChange={setStatus} lang={lang} />
      )}

      {/* Content */}
      {loadError ? (
        <div className="bg-[var(--th-error-bg)] border border-[var(--th-card-border-subtle)] rounded-2xl p-4 md:p-6 text-center shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <p className="text-sm font-medium text-[var(--th-error-text)]">{loadError}</p>
          <button onClick={loadPacks} className="mt-3 px-4 py-2 text-sm font-medium text-[var(--th-error-text)] hover:bg-[var(--th-error-bg)] rounded-lg transition-colors">{t('common.retry')}</button>
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
      ) : packs.length === 0 ? (
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] flex flex-col items-center justify-center py-20 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <div className="w-14 h-14 bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-[0_4px_16px_var(--th-shadow-primary)]">
            <span className="material-symbols-outlined text-white text-2xl">bolt</span>
          </div>
          <p className="text-sm font-semibold text-[var(--th-text-secondary)]">{t('skills.noPacks')}</p>
          <p className="text-xs text-[var(--th-text-muted)] mt-1 mb-4">{t('skills.noPacksDesc')}</p>
          <button onClick={() => router.push('/dashboard/skills/new')} className="px-4 py-2 btn-primary">{t('skills.createFirst')}</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] py-12 text-center shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <p className="text-sm text-[var(--th-text-muted)]">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
          {filtered.map(pack => (
            <SkillCard key={pack.id} pack={pack}
              onToggle={handleToggle}
              onDuplicate={handleDuplicate}
              onDelete={setDeleteTarget} />
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
                <h3 className="text-base font-semibold text-[var(--th-text)]">{t('skills.deletePack')}</h3>
                <p className="text-sm text-[var(--th-text-muted)] mt-1">{t('skills.deleteConfirm', { name: deleteTarget.name })}</p>
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
        label={t('skills.newPack')}
        onClick={() => router.push('/dashboard/skills/new')}
      />
    </div>
  );
}
