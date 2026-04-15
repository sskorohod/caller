'use client';
import { useState } from 'react';
import { useAdminQuery, api } from '../_lib/admin-api';
import { fmtRelativeTime, fmtDateTime } from '../_lib/format';
import { CONTACT_STATUS_STYLES } from '../_lib/constants';
import type { ContactMessage } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminFilterBar from '../_components/AdminFilterBar';
import AdminBadge from '../_components/AdminBadge';
import AdminSplitView from '../_components/AdminSplitView';
import AdminLoadingState from '../_components/AdminLoadingState';
import AdminErrorState from '../_components/AdminErrorState';

const STATUS_LABELS: Record<string, string> = { new: 'New', read: 'Read', archived: 'Archived' };

export default function AdminContactsPage() {
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [deleting, setDeleting] = useState(false);

  const { loading, error, refetch } = useAdminQuery<ContactMessage[]>(
    async () => {
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (filter) params.set('status', filter);
      const r = await api.get<{ messages: ContactMessage[] } | ContactMessage[]>(`/contact/admin/all?${params}`);
      const list = Array.isArray(r) ? r : (r as { messages: ContactMessage[] }).messages ?? [];
      setMessages(list);
      return list;
    },
    [filter],
  );

  const handleStatus = async (id: string, status: 'read' | 'archived') => {
    try {
      await api.patch(`/contact/admin/${id}/status`, { status });
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status } : m));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
    } catch (err) {
      // Keep current state
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await api.delete(`/contact/admin/${id}`);
      setMessages(prev => prev.filter(m => m.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      // Keep current state
    }
    setDeleting(false);
  };

  if (loading) return <AdminLoadingState />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;

  const filterOptions = [
    { value: '', label: 'All', count: messages.length },
    { value: 'new', label: 'New' },
    { value: 'read', label: 'Read' },
    { value: 'archived', label: 'Archived' },
  ];

  const listContent = (
    <div className="space-y-1.5">
      {messages.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--th-text-muted)' }}>
          <span className="material-symbols-outlined text-3xl mb-2 block">mark_email_unread</span>
          <p className="text-sm">No messages</p>
        </div>
      ) : messages.map(msg => {
        const style = CONTACT_STATUS_STYLES[msg.status] || CONTACT_STATUS_STYLES.new;
        return (
          <button
            key={msg.id}
            onClick={() => setSelected(msg)}
            className="w-full text-left px-3.5 py-3 rounded-xl transition-all"
            style={{
              background: selected?.id === msg.id ? 'var(--th-primary-bg)' : 'var(--th-card)',
              border: `1px solid ${selected?.id === msg.id ? 'var(--th-primary)' : 'var(--th-card-border-subtle)'}`,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{msg.subject || '(no subject)'}</div>
                <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--th-text-muted)' }}>{msg.name} &middot; {msg.email}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--th-text-muted)' }}>{fmtRelativeTime(msg.created_at)}</div>
              </div>
              <AdminBadge bg={style.bg} color={style.color}>
                {STATUS_LABELS[msg.status]}
              </AdminBadge>
            </div>
          </button>
        );
      })}
    </div>
  );

  const detailContent = selected ? (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--th-card)',
        border: '1px solid var(--th-card-border-subtle)',
        boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
      }}
    >
      <ContactDetail
        contact={selected}
        onStatus={handleStatus}
        onDelete={handleDelete}
        deleting={deleting}
      />
    </div>
  ) : (
    <div
      className="rounded-xl p-8 text-center min-h-[50vh] flex items-center justify-center"
      style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)' }}
    >
      <div>
        <span className="material-symbols-outlined text-4xl mb-2 block" style={{ color: 'var(--th-text-muted)' }}>mark_email_unread</span>
        <p className="text-sm" style={{ color: 'var(--th-text-muted)' }}>Select a message to view details</p>
      </div>
    </div>
  );

  return (
    <div className="py-4 md:py-6 space-y-4">
      <AdminPageHeader title="Contact Messages" subtitle={`${messages.length} messages`} icon="mail" />
      <AdminFilterBar options={filterOptions} value={filter} onChange={setFilter} />
      <AdminSplitView
        list={listContent}
        detail={detailContent}
        hasSelection={!!selected}
        onBack={() => setSelected(null)}
        listSpan={4}
        detailSpan={8}
      />
    </div>
  );
}

function ContactDetail({ contact, onStatus, onDelete, deleting }: {
  contact: ContactMessage;
  onStatus: (id: string, status: 'read' | 'archived') => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const style = CONTACT_STATUS_STYLES[contact.status] || CONTACT_STATUS_STYLES.new;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3" style={{ borderBottom: '1px solid var(--th-border)' }}>
        <div className="min-w-0">
          <h2 className="text-base font-headline truncate">{contact.subject || '(no subject)'}</h2>
          <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--th-text-muted)' }}>
            <span className="font-medium" style={{ color: 'var(--th-text)' }}>{contact.name}</span>
            <span>&middot;</span>
            <span>{contact.email}</span>
          </div>
        </div>
        <AdminBadge bg={style.bg} color={style.color}>
          {STATUS_LABELS[contact.status]}
        </AdminBadge>
      </div>

      {/* Message body */}
      <div
        className="rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap min-h-[6rem]"
        style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)', lineHeight: 1.6 }}
      >
        {contact.message}
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg px-3 py-2" style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
          <div style={{ color: 'var(--th-text-muted)' }}>Email</div>
          <div className="font-medium truncate">{contact.email}</div>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
          <div style={{ color: 'var(--th-text-muted)' }}>IP Address</div>
          <div className="font-medium">{contact.ip_address || '—'}</div>
        </div>
        <div className="rounded-lg px-3 py-2 col-span-2" style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
          <div style={{ color: 'var(--th-text-muted)' }}>Received</div>
          <div className="font-medium">{fmtDateTime(contact.created_at)}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--th-border)' }}>
        {contact.status !== 'read' && (
          <button onClick={() => onStatus(contact.id, 'read')}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
            style={{ background: 'var(--th-success-bg)', color: 'var(--th-success-text)' }}>
            Mark as Read
          </button>
        )}
        {contact.status !== 'archived' && (
          <button onClick={() => onStatus(contact.id, 'archived')}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
            style={{ background: 'var(--th-surface)', color: 'var(--th-text-muted)' }}>
            Archive
          </button>
        )}
        <button onClick={() => onDelete(contact.id)} disabled={deleting}
          className="ml-auto px-3 py-1.5 rounded-lg text-[11px] font-medium disabled:opacity-40 transition-colors"
          style={{ background: 'var(--th-error-bg)', color: 'var(--th-error-text)' }}>
          {deleting ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
