'use client';
import { useState, useRef, useEffect } from 'react';
import { useIsMobile } from '@/lib/useBreakpoint';
import { useAdminQuery, api } from '../_lib/admin-api';
import { fmtRelativeTime, fmtDateTime } from '../_lib/format';
import { TICKET_STATUS_STYLES } from '../_lib/constants';
import type { Ticket, TicketDetail, TicketMessage } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminFilterBar from '../_components/AdminFilterBar';
import AdminBadge from '../_components/AdminBadge';
import AdminSplitView from '../_components/AdminSplitView';
import AdminLoadingState from '../_components/AdminLoadingState';
import AdminErrorState from '../_components/AdminErrorState';

const STATUS_LABELS: Record<string, string> = { open: 'Open', replied: 'Replied', closed: 'Closed' };

export default function AdminTicketsPage() {
  const [filter, setFilter] = useState('');
  const [activeTicket, setActiveTicket] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { data, loading, error, refetch } = useAdminQuery<{ tickets: Ticket[]; total: number }>(
    () => {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      params.set('limit', '100');
      return api.get(`/support/admin/all?${params}`);
    },
    [filter],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTicket?.messages]);

  const openTicket = async (id: string) => {
    try {
      const detail = await api.get<TicketDetail>(`/support/admin/${id}`);
      setActiveTicket(detail);
    } catch (err) {
      // Keep current state, don't clear
    }
  };

  const handleReply = async () => {
    if (!reply.trim() || !activeTicket) return;
    setSending(true);
    try {
      await api.post(`/support/admin/${activeTicket.id}/reply`, { message: reply.trim() });
      setReply('');
      await openTicket(activeTicket.id);
      refetch();
    } catch (err) {
      // Stay on current view
    }
    setSending(false);
  };

  const handleClose = async () => {
    if (!activeTicket) return;
    try {
      await api.patch(`/support/admin/${activeTicket.id}/close`, {});
      await openTicket(activeTicket.id);
      refetch();
    } catch (err) {
      // Silent
    }
  };

  const handleReopen = async () => {
    if (!activeTicket) return;
    try {
      await api.patch(`/support/admin/${activeTicket.id}/reopen`, {});
      await openTicket(activeTicket.id);
      refetch();
    } catch (err) {
      // Silent
    }
  };

  if (loading) return <AdminLoadingState />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;

  const tickets = data?.tickets ?? [];
  const total = data?.total ?? 0;

  const filterOptions = [
    { value: '', label: 'All', count: total },
    { value: 'open', label: 'Open' },
    { value: 'replied', label: 'Replied' },
    { value: 'closed', label: 'Closed' },
  ];

  const listContent = (
    <div className="space-y-1.5">
      {tickets.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--th-text-muted)' }}>
          <span className="material-symbols-outlined text-3xl mb-2 block">forum</span>
          <p className="text-sm">No tickets</p>
        </div>
      ) : tickets.map(ticket => {
        const style = TICKET_STATUS_STYLES[ticket.status] || TICKET_STATUS_STYLES.open;
        return (
          <button
            key={ticket.id}
            onClick={() => openTicket(ticket.id)}
            className="w-full text-left px-3.5 py-3 rounded-xl transition-all"
            style={{
              background: activeTicket?.id === ticket.id ? 'var(--th-primary-bg)' : 'var(--th-card)',
              border: `1px solid ${activeTicket?.id === ticket.id ? 'var(--th-primary)' : 'var(--th-card-border-subtle)'}`,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{ticket.subject}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--th-text-muted)' }}>{ticket.user_email}</div>
                <div className="text-[10px] mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--th-text-muted)' }}>
                  <span>{fmtRelativeTime(ticket.updated_at)}</span>
                  <span>&middot;</span>
                  <span>{ticket.message_count} msg</span>
                </div>
              </div>
              <AdminBadge bg={style.bg} color={style.color}>
                {STATUS_LABELS[ticket.status]}
              </AdminBadge>
            </div>
          </button>
        );
      })}
    </div>
  );

  const detailContent = activeTicket ? (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--th-card)',
        border: '1px solid var(--th-card-border-subtle)',
        boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
      }}
    >
      <TicketChat
        ticket={activeTicket}
        reply={reply}
        setReply={setReply}
        sending={sending}
        onReply={handleReply}
        onClose={handleClose}
        onReopen={handleReopen}
        messagesEndRef={messagesEndRef}
      />
    </div>
  ) : (
    <div
      className="rounded-xl p-8 text-center min-h-[50vh] flex items-center justify-center"
      style={{
        background: 'var(--th-card)',
        border: '1px solid var(--th-card-border-subtle)',
      }}
    >
      <div>
        <span className="material-symbols-outlined text-4xl mb-2 block" style={{ color: 'var(--th-text-muted)' }}>forum</span>
        <p className="text-sm" style={{ color: 'var(--th-text-muted)' }}>Select a ticket to view conversation</p>
      </div>
    </div>
  );

  return (
    <div className="py-4 md:py-6 space-y-4">
      <AdminPageHeader title="Support Tickets" subtitle={`${total} total`} icon="support_agent" />
      <AdminFilterBar options={filterOptions} value={filter} onChange={setFilter} />
      <AdminSplitView
        list={listContent}
        detail={detailContent}
        hasSelection={!!activeTicket}
        onBack={() => setActiveTicket(null)}
        listSpan={4}
        detailSpan={8}
      />
    </div>
  );
}

function TicketChat({ ticket, reply, setReply, sending, onReply, onClose, onReopen, messagesEndRef }: {
  ticket: TicketDetail;
  reply: string;
  setReply: (v: string) => void;
  sending: boolean;
  onReply: () => void;
  onClose: () => void;
  onReopen: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const style = TICKET_STATUS_STYLES[ticket.status] || TICKET_STATUS_STYLES.open;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid var(--th-border)' }}>
        <div className="min-w-0">
          <h2 className="text-base font-headline truncate">{ticket.subject}</h2>
          <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--th-text-muted)' }}>
            <span>{ticket.user_email}</span>
            <span>&middot;</span>
            <span>{ticket.workspace_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AdminBadge bg={style.bg} color={style.color}>
            {STATUS_LABELS[ticket.status]}
          </AdminBadge>
          {ticket.status !== 'closed' ? (
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
              style={{ background: 'var(--th-error-bg)', color: 'var(--th-error-text)' }}>
              Close
            </button>
          ) : (
            <button onClick={onReopen} className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
              style={{ background: 'var(--th-primary-bg)', color: 'var(--th-primary-text)' }}>
              Reopen
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3 mb-4 max-h-[55vh] overflow-y-auto pr-1 scrollbar-none">
        {ticket.messages.map((msg: TicketMessage) => (
          <div key={msg.id} className={`flex ${msg.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                msg.sender_role === 'admin' ? 'rounded-br-md' : 'rounded-bl-md'
              }`}
              style={
                msg.sender_role === 'admin'
                  ? { background: 'var(--th-primary)', color: '#faf9f5' }
                  : { background: 'var(--th-surface)', border: '1px solid var(--th-border)' }
              }
            >
              <div className="text-[10px] font-medium mb-1" style={{
                color: msg.sender_role === 'admin' ? 'rgba(250,249,245,0.7)' : 'var(--th-primary-text)',
              }}>
                {msg.sender_email}
              </div>
              <div className="whitespace-pre-wrap">{msg.body}</div>
              <div className="text-[10px] mt-1.5" style={{
                color: msg.sender_role === 'admin' ? 'rgba(250,249,245,0.5)' : 'var(--th-text-muted)',
              }}>
                {fmtDateTime(msg.created_at)}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply */}
      {ticket.status !== 'closed' && (
        <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid var(--th-border)' }}>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your reply..."
            rows={2}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onReply(); }}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm input-base resize-none"
          />
          <button
            onClick={onReply}
            disabled={sending || !reply.trim()}
            className="self-end btn-primary px-5 py-2.5 text-sm font-medium disabled:opacity-40"
          >
            {sending ? '...' : 'Reply'}
          </button>
        </div>
      )}
    </div>
  );
}
