'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useIsMobile } from '@/lib/useBreakpoint';
import FloatingActionButton from '@/components/FloatingActionButton';
import MobilePageHeader from '@/components/MobilePageHeader';
import MobileListItem from '@/components/MobileListItem';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  document_count: number;
  created_at: string;
}

interface KBDocument {
  id: string;
  title: string;
  content: string;
  doc_type: string;
  created_at: string;
}

const DOC_TYPES = ['document', 'faq', 'policy', 'pricing', 'troubleshooting'] as const;

export default function KnowledgePage() {
  const t = useT();
  const isMobile = useIsMobile();
  const [bases, setBases]     = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [name, setName]       = useState('');
  const [desc, setDesc]       = useState('');
  const [saving, setSaving]   = useState(false);

  // Detail view state
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [docs, setDocs]             = useState<KBDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docModal, setDocModal]     = useState(false);
  const [docTitle, setDocTitle]     = useState('');
  const [docContent, setDocContent] = useState('');
  const [docType, setDocType]       = useState<string>('document');
  const [docSaving, setDocSaving]   = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [deletingKB, setDeletingKB] = useState<string | null>(null);
  const [enhancing, setEnhancing]   = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // View/Edit document
  const [viewingDoc, setViewingDoc] = useState<KBDocument | null>(null);
  const [editingDoc, setEditingDoc] = useState(false);
  const [editTitle, setEditTitle]   = useState('');
  const [editContent, setEditContent] = useState('');
  const [editType, setEditType]     = useState('document');
  const [editSaving, setEditSaving] = useState(false);
  const [editEnhancing, setEditEnhancing] = useState(false);
  const [editSuggestions, setEditSuggestions] = useState<string[]>([]);

  function load() {
    api.get<{ knowledge_bases: KnowledgeBase[] }>('/knowledge')
      .then(r => setBases(r?.knowledge_bases ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/knowledge', { name, description: desc });
      setModal(false);
      setName(''); setDesc('');
      load();
    } catch {} finally { setSaving(false); }
  }

  function openKBDetail(kb: KnowledgeBase) {
    setSelectedKB(kb);
    setDocsLoading(true);
    api.get<{ documents: KBDocument[] }>(`/knowledge/${kb.id}/documents`)
      .then(r => setDocs(r?.documents ?? []))
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false));
  }

  function goBack() {
    setSelectedKB(null);
    setDocs([]);
    load();
  }

  async function handleAddDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedKB) return;
    setDocSaving(true);
    try {
      await api.post(`/knowledge/${selectedKB.id}/documents`, {
        title: docTitle,
        content: docContent,
        doc_type: docType,
      });
      setDocModal(false);
      setDocTitle(''); setDocContent(''); setDocType('document'); setSuggestions([]);
      // Reload docs
      const r = await api.get<{ documents: KBDocument[] }>(`/knowledge/${selectedKB.id}/documents`);
      setDocs(r?.documents ?? []);
    } catch {} finally { setDocSaving(false); }
  }

  async function handleEnhance() {
    if (!docContent.trim()) return;
    setEnhancing(true);
    setSuggestions([]);
    try {
      const r = await api.post<{ enhanced_content: string; suggestions: string[] }>(
        '/knowledge/enhance',
        { content: docContent, doc_type: docType },
      );
      if (r?.enhanced_content) setDocContent(r.enhanced_content);
      if (r?.suggestions?.length) setSuggestions(r.suggestions);
    } catch {} finally { setEnhancing(false); }
  }

  async function handleDeleteKB(e: React.MouseEvent, kbId: string) {
    e.stopPropagation();
    if (!confirm(t('knowledge.deleteConfirm'))) return;
    setDeletingKB(kbId);
    try {
      await api.delete(`/knowledge/${kbId}`);
      setBases(prev => prev.filter(kb => kb.id !== kbId));
    } catch {} finally { setDeletingKB(null); }
  }

  function openDocView(doc: KBDocument) {
    setViewingDoc(doc);
    setEditingDoc(false);
    setEditTitle(doc.title);
    setEditContent(doc.content);
    setEditType(doc.doc_type);
    setEditSuggestions([]);
  }

  function closeDocView() {
    setViewingDoc(null);
    setEditingDoc(false);
    setEditSuggestions([]);
  }

  async function handleEditEnhance() {
    if (!editContent.trim()) return;
    setEditEnhancing(true);
    setEditSuggestions([]);
    try {
      const r = await api.post<{ enhanced_content: string; suggestions: string[] }>(
        '/knowledge/enhance',
        { content: editContent, doc_type: editType },
      );
      if (r?.enhanced_content) setEditContent(r.enhanced_content);
      if (r?.suggestions?.length) setEditSuggestions(r.suggestions);
    } catch {} finally { setEditEnhancing(false); }
  }

  async function handleSaveDoc() {
    if (!viewingDoc || !selectedKB) return;
    setEditSaving(true);
    try {
      await api.patch(`/knowledge/documents/${viewingDoc.id}`, {
        title: editTitle,
        content: editContent,
        doc_type: editType,
      });
      // Refresh docs
      const r = await api.get<{ documents: KBDocument[] }>(`/knowledge/${selectedKB.id}/documents`);
      setDocs(r?.documents ?? []);
      closeDocView();
    } catch {} finally { setEditSaving(false); }
  }

  async function handleDeleteDoc(docId: string) {
    if (!selectedKB) return;
    setDeleting(docId);
    try {
      await api.delete(`/knowledge/documents/${docId}`);
      setDocs(prev => prev.filter(d => d.id !== docId));
    } catch {} finally { setDeleting(null); }
  }

  // ── Detail View ──
  if (selectedKB) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <MobilePageHeader
          title={selectedKB.name}
          subtitle={selectedKB.description ?? undefined}
          backHref="#"
          actions={undefined}
        />
        <div className="hidden md:flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-[var(--th-surface)] rounded-lg transition-colors" aria-label="Back">
            <svg className="w-5 h-5 text-[var(--th-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-lg md:text-xl font-bold text-[var(--th-text)]">{selectedKB.name}</h2>
            {selectedKB.description && (
              <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{selectedKB.description}</p>
            )}
          </div>
          <button onClick={() => setDocModal(true)} className="px-4 py-2.5 btn-primary shadow-lg shadow-[var(--th-shadow-primary)] flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            {t('knowledge.addDoc')}
          </button>
        </div>
        {/* Mobile back button (MobilePageHeader doesn't call goBack) */}
        <div className="md:hidden -mt-4 mb-2">
          <button onClick={goBack} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[var(--th-surface)] rounded-lg transition-colors" aria-label="Back">
            <svg className="w-5 h-5 text-[var(--th-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* Documents list */}
        {docsLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[var(--th-skeleton)] rounded-lg p-5 animate-pulse h-20 rounded-2xl border border-[var(--th-card-border-subtle)]" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] flex flex-col items-center py-20">
            <div className="w-14 h-14 bg-[var(--th-primary-bg)] rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--th-text-secondary)]">{t('knowledge.noDocs')}</p>
            <p className="text-xs text-[var(--th-text-muted)] mt-1 mb-4">{t('knowledge.noDocsDesc')}</p>
            <button onClick={() => setDocModal(true)} className="px-4 py-2 btn-primary">{t('knowledge.addDoc')}</button>
          </div>
        ) : (
          <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-2">
            {docs.map(doc => (
              <MobileListItem
                key={doc.id}
                onClick={() => openDocView(doc)}
                swipeLeft={{
                  color: '#ef4444',
                  icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>,
                  label: 'Delete',
                  onAction: () => handleDeleteDoc(doc.id),
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[var(--th-primary-bg)] rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--th-text)] truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]">{doc.doc_type}</span>
                      <span className="text-[10px] text-[var(--th-text-muted)]">{new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-[var(--th-text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </div>
              </MobileListItem>
            ))}
          </div>
          {/* Desktop: table */}
          <div className="hidden md:block bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
            <table className="w-full">
              <thead className="bg-[var(--th-table-header)] border-b border-[var(--th-card-border-subtle)]">
                <tr>
                  {[t('knowledge.docTitle'), t('knowledge.docType'), t('knowledge.created'), ''].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--th-card-border-subtle)]">
                {docs.map(doc => (
                  <tr key={doc.id} onClick={() => openDocView(doc)} className="hover:bg-[var(--th-table-row-hover)] transition-colors cursor-pointer">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[var(--th-primary-bg)] rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--th-text)]">{doc.title}</p>
                          <p className="text-xs text-[var(--th-text-muted)] line-clamp-1 max-w-md">{doc.content?.slice(0, 80)}{(doc.content?.length ?? 0) > 80 ? '...' : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex text-xs px-2.5 py-0.5 rounded-full font-medium bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]">
                        {doc.doc_type}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-[var(--th-text-muted)]">
                      {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }}
                        disabled={deleting === doc.id}
                        className="p-1.5 text-[var(--th-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                        aria-label="Delete document"
                      >
                        {deleting === doc.id ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* View/Edit Document Modal */}
        {viewingDoc && (
          <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeDocView} role="dialog" aria-modal="true">
            <div className="bg-[var(--th-modal)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--th-card-border-subtle)]">
                {editingDoc ? (
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-base font-semibold text-[var(--th-text)] bg-transparent border-b border-[var(--th-card-border-subtle)] focus:outline-none focus:border-[var(--th-primary)] flex-1 mr-3" />
                ) : (
                  <h2 className="text-base font-semibold text-[var(--th-text)] flex-1">{viewingDoc.title}</h2>
                )}
                <div className="flex items-center gap-2">
                  {!editingDoc && (
                    <button onClick={() => setEditingDoc(true)} className="px-3 py-1.5 text-xs font-medium text-[var(--th-primary)] hover:bg-[var(--th-primary-bg)] rounded-lg transition-colors">
                      {t('knowledge.editDoc')}
                    </button>
                  )}
                  <button onClick={closeDocView} className="p-1.5 hover:bg-[var(--th-surface)] rounded-lg" aria-label="Close">
                    <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
                {editingDoc ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('knowledge.docType')}</label>
                      <select value={editType} onChange={e => setEditType(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] text-sm bg-[var(--th-card)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary-text)]/20 focus:border-[var(--th-primary-text)]">
                        {DOC_TYPES.map(t => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('knowledge.docContent')}</label>
                        <button
                          type="button"
                          onClick={handleEditEnhance}
                          disabled={editEnhancing || !editContent.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {editEnhancing ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
                          )}
                          {editEnhancing ? t('knowledge.enhancing') : t('knowledge.enhance')}
                        </button>
                      </div>
                      <textarea rows={12} value={editContent} onChange={e => { setEditContent(e.target.value); setEditSuggestions([]); }} className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary-text)]/20 focus:border-[var(--th-primary-text)]" />
                    </div>
                    {editSuggestions.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">{t('knowledge.suggestions')}</p>
                        <ul className="space-y-1">
                          {editSuggestions.map((s, i) => (
                            <li key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                              <span className="mt-0.5 flex-shrink-0">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex text-xs px-2.5 py-0.5 rounded-full font-medium bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]">
                        {viewingDoc.doc_type}
                      </span>
                      <span className="text-xs text-[var(--th-text-muted)]">
                        {new Date(viewingDoc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--th-text)] whitespace-pre-wrap leading-relaxed">
                      {viewingDoc.content}
                    </div>
                  </>
                )}
              </div>
              {editingDoc && (
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--th-card-border-subtle)]">
                  <button type="button" onClick={() => setEditingDoc(false)} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg">{t('common.cancel')}</button>
                  <button onClick={handleSaveDoc} disabled={editSaving} className="px-4 py-2.5 btn-primary disabled:opacity-60">
                    {editSaving ? t('knowledge.saving') : t('knowledge.saveDoc')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Document Modal */}
        {docModal && (
          <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDocModal(false)} onKeyDown={e => e.key === 'Escape' && setDocModal(false)} role="dialog" aria-modal="true">
            <div className="bg-[var(--th-modal)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--th-card-border-subtle)]">
                <h2 className="text-base font-semibold text-[var(--th-text)]">{t('knowledge.addDoc')}</h2>
                <button onClick={() => setDocModal(false)} className="p-1.5 hover:bg-[var(--th-surface)] rounded-lg" aria-label="Close">
                  <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleAddDoc} className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('knowledge.docTitle')}</label>
                  <input value={docTitle} onChange={e => setDocTitle(e.target.value)} required placeholder="Getting Started Guide" className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--th-primary-text)]/20 focus:border-[var(--th-primary-text)]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('knowledge.docType')}</label>
                  <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--th-primary-text)]/20 focus:border-[var(--th-primary-text)] bg-[var(--th-card)]">
                    {DOC_TYPES.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('knowledge.docContent')}</label>
                    <button
                      type="button"
                      onClick={handleEnhance}
                      disabled={enhancing || !docContent.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {enhancing ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
                      )}
                      {enhancing ? t('knowledge.enhancing') : t('knowledge.enhance')}
                    </button>
                  </div>
                  <textarea rows={8} value={docContent} onChange={e => { setDocContent(e.target.value); setSuggestions([]); }} required placeholder="Paste or write the document content here..." className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary-text)]/20 focus:border-[var(--th-primary-text)]" />
                </div>
                {suggestions.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">{t('knowledge.suggestions')}</p>
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
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setDocModal(false)} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg">{t('common.cancel')}</button>
                  <button type="submit" disabled={docSaving} className="px-4 py-2.5 btn-primary disabled:opacity-60">
                    {docSaving ? t('knowledge.adding') : t('knowledge.addDoc')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--th-text)]">{t('knowledge.title')}</h2>
          <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{t('knowledge.subtitle')}</p>
        </div>
        {bases.length > 0 && (
          <button onClick={() => setModal(true)} className="px-4 py-2.5 btn-primary shadow-lg shadow-[var(--th-shadow-primary)] flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            {t('knowledge.newKB')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[var(--th-skeleton)] rounded-lg p-5 animate-pulse h-32 rounded-2xl border border-[var(--th-card-border-subtle)]" />
          ))}
        </div>
      ) : bases.length === 0 ? (
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] flex flex-col items-center py-20">
          <div className="w-14 h-14 bg-[var(--th-primary-bg)] rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--th-text-secondary)]">{t('knowledge.noBases')}</p>
          <p className="text-xs text-[var(--th-text-muted)] mt-1 mb-4">{t('knowledge.noBasesDesc')}</p>
          <button onClick={() => setModal(true)} className="px-4 py-2 btn-primary">{t('knowledge.createKB')}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {bases.map(kb => (
            <div key={kb.id} onClick={() => openKBDetail(kb)} className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] hover:shadow-[0_4px_16px_var(--th-shadow),0_12px_32px_var(--th-card-glow)] transition-all cursor-pointer relative group">
              <button
                onClick={(e) => handleDeleteKB(e, kb.id)}
                disabled={deletingKB === kb.id}
                className="absolute top-3 right-3 p-1.5 text-[var(--th-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                aria-label="Delete KB"
              >
                {deletingKB === kb.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                )}
              </button>
              <div className="w-10 h-10 bg-[var(--th-primary-bg)] rounded-xl flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3 className="font-semibold text-[var(--th-text)] text-sm">{kb.name}</h3>
              {kb.description && <p className="text-xs text-[var(--th-text-muted)] mt-1 line-clamp-2">{kb.description}</p>}
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-[var(--th-primary-text)] font-medium">{kb.document_count ?? 0} {t('knowledge.docs')}</span>
                <span className="text-[10px] text-[var(--th-text-muted)]">
                  {new Date(kb.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModal(false)} onKeyDown={e => e.key === 'Escape' && setModal(false)} role="dialog" aria-modal="true">
          <div className="bg-[var(--th-modal)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--th-card-border-subtle)]">
              <h2 className="text-base font-semibold text-[var(--th-text)]">{t('knowledge.newKB')}</h2>
              <button onClick={() => setModal(false)} className="p-1.5 hover:bg-[var(--th-surface)] rounded-lg" aria-label="Close">
                <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('knowledge.name')}</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="Product FAQ" className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--th-primary-text)]/20 focus:border-[var(--th-primary-text)]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('knowledge.description')}</label>
                <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What this knowledge base covers..." className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary-text)]/20 focus:border-[var(--th-primary-text)]" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} className="px-4 py-2.5 btn-primary disabled:opacity-60">
                  {saving ? t('knowledge.creating') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
