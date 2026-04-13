'use client';
import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useIsMobile } from '@/lib/useBreakpoint';

interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'replied' | 'closed';
  created_at: string;
  updated_at: string;
  user_email: string;
  workspace_name: string;
  workspace_id: string;
  message_count: number;
}

interface Message {
  id: string;
  sender_role: 'user' | 'admin';
  sender_id: string;
  sender_email: string;
  body: string;
  created_at: string;
}

interface TicketDetail extends Ticket {
  user_id: string;
  messages: Message[];
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-500/15 text-blue-400',
  replied: 'bg-green-500/15 text-green-400',
  closed: 'bg-gray-500/15 text-gray-400',
};

const STATUS_LABELS: Record<string, string> = { open: 'Open', replied: 'Replied', closed: 'Closed' };

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [activeTicket, setActiveTicket] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const loadTickets = () => {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    params.set('limit', '100');
    api.get<{ tickets: Ticket[]; total: number }>(`/support/admin/all?${params}`)
      .then(r => { setTickets(r.tickets); setTotal(r.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTickets(); }, [filter]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTicket?.messages]);

  const openTicket = async (id: string) => {
    try {
      const data = await api.get<TicketDetail>(`/support/admin/${id}`);
      setActiveTicket(data);
    } catch { /* ignore */ }
  };

  const handleReply = async () => {
    if (!reply.trim() || !activeTicket) return;
    setSending(true);
    try {
      await api.post(`/support/admin/${activeTicket.id}/reply`, { message: reply.trim() });
      setReply('');
      await openTicket(activeTicket.id);
      loadTickets();
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleClose = async () => {
    if (!activeTicket) return;
    await api.patch(`/support/admin/${activeTicket.id}/close`, {});
    await openTicket(activeTicket.id);
    loadTickets();
  };

  const handleReopen = async () => {
    if (!activeTicket) return;
    await api.patch(`/support/admin/${activeTicket.id}/reopen`, {});
    await openTicket(activeTicket.id);
    loadTickets();
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const formatTimeShort = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
  };

  if (loading) return <div className="p-4 md:p-8 text-center opacity-50">Loading...</div>;

  // Mobile: if ticket is open, show chat
  if (isMobile && activeTicket) {
    return (
      <div className="p-4 space-y-3">
        <button onClick={() => setActiveTicket(null)} className="flex items-center gap-1.5 text-xs text-[var(--th-text-muted)] hover:text-[var(--th-text)]">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Back to tickets
        </button>
        <TicketChat ticket={activeTicket} reply={reply} setReply={setReply} sending={sending}
          onReply={handleReply} onClose={handleClose} onReopen={handleReopen}
          formatTime={formatTime} messagesEndRef={messagesEndRef} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' }}>
            <span className="material-symbols-outlined text-lg" style={{ color: '#818cf8', fontVariationSettings: "'FILL' 1" }}>support_agent</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--th-text)]">Support Tickets</h1>
            <p className="text-xs text-[var(--th-text-muted)]">{total} total</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['', 'open', 'replied', 'closed'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f ? 'bg-[var(--th-primary)] text-white' : 'bg-[var(--th-card)] text-[var(--th-text-muted)] hover:text-[var(--th-text)] border border-[var(--th-card-border-subtle)]'
            }`}>
            {f ? STATUS_LABELS[f] : 'All'}
          </button>
        ))}
      </div>

      {/* Layout */}
      <div className="md:grid md:grid-cols-12 gap-4">
        {/* Ticket list */}
        <div className={`${activeTicket ? 'hidden md:block' : ''} md:col-span-5 lg:col-span-4 space-y-1.5`}>
          {tickets.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--th-text-muted)]">No tickets</div>
          ) : tickets.map(ticket => (
            <button key={ticket.id} onClick={() => openTicket(ticket.id)}
              className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all ${
                activeTicket?.id === ticket.id
                  ? 'bg-[var(--th-primary)]/5 border-[var(--th-primary)]/30'
                  : 'bg-[var(--th-card)] border-[var(--th-card-border-subtle)] hover:border-[var(--th-primary)]/20'
              }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--th-text)] truncate">{ticket.subject}</div>
                  <div className="text-[11px] text-[var(--th-text-muted)] mt-0.5">{ticket.user_email}</div>
                  <div className="text-[10px] text-[var(--th-text-muted)] mt-0.5 flex items-center gap-1.5">
                    <span>{formatTimeShort(ticket.updated_at)}</span>
                    <span>·</span>
                    <span>{ticket.message_count} msg</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${STATUS_STYLES[ticket.status]}`}>
                  {STATUS_LABELS[ticket.status]}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Chat panel (desktop) */}
        <div className="hidden md:block md:col-span-7 lg:col-span-8">
          {activeTicket ? (
            <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
              <TicketChat ticket={activeTicket} reply={reply} setReply={setReply} sending={sending}
                onReply={handleReply} onClose={handleClose} onReopen={handleReopen}
                formatTime={formatTime} messagesEndRef={messagesEndRef} />
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-8 text-center min-h-[50vh] flex items-center justify-center shadow-[0_1px_3px_var(--th-shadow)]">
              <div>
                <span className="material-symbols-outlined text-4xl text-[var(--th-text-muted)] mb-2 block" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>forum</span>
                <p className="text-sm text-[var(--th-text-muted)]">Select a ticket to view conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TicketChat({ ticket, reply, setReply, sending, onReply, onClose, onReopen, formatTime, messagesEndRef }: {
  ticket: TicketDetail;
  reply: string;
  setReply: (v: string) => void;
  sending: boolean;
  onReply: () => void;
  onClose: () => void;
  onReopen: () => void;
  formatTime: (iso: string) => string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-[var(--th-card-border-subtle)]">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[var(--th-text)] truncate">{ticket.subject}</h2>
          <div className="text-xs text-[var(--th-text-muted)] mt-0.5 flex items-center gap-2">
            <span>{ticket.user_email}</span>
            <span>·</span>
            <span>{ticket.workspace_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${STATUS_STYLES[ticket.status]}`}>
            {STATUS_LABELS[ticket.status]}
          </span>
          {ticket.status !== 'closed' ? (
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
              Close
            </button>
          ) : (
            <button onClick={onReopen} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">
              Reopen
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3 mb-4 max-h-[55vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {ticket.messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
              msg.sender_role === 'admin'
                ? 'bg-[var(--th-primary)] text-white rounded-br-md'
                : 'bg-[var(--th-bg)] border border-[var(--th-card-border-subtle)] text-[var(--th-text)] rounded-bl-md'
            }`}>
              <div className={`text-[10px] font-semibold mb-1 ${msg.sender_role === 'admin' ? 'text-white/70' : 'text-[var(--th-primary)]'}`}>
                {msg.sender_email}
              </div>
              <div className="whitespace-pre-wrap">{msg.body}</div>
              <div className={`text-[10px] mt-1.5 ${msg.sender_role === 'admin' ? 'text-white/50' : 'text-[var(--th-text-muted)]'}`}>
                {formatTime(msg.created_at)}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply */}
      {ticket.status !== 'closed' && (
        <div className="flex gap-2 pt-3 border-t border-[var(--th-card-border-subtle)]">
          <textarea
            value={reply} onChange={e => setReply(e.target.value)}
            placeholder="Type your reply..."
            rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onReply(); }}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-[var(--th-bg)] border border-[var(--th-card-border-subtle)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:border-[var(--th-primary)] transition-colors resize-none"
          />
          <button
            onClick={onReply}
            disabled={sending || !reply.trim()}
            className="self-end px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[var(--th-primary)] hover:opacity-90 disabled:opacity-40 transition-all"
          >
            {sending ? '...' : 'Reply'}
          </button>
        </div>
      )}
    </div>
  );
}
