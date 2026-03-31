'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  document_count: number;
  created_at: string;
}

export default function KnowledgePage() {
  const [bases, setBases]     = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [name, setName]       = useState('');
  const [desc, setDesc]       = useState('');
  const [saving, setSaving]   = useState(false);

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0f172a]">Knowledge Bases</h2>
          <p className="text-sm text-[#94a3b8] mt-0.5">RAG-powered knowledge for your AI agents</p>
        </div>
        <button onClick={() => setModal(true)} className="px-4 py-2.5 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-xl transition-all active:scale-[.98] shadow-lg shadow-[#6366f1]/25 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          New Knowledge Base
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#e2e8f0] p-5 animate-pulse h-32" />
          ))}
        </div>
      ) : bases.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] flex flex-col items-center py-20">
          <div className="w-14 h-14 bg-[#eef2ff] rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[#6366f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#475569]">No knowledge bases yet</p>
          <p className="text-xs text-[#94a3b8] mt-1 mb-4">Upload documents and FAQs for your agents</p>
          <button onClick={() => setModal(true)} className="px-4 py-2 bg-[#6366f1] text-white text-sm font-medium rounded-lg hover:bg-[#4f46e5] transition-colors">Create Knowledge Base</button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {bases.map(kb => (
            <div key={kb.id} className="bg-white rounded-xl border border-[#e2e8f0] p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-10 h-10 bg-[#eef2ff] rounded-xl flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-[#6366f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3 className="font-semibold text-[#0f172a] text-sm">{kb.name}</h3>
              {kb.description && <p className="text-xs text-[#94a3b8] mt-1 line-clamp-2">{kb.description}</p>}
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-[#6366f1] font-medium">{kb.document_count ?? 0} docs</span>
                <span className="text-[10px] text-[#94a3b8]">
                  {new Date(kb.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModal(false)} onKeyDown={e => e.key === 'Escape' && setModal(false)} role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e2e8f0]">
              <h2 className="text-base font-semibold text-[#0f172a]">New Knowledge Base</h2>
              <button onClick={() => setModal(false)} className="p-1.5 hover:bg-[#f1f5f9] rounded-lg">
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="Product FAQ" className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">Description</label>
                <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What this knowledge base covers..." className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="px-4 py-2.5 text-sm text-[#475569] hover:bg-[#f1f5f9] rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2.5 bg-[#6366f1] text-white text-sm font-semibold rounded-lg hover:bg-[#4f46e5] disabled:opacity-60">
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
