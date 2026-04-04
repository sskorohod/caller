'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface PromptPack {
  id: string;
  name: string;
  description: string | null;
  content: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

interface PromptPackForm {
  name: string;
  description: string;
  content: string;
  category: string;
}

const EMPTY_FORM: PromptPackForm = { name: '', description: '', content: '', category: '' };

const CATEGORIES = ['greeting', 'objection', 'closing', 'qualification', 'follow-up', 'general'];

export default function PromptsPage() {
  const t = useT();
  const [packs, setPacks] = useState<PromptPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PromptPackForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PromptPack | null>(null);
  const [deleteError, setDeleteError] = useState('');

  function loadPacks() {
    setLoadError('');
    api.get<{ prompt_packs: PromptPack[] }>('/prompt-packs')
      .then(r => setPacks(r.prompt_packs ?? []))
      .catch((err: unknown) => setLoadError((err as Error)?.message ?? 'Failed to load prompt packs'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPacks(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        name: form.name,
        content: form.content,
      };
      if (form.description) payload.description = form.description;
      if (form.category) payload.category = form.category;

      if (editId) {
        await api.patch(`/prompt-packs/${editId}`, payload);
      } else {
        await api.post('/prompt-packs', payload);
      }
      closeModal();
      loadPacks();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(pack: PromptPack) {
    setEditId(pack.id);
    setForm({
      name: pack.name,
      description: pack.description ?? '',
      content: pack.content,
      category: pack.category ?? '',
    });
    setError('');
    setModal(true);
  }

  function closeModal() {
    setModal(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/prompt-packs/${deleteTarget.id}`);
      setDeleteTarget(null);
      setDeleteError('');
      loadPacks();
    } catch (err: unknown) {
      setDeleteError((err as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--th-text)]">{t('prompts.title')}</h2>
          <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{t('prompts.subtitle')}</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="px-4 py-2.5 bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-white text-sm font-semibold rounded-xl transition-all active:scale-[.98] shadow-lg shadow-[var(--th-shadow-primary)] flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('prompts.newPack')}
        </button>
      </div>

      {loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-red-700">{loadError}</p>
          <button onClick={loadPacks} className="mt-3 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 rounded-lg transition-colors">{t('common.retry')}</button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] p-5 animate-pulse space-y-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl" />
              <div className="h-4 bg-slate-100 rounded w-2/3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : packs.length === 0 ? (
        <div className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 bg-[var(--th-primary-bg)] rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--th-text-secondary)]">{t('prompts.noPacks')}</p>
          <p className="text-xs text-[var(--th-text-muted)] mt-1 mb-4">{t('prompts.noPacksDesc')}</p>
          <button onClick={() => setModal(true)} className="px-4 py-2 bg-[var(--th-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--th-primary-hover)] transition-colors">
            {t('prompts.createPack')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {packs.map(pack => (
            <div key={pack.id} className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-[var(--th-primary-bg)] rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                {pack.is_active && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--th-success-bg)] text-[var(--th-success-text)] text-[10px] font-medium">
                    <span className="w-1 h-1 rounded-full bg-[var(--th-success-icon)]" />
                    Active
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-[var(--th-text)] text-sm">{pack.name}</h3>
              {pack.description && (
                <p className="text-xs text-[var(--th-text-muted)] mt-1 line-clamp-2">{pack.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pack.category && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--th-primary-bg)] text-[var(--th-primary-text)] font-medium">{pack.category}</span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[10px] text-[var(--th-text-muted)]">
                  Created {new Date(pack.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(pack)}
                    className="p-1.5 rounded-lg hover:bg-[var(--th-surface)] text-[var(--th-text-muted)] hover:text-[var(--th-primary-text)] transition-colors"
                    aria-label="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => { setDeleteTarget(pack); setDeleteError(''); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--th-text-muted)] hover:text-red-500 transition-colors"
                    aria-label="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)} role="dialog" aria-modal="true">
          <div className="bg-[var(--th-modal)] rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 space-y-4">
              <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--th-text)]">{t('prompts.deletePack')}</h3>
                <p className="text-sm text-[var(--th-text-muted)] mt-1">{t('prompts.deleteConfirm', { name: deleteTarget.name })}</p>
              </div>
              {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg transition-colors">{t('common.cancel')}</button>
                <button onClick={handleDeleteConfirm} className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-all">{t('common.delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal} onKeyDown={e => e.key === 'Escape' && closeModal()} role="dialog" aria-modal="true">
          <div className="bg-[var(--th-modal)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--th-border)]">
              <h2 className="text-base font-semibold text-[var(--th-text)]">{editId ? t('prompts.editPack') : t('prompts.newPack')}</h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-[var(--th-surface)] rounded-lg" aria-label="Close">
                <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('prompts.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Appointment Booking Prompt"
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary-text)]/20 focus:border-[var(--th-primary-text)] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('prompts.description')}</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description of this prompt pack"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary-text)]/20 focus:border-[var(--th-primary-text)] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('prompts.category')}</label>
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] bg-[var(--th-input)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary-text)]/20 focus:border-[var(--th-primary-text)]"
                >
                  <option value="">{t('prompts.noCategory')}</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('prompts.content')}</label>
                <textarea
                  rows={6}
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Enter the prompt template content..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary-text)]/20 focus:border-[var(--th-primary-text)] transition-colors font-mono"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg transition-colors">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} className="px-4 py-2.5 bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-60">
                  {saving ? t('prompts.saving') : editId ? t('prompts.saveChanges') : t('prompts.createPack')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
