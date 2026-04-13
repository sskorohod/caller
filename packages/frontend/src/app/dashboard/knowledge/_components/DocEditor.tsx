'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import type { KBDocument } from '../_lib/types';
import { getDocType, DOC_TYPES } from '../_lib/types';
import type { DocForm } from '../_lib/constants';
import { DOC_SECTIONS, DOC_SECTION_KEYS, DOC_SECTION_ICONS, EMPTY_DOC_FORM } from '../_lib/constants';
import type { DocEditorSection } from '../_lib/constants';

// ─── Props ─────────────────────────────────────────────────────────────────

interface DocEditorProps {
  kbId: string;
  docId?: string; // undefined = create mode
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function DocEditor({ kbId, docId }: DocEditorProps) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();

  const isEdit = !!docId;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<DocEditorSection>('content');
  const [form, setForm] = useState<DocForm>({ ...EMPTY_DOC_FORM });
  const [enhancing, setEnhancing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [kbName, setKbName] = useState('');

  // Load existing doc
  useEffect(() => {
    if (!isEdit) return;
    api.get<KBDocument>(`/knowledge/documents/${docId}`)
      .then(doc => {
        setForm({
          title: doc.title,
          content: doc.content,
          doc_type: doc.doc_type,
          source_url: doc.source_url ?? '',
        });
        setLoading(false);
      })
      .catch((err: unknown) => {
        toast.error((err as Error).message || 'Failed to load document');
        router.push(`/dashboard/knowledge/${kbId}`);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  // Load KB name for breadcrumb
  useEffect(() => {
    api.get<{ knowledge_bases: { id: string; name: string }[] }>('/knowledge')
      .then(r => {
        const kb = r.knowledge_bases?.find(k => k.id === kbId);
        if (kb) setKbName(kb.name);
      })
      .catch(() => {});
  }, [kbId]);

  // Helpers
  const set = <K extends keyof DocForm>(key: K, value: DocForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // AI Enhance
  async function handleEnhance() {
    if (!form.content.trim()) return;
    setEnhancing(true);
    setSuggestions([]);
    try {
      const r = await api.post<{ enhanced_content: string; suggestions: string[] }>(
        '/knowledge/enhance',
        { content: form.content, doc_type: form.doc_type },
      );
      if (r?.enhanced_content) set('content', r.enhanced_content);
      if (r?.suggestions?.length) setSuggestions(r.suggestions);
      toast.success(t('knowledge.enhanced'));
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Enhancement failed');
    } finally {
      setEnhancing(false);
    }
  }

  // Save
  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('Title is required');
      setSection('content');
      return;
    }
    if (!form.content.trim()) {
      toast.error('Content is required');
      setSection('content');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/knowledge/documents/${docId}`, {
          title: form.title,
          content: form.content,
          doc_type: form.doc_type,
        });
        toast.success(t('knowledge.saved'));
      } else {
        await api.post(`/knowledge/${kbId}/documents`, {
          title: form.title,
          content: form.content,
          doc_type: form.doc_type,
        });
        toast.success(t('knowledge.created'));
      }
      router.push(`/dashboard/knowledge/${kbId}`);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // Delete
  async function handleDelete() {
    if (!docId) return;
    setDeleting(true);
    try {
      await api.delete(`/knowledge/documents/${docId}`);
      toast.success(t('knowledge.deleted'));
      router.push(`/dashboard/knowledge/${kbId}`);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to delete');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  // ─── Section Renderers ───────────────────────────────────────────────────

  function renderContent() {
    const docType = getDocType(form.doc_type);

    return (
      <div className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('knowledge.docTitle')} *</label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder={t('knowledge.titlePlaceholder')} required
            className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all" />
        </div>

        {/* Doc Type */}
        <div>
          <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('knowledge.docType')}</label>
          <div className="flex flex-wrap gap-2">
            {DOC_TYPES.map(dt => (
              <button key={dt.value} type="button" onClick={() => set('doc_type', dt.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                  form.doc_type === dt.value
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-[var(--th-card-border-subtle)] text-[var(--th-text-secondary)] bg-[var(--th-surface)] hover:bg-[var(--th-card)]'
                }`}
                style={form.doc_type === dt.value ? { background: `linear-gradient(135deg, ${dt.color}, ${dt.color}cc)` } : undefined}>
                <span className="material-symbols-outlined text-sm">{dt.icon}</span>
                {dt.value}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{t('knowledge.docContent')} *</label>
            <button type="button" onClick={handleEnhance} disabled={enhancing || !form.content.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md">
              {enhancing ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
              )}
              {enhancing ? t('knowledge.enhancing') : t('knowledge.enhance')}
            </button>
          </div>
          <p className="text-[10px] text-[var(--th-text-muted)] mb-2">{t('knowledge.enhanceHint')}</p>
          <textarea value={form.content} onChange={e => { set('content', e.target.value); setSuggestions([]); }} rows={16}
            placeholder={t('knowledge.contentPlaceholder')} required
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all leading-relaxed" />
        </div>

        {/* AI Suggestions */}
        {suggestions.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">{t('knowledge.suggestions')}</p>
            </div>
            <ul className="space-y-1">
              {suggestions.map((s, i) => (
                <li key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <span className="mt-0.5 flex-shrink-0">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  function renderMetadata() {
    return (
      <div className="space-y-5">
        {/* Source URL */}
        <div>
          <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('knowledge.sourceUrl')}</label>
          <input type="url" value={form.source_url} onChange={e => set('source_url', e.target.value)} placeholder={t('knowledge.sourceUrlPlaceholder')}
            className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all" />
        </div>

        {/* Document Info (read-only in edit mode) */}
        {isEdit && (
          <div className="bg-[var(--th-surface)] rounded-xl p-4 space-y-3 border border-[var(--th-card-border-subtle)]">
            <h4 className="text-xs font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">Document Info</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-[var(--th-text-muted)] mb-0.5">ID</p>
                <p className="text-xs text-[var(--th-text)] font-mono truncate">{docId}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--th-text-muted)] mb-0.5">Knowledge Base</p>
                <p className="text-xs text-[var(--th-text)] truncate">{kbName || kbId}</p>
              </div>
            </div>
          </div>
        )}

        {/* Delete zone */}
        {isEdit && (
          <div className="border-t border-[var(--th-card-border-subtle)] pt-6 mt-6">
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-[var(--th-error-text)] mb-1">{t('knowledge.deleteDoc')}</h4>
              <p className="text-xs text-[var(--th-text-muted)] mb-3">{t('knowledge.deleteDocConfirm', { name: form.title })}</p>
              <button type="button" onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 rounded-lg hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)] transition-all">
                {t('knowledge.deleteDoc')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const RENDER_MAP: Record<DocEditorSection, () => React.ReactNode> = {
    content: renderContent,
    metadata: renderMetadata,
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
        <button type="button" onClick={() => router.push(`/dashboard/knowledge/${kbId}`)}
          className="flex items-center gap-1.5 md:gap-2 text-sm text-[var(--th-text-secondary)] hover:text-[var(--th-text)] transition-all font-medium min-h-[44px]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          <span className="hidden md:inline">{t('knowledge.backToDocs')}</span>
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.push(`/dashboard/knowledge/${kbId}`)}
            className="hidden md:inline-flex px-4 py-2 text-sm rounded-xl border border-[var(--th-card-border-subtle)] text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] transition-all font-medium min-h-[44px] items-center">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm min-h-[44px] btn-primary disabled:opacity-40">
            {saving ? t('knowledge.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex overflow-x-auto border-b border-[var(--th-card-border-subtle)] bg-[var(--th-card)] px-2 py-1.5 gap-1 flex-shrink-0 scrollbar-none">
        {DOC_SECTIONS.map(s => (
          <button key={s} type="button" onClick={() => setSection(s)}
            className={`flex items-center gap-1 px-3 py-2 min-h-[44px] text-xs rounded-lg whitespace-nowrap transition-all ${
              section === s
                ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white font-semibold'
                : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)]'
            }`}>
            <span className="material-symbols-outlined text-base">{DOC_SECTION_ICONS[s]}</span>
            <span>{t(DOC_SECTION_KEYS[s])}</span>
          </button>
        ))}
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <nav className="hidden md:flex flex-col w-52 border-r border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-3 gap-1">
          {DOC_SECTIONS.map(s => (
            <button key={s} type="button" onClick={() => setSection(s)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                section === s
                  ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white font-semibold shadow-[0_2px_8px_var(--th-shadow-primary)]'
                  : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] hover:text-[var(--th-text)]'
              }`}>
              <span className="material-symbols-outlined text-lg">{DOC_SECTION_ICONS[s]}</span>
              {t(DOC_SECTION_KEYS[s])}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-2xl mx-auto">
            {RENDER_MAP[section]()}
          </div>
        </div>
      </div>

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)} role="dialog" aria-modal="true">
          <div className="bg-[var(--th-modal)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 space-y-4">
              <div className="w-12 h-12 bg-[var(--th-surface)] rounded-2xl flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--th-error-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--th-text)]">{t('knowledge.deleteDoc')}</h3>
                <p className="text-sm text-[var(--th-text-muted)] mt-1">{t('knowledge.deleteDocConfirm', { name: form.title })}</p>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg transition-colors">{t('common.cancel')}</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)] text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50">
                  {deleting ? '...' : t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
