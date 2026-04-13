'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT, useLang } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import type { PromptPack, PromptPackForm } from '../_lib/types';
import { PROMPT_CATEGORIES, getCategory } from '../_lib/types';
import type { PromptEditorSection } from '../_lib/constants';
import { SECTIONS, SECTION_KEYS, SECTION_ICONS, EMPTY_FORM } from '../_lib/constants';

// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  packId?: string; // undefined = create mode
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function packToForm(pack: PromptPack): PromptPackForm {
  return {
    name: pack.name,
    description: pack.description ?? '',
    content: pack.content ?? '',
    category: pack.category ?? 'general',
    is_active: pack.is_active,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function PromptEditor({ packId }: Props) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const router = useRouter();

  const isEdit = !!packId;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<PromptEditorSection>('general');
  const [form, setForm] = useState<PromptPackForm>(EMPTY_FORM);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load existing prompt pack
  useEffect(() => {
    if (!isEdit) return;
    api.get<PromptPack>(`/prompt-packs/${packId}`)
      .then(pack => {
        setForm(packToForm(pack));
        setLoading(false);
      })
      .catch((err: unknown) => {
        toast.error((err as Error).message || 'Failed to load prompt pack');
        router.push('/dashboard/prompts');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  // Helpers
  const set = <K extends keyof PromptPackForm>(key: K, value: PromptPackForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // Save
  async function handleSave() {
    if (!form.name.trim() || !form.content.trim()) {
      toast.error('Name and Content are required');
      if (!form.name.trim()) setSection('general');
      else setSection('content');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        content: form.content,
        category: form.category || 'general',
        is_active: form.is_active,
      };
      if (isEdit) {
        await api.patch(`/prompt-packs/${packId}`, payload);
        toast.success(t('prompts.saved'));
      } else {
        await api.post('/prompt-packs', payload);
        toast.success(t('prompts.created'));
      }
      router.push('/dashboard/prompts');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // Delete
  async function handleDelete() {
    if (!packId) return;
    setDeleting(true);
    try {
      await api.delete(`/prompt-packs/${packId}`);
      toast.success(t('prompts.deleted'));
      router.push('/dashboard/prompts');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to delete');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  // ─── Section Renderers ───────────────────────────────────────────────────

  function renderGeneral() {
    return (
      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('prompts.name')} *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('prompts.namePlaceholder')} required
            className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('prompts.description')}</label>
          <input type="text" value={form.description} onChange={e => set('description', e.target.value)} placeholder={t('prompts.descPlaceholder')}
            className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all" />
        </div>

        {/* Category — pill selector */}
        <div>
          <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('prompts.category')}</label>
          <div className="flex flex-wrap gap-2">
            {PROMPT_CATEGORIES.map(cat => {
              const isActive = form.category === cat.id;
              const label = lang === 'ru' ? cat.labelRu : cat.labelEn;
              return (
                <button key={cat.id} type="button" onClick={() => set('category', cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
                      : 'bg-[var(--th-surface)] border border-[var(--th-card-border-subtle)] text-[var(--th-text-secondary)] hover:bg-[var(--th-card)] hover:text-[var(--th-text)]'
                  }`}
                  style={isActive ? { background: cat.gradient } : undefined}>
                  <span className="material-symbols-outlined text-base">{cat.icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-[var(--th-text)]">{t('prompts.active')}</label>
          <button type="button" onClick={() => set('is_active', !form.is_active)}
            className={`relative w-10 h-6 rounded-full transition-colors ${form.is_active ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'}`}>
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    );
  }

  function renderContent() {
    return (
      <div className="space-y-3">
        <div className="relative">
          <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('prompts.content')} *</label>
          <textarea value={form.content} onChange={e => set('content', e.target.value)} rows={20}
            placeholder={t('prompts.contentPlaceholder')}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all" />
          <div className="flex items-end justify-between mt-1">
            <p className="text-[10px] text-[var(--th-text-muted)]">{t('prompts.contentHint')}</p>
            <span className="text-xs text-[var(--th-text-muted)]">{form.content.length}</span>
          </div>
        </div>
      </div>
    );
  }

  const RENDER_MAP: Record<PromptEditorSection, () => React.ReactNode> = {
    general: renderGeneral,
    content: renderContent,
  };

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-[var(--th-text-muted)]">{t('common.loading')}</div>
      </div>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 md:px-5 py-3 border-b border-[var(--th-card-border-subtle)] bg-[var(--th-card)] shadow-[0_1px_3px_var(--th-shadow)]">
        <button type="button" onClick={() => router.push('/dashboard/prompts')}
          className="flex items-center gap-1.5 md:gap-2 text-sm text-[var(--th-text-secondary)] hover:text-[var(--th-text)] transition-all font-medium min-h-[44px]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          <span className="hidden md:inline">{t('prompts.backToPrompts')}</span>
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.push('/dashboard/prompts')}
            className="hidden md:inline-flex px-4 py-2 text-sm rounded-xl border border-[var(--th-card-border-subtle)] text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] transition-all font-medium min-h-[44px] items-center">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm min-h-[44px] btn-primary disabled:opacity-40">
            {saving ? t('prompts.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {/* Mobile tabs — ABOVE the flex body container (bug fix from skills editor) */}
      <div className="md:hidden flex overflow-x-auto border-b border-[var(--th-card-border-subtle)] bg-[var(--th-card)] px-2 py-1.5 gap-1 flex-shrink-0 scrollbar-none">
        {SECTIONS.map(s => (
          <button key={s} type="button" onClick={() => setSection(s)}
            className={`flex items-center gap-1 px-3 py-2 min-h-[44px] text-xs rounded-lg whitespace-nowrap transition-all ${
              section === s
                ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white font-semibold shadow-[0_2px_8px_var(--th-shadow-primary)]'
                : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)]'
            }`}>
            <span className="material-symbols-outlined text-base">{SECTION_ICONS[s]}</span>
            <span>{t(SECTION_KEYS[s])}</span>
          </button>
        ))}
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar — desktop */}
        <nav className="hidden md:flex flex-col w-52 border-r border-[var(--th-card-border-subtle)] bg-[var(--th-card)] py-3 flex-shrink-0">
          {SECTIONS.map(s => (
            <button key={s} type="button" onClick={() => setSection(s)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-all mx-2 rounded-xl ${
                section === s
                  ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white font-semibold shadow-[0_2px_8px_var(--th-shadow-primary)]'
                  : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] hover:text-[var(--th-text)]'
              }`}>
              <span className="material-symbols-outlined text-lg">{SECTION_ICONS[s]}</span>
              <span>{t(SECTION_KEYS[s])}</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-3 py-3 md:px-4 md:py-4 lg:p-6">
            {RENDER_MAP[section]()}

            {/* Delete zone */}
            {isEdit && (
              <div className="mt-12 pt-6 border-t border-[var(--th-card-border-subtle)]">
                <button type="button" onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 text-sm rounded-xl border border-[var(--th-card-border-subtle)] text-[var(--th-error-text)] hover:bg-[var(--th-error-bg)] transition-all font-medium">
                  {t('prompts.deletePack')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--th-card)] rounded-t-2xl md:rounded-2xl p-4 md:p-6 w-full md:max-w-sm md:mx-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)]">
            <div className="w-11 h-11 bg-[var(--th-error-bg)] rounded-xl flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-[var(--th-error-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--th-text)] mb-2">{t('prompts.deletePack')}</h3>
            <p className="text-sm text-[var(--th-text-secondary)] mb-6">{t('prompts.deleteConfirm', { name: form.name })}</p>
            <div className="flex flex-col-reverse md:flex-row md:justify-end gap-2">
              <button type="button" onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 min-h-[44px] text-sm rounded-xl border border-[var(--th-card-border-subtle)] text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] transition-all">
                {t('common.cancel')}
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="px-4 py-2.5 min-h-[44px] text-sm rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)] disabled:opacity-40 transition-all font-semibold">
                {deleting ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
