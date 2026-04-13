'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useIsMobile } from '@/lib/useBreakpoint';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  ip_address: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-500/15 text-blue-400',
  read: 'bg-green-500/15 text-green-400',
  archived: 'bg-gray-500/15 text-gray-400',
};

const STATUS_LABELS: Record<string, string> = { new: 'New', read: 'Read', archived: 'Archived' };

export default function AdminContactsPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isMobile = useIsMobile();

  const loadMessages = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50', offset: '0' });
    if (filter) params.set('status', filter);
    api.get<{ messages: ContactMessage[] } | ContactMessage[]>(`/contact/admin/all?${params}`)
      .then(r => {
        const list = Array.isArray(r) ? r : (r as { messages: ContactMessage[] }).messages ?? [];
        setMessages(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMessages(); }, [filter]);

  const handleStatus = async (id: string, status: 'read' | 'archived') => {
    try {
      await api.patch(`/contact/admin/${id}/status`, { status });
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status } : m));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await api.delete(`/contact/admin/${id}`);
      setMessages(prev => prev.filter(m => m.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch { /* ignore */ }
    setDeleting(false);
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleString();

  const formatTimeShort = (iso: string) => {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    return `${Math.floor(diffH / 24)}d`;
  };

  if (loading) return <div className="p-4 md:p-8 text-center opacity-50">Loading...</div>;

  // Mobile: show detail view
  if (isMobile && selected) {
    return (
      <div className="p-4 space-y-3">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-xs text-[var(--th-text-muted)] hover:text-[var(--th-text)]">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to messages
        </button>
        <ContactDetail
          contact={selected}
          onStatus={handleStatus}
          onDelete={handleDelete}
          deleting={deleting}
          formatTime={formatTime}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' }}>
            <span className="material-symbols-outlined text-lg" style={{ color: '#818cf8', fontVariationSettings: "'FILL' 1" }}>mail</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--th-text)]">Contact Messages</h1>
            <p className="text-xs text-[var(--th-text-muted)]">{messages.length} messages</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['', 'new', 'read', 'archived'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f
                ? 'bg-[var(--th-primary)] text-white'
                : 'bg-[var(--th-card)] text-[var(--th-text-muted)] hover:text-[var(--th-text)] border border-[var(--th-card-border-subtle)]'
            }`}>
            {f ? STATUS_LABELS[f] : 'All'}
          </button>
        ))}
      </div>

      {/* Layout */}
      <div className="md:grid md:grid-cols-12 gap-4">
        {/* Message list */}
        <div className={`${selected ? 'hidden md:block' : ''} md:col-span-5 lg:col-span-4 space-y-1.5`}>
          {messages.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--th-text-muted)]">No messages</div>
          ) : messages.map(msg => (
            <button key={msg.id} onClick={() => setSelected(msg)}
              className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all ${
                selected?.id === msg.id
                  ? 'bg-[var(--th-primary)]/5 border-[var(--th-primary)]/30'
                  : 'bg-[var(--th-card)] border-[var(--th-card-border-subtle)] hover:border-[var(--th-primary)]/20'
              }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--th-text)] truncate">{msg.subject || '(no subject)'}</div>
                  <div className="text-[11px] text-[var(--th-text-muted)] mt-0.5 truncate">{msg.name} · {msg.email}</div>
                  <div className="text-[10px] text-[var(--th-text-muted)] mt-0.5 truncate">{formatTimeShort(msg.created_at)}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${STATUS_STYLES[msg.status]}`}>
                  {STATUS_LABELS[msg.status]}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel (desktop) */}
        <div className="hidden md:block md:col-span-7 lg:col-span-8">
          {selected ? (
            <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
              <ContactDetail
                contact={selected}
                onStatus={handleStatus}
                onDelete={handleDelete}
                deleting={deleting}
                formatTime={formatTime}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-8 text-center min-h-[50vh] flex items-center justify-center shadow-[0_1px_3px_var(--th-shadow)]">
              <div>
                <span className="material-symbols-outlined text-4xl text-[var(--th-text-muted)] mb-2 block" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>mark_email_unread</span>
                <p className="text-sm text-[var(--th-text-muted)]">Select a message to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactDetail({ contact, onStatus, onDelete, deleting, formatTime }: {
  contact: ContactMessage;
  onStatus: (id: string, status: 'read' | 'archived') => void;
  onDelete: (id: string) => void;
  deleting: boolean;
  formatTime: (iso: string) => string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--th-card-border-subtle)]">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[var(--th-text)] truncate">{contact.subject || '(no subject)'}</h2>
          <div className="text-xs text-[var(--th-text-muted)] mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[var(--th-text)]">{contact.name}</span>
            <span>·</span>
            <span>{contact.email}</span>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${STATUS_STYLES[contact.status]}`}>
          {STATUS_LABELS[contact.status]}
        </span>
      </div>

      {/* Message body */}
      <div className="bg-[var(--th-bg)] border border-[var(--th-card-border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--th-text)] leading-relaxed whitespace-pre-wrap min-h-[6rem]">
        {contact.message}
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-[var(--th-bg)] border border-[var(--th-card-border-subtle)] rounded-lg px-3 py-2">
          <div className="text-[var(--th-text-muted)] mb-0.5">Email</div>
          <div className="text-[var(--th-text)] font-medium truncate">{contact.email}</div>
        </div>
        <div className="bg-[var(--th-bg)] border border-[var(--th-card-border-subtle)] rounded-lg px-3 py-2">
          <div className="text-[var(--th-text-muted)] mb-0.5">IP Address</div>
          <div className="text-[var(--th-text)] font-medium">{contact.ip_address || '—'}</div>
        </div>
        <div className="bg-[var(--th-bg)] border border-[var(--th-card-border-subtle)] rounded-lg px-3 py-2 col-span-2">
          <div className="text-[var(--th-text-muted)] mb-0.5">Received</div>
          <div className="text-[var(--th-text)] font-medium">{formatTime(contact.created_at)}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-[var(--th-card-border-subtle)]">
        {contact.status !== 'read' && (
          <button
            onClick={() => onStatus(contact.id, 'read')}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
            Mark as Read
          </button>
        )}
        {contact.status !== 'archived' && (
          <button
            onClick={() => onStatus(contact.id, 'archived')}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 transition-colors">
            Archive
          </button>
        )}
        <button
          onClick={() => onDelete(contact.id)}
          disabled={deleting}
          className="ml-auto px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors">
          {deleting ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
