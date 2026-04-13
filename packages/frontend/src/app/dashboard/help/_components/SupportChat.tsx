'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'replied' | 'closed';
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface Message {
  id: string;
  sender_role: 'user' | 'admin';
  body: string;
  created_at: string;
}

interface TicketDetail extends Ticket {
  messages: Message[];
}

type View = 'list' | 'new' | 'chat';

export function SupportChat() {
  const t = useT();
  const [view, setView] = useState<View>('list');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<TicketDetail | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadTickets = useCallback(async () => {
    try {
      const data = await api.get<Ticket[]>('/support');
      setTickets(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTicket?.messages]);

  const openTicket = async (id: string) => {
    try {
      const data = await api.get<TicketDetail>(`/support/${id}`);
      setActiveTicket(data);
      setView('chat');
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    try {
      const ticket = await api.post<Ticket>('/support', { subject: subject.trim(), message: message.trim() });
      setSubject('');
      setMessage('');
      await openTicket(ticket.id);
      loadTickets();
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleReply = async () => {
    if (!reply.trim() || !activeTicket) return;
    setSending(true);
    try {
      await api.post(`/support/${activeTicket.id}/messages`, { message: reply.trim() });
      setReply('');
      await openTicket(activeTicket.id);
      loadTickets();
    } catch { /* ignore */ }
    setSending(false);
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-blue-500/15 text-blue-400',
      replied: 'bg-green-500/15 text-green-400',
      closed: 'bg-[var(--th-text-muted)]/15 text-[var(--th-text-muted)]',
    };
    const key = `help.support.${status}` as const;
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles[status] || ''}`}>
        {t(key)}
      </span>
    );
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString();
  };

  // ── New ticket form ──
  if (view === 'new') {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-xs text-[var(--th-text-muted)] hover:text-[var(--th-text)] transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          {t('help.support.back')}
        </button>

        <h3 className="text-sm font-bold text-[var(--th-text)]">{t('help.support.newTicket')}</h3>

        <div>
          <label className="text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5 block">{t('help.support.subject')}</label>
          <input
            value={subject} onChange={e => setSubject(e.target.value)}
            placeholder={t('help.support.subjectPlaceholder')}
            className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--th-bg)] border border-[var(--th-card-border-subtle)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:border-[var(--th-primary)] transition-colors"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5 block">{t('help.support.message')}</label>
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder={t('help.support.messagePlaceholder')}
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--th-bg)] border border-[var(--th-card-border-subtle)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:border-[var(--th-primary)] transition-colors resize-none"
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={sending || !subject.trim() || !message.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[var(--th-primary)] hover:opacity-90 disabled:opacity-40 transition-all"
        >
          {sending ? t('help.support.sending') : t('help.support.send')}
        </button>
      </div>
    );
  }

  // ── Chat view ──
  if (view === 'chat' && activeTicket) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => { setView('list'); setActiveTicket(null); }} className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[var(--th-card-hover)] transition-colors">
            <svg className="w-3.5 h-3.5 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[var(--th-text)] truncate">{activeTicket.subject}</div>
          </div>
          {statusBadge(activeTicket.status)}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-2.5 mb-3 min-h-0 max-h-[45vh] pr-1" style={{ scrollbarWidth: 'thin' }}>
          {activeTicket.messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender_role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                msg.sender_role === 'user'
                  ? 'bg-[var(--th-primary)] text-white rounded-br-md'
                  : 'bg-[var(--th-bg)] border border-[var(--th-card-border-subtle)] text-[var(--th-text)] rounded-bl-md'
              }`}>
                {msg.sender_role === 'admin' && (
                  <div className="text-[10px] font-semibold text-[var(--th-primary)] mb-1">Support</div>
                )}
                <div className="whitespace-pre-wrap">{msg.body}</div>
                <div className={`text-[10px] mt-1 ${msg.sender_role === 'user' ? 'text-white/60' : 'text-[var(--th-text-muted)]'}`}>
                  {formatTime(msg.created_at)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply input */}
        {activeTicket.status !== 'closed' ? (
          <div className="flex gap-2">
            <input
              value={reply} onChange={e => setReply(e.target.value)}
              placeholder={t('help.support.typeReply')}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleReply()}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-[var(--th-bg)] border border-[var(--th-card-border-subtle)] text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:border-[var(--th-primary)] transition-colors"
            />
            <button
              onClick={handleReply}
              disabled={sending || !reply.trim()}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[var(--th-primary)] hover:opacity-90 disabled:opacity-40 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
            </button>
          </div>
        ) : (
          <div className="text-center text-xs text-[var(--th-text-muted)] py-2">{t('help.support.ticketClosed')}</div>
        )}
      </div>
    );
  }

  // ── Ticket list (default) ──
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--th-text)]">{t('help.support.myTickets')}</h3>
        <button
          onClick={() => setView('new')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--th-primary)] hover:opacity-90 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          {t('help.support.newTicket')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="w-5 h-5 border-2 border-[var(--th-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-8">
          <span className="material-symbols-outlined text-3xl text-[var(--th-text-muted)] mb-2 block" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>inbox</span>
          <p className="text-sm text-[var(--th-text-muted)]">{t('help.support.noTickets')}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tickets.map(ticket => (
            <button
              key={ticket.id}
              onClick={() => openTicket(ticket.id)}
              className="w-full text-left px-3.5 py-3 rounded-xl bg-[var(--th-bg)] border border-[var(--th-card-border-subtle)] hover:border-[var(--th-primary)]/30 hover:shadow-[0_2px_8px_var(--th-shadow)] transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--th-text)] truncate group-hover:text-[var(--th-primary)] transition-colors">
                    {ticket.subject}
                  </div>
                  <div className="text-[11px] text-[var(--th-text-muted)] mt-0.5 flex items-center gap-2">
                    <span>{formatTime(ticket.updated_at)}</span>
                    <span>·</span>
                    <span>{ticket.message_count} msg</span>
                  </div>
                </div>
                {statusBadge(ticket.status)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
