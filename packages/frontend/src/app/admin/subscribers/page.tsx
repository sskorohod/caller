'use client';
import { useState, useCallback } from 'react';
import { useIsMobile } from '@/lib/useBreakpoint';
import { useAdminQuery, api } from '../_lib/admin-api';
import { fmtDateTime } from '../_lib/format';
import { SUBSCRIPTION_STATUS_STYLES } from '../_lib/constants';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminBadge from '../_components/AdminBadge';
import AdminModal from '../_components/AdminModal';
import AdminFormField from '../_components/AdminFormField';
import { adminInputClass, adminSelectClass } from '../_components/AdminFormField';
import AdminLoadingState from '../_components/AdminLoadingState';
import AdminErrorState from '../_components/AdminErrorState';

import { LANGUAGES } from '@/lib/constants';

interface Subscriber {
  id: string;
  phone_number: string;
  name: string;
  email: string | null;
  my_language: string;
  target_language: string;
  mode: string;
  who_hears: string;
  greeting_text: string;
  tts_provider: string;
  tts_voice_id: string | null;
  telegram_chat_id: string | null;
  balance_minutes: string;
  status: string;
  enabled: boolean;
  created_at: string;
}

const DEFAULT_FORM = {
  phone_number: '',
  name: '',
  email: '',
  my_language: 'ru',
  target_language: 'en',
  mode: 'voice' as const,
  who_hears: 'both' as const,
  greeting_text: 'Hello, I am your live translator. I will translate this conversation.',
  tts_provider: 'elevenlabs',
  tts_voice_id: '',
  telegram_chat_id: '',
  balance_minutes: 0,
  enabled: true,
};

export default function AdminSubscribersPage() {
  const isMobile = useIsMobile();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'blocked' | 'disabled'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [showBalance, setShowBalance] = useState<string | null>(null);
  const [balanceForm, setBalanceForm] = useState({ amount: 0, comment: '', type: 'topup' as 'topup' | 'gift' });
  const [confirmAction, setConfirmAction] = useState<{ type: 'block' | 'delete'; sub: Subscriber } | null>(null);

  const { loading, error, refetch } = useAdminQuery<{ subscribers: Subscriber[] }>(
    async () => {
      const res = await api.get<{ subscribers: Subscriber[] }>('/admin/subscribers');
      setSubscribers(res.subscribers);
      return res;
    },
    [],
  );

  const filtered = subscribers.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.phone_number.includes(search);
    const status = s.status || (s.enabled ? 'active' : 'disabled');
    const matchFilter = filter === 'all' || status === filter;
    return matchSearch && matchFilter;
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        email: form.email || undefined,
        tts_voice_id: form.tts_voice_id || undefined,
        telegram_chat_id: form.telegram_chat_id || undefined,
      };
      if (editingId) {
        await api.put(`/translator/subscribers/${editingId}`, payload);
      } else {
        await api.post('/translator/subscribers', payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(DEFAULT_FORM);
      refetch();
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    }
    setSaving(false);
  };

  const handleEdit = (sub: Subscriber) => {
    setForm({
      phone_number: sub.phone_number,
      name: sub.name,
      email: sub.email ?? '',
      my_language: sub.my_language,
      target_language: sub.target_language,
      mode: sub.mode as typeof DEFAULT_FORM.mode,
      who_hears: sub.who_hears as typeof DEFAULT_FORM.who_hears,
      greeting_text: sub.greeting_text,
      tts_provider: sub.tts_provider,
      tts_voice_id: sub.tts_voice_id ?? '',
      telegram_chat_id: sub.telegram_chat_id ?? '',
      balance_minutes: parseFloat(sub.balance_minutes),
      enabled: sub.enabled,
    });
    setEditingId(sub.id);
    setShowForm(true);
  };

  const handleBlock = async (sub: Subscriber) => {
    const status = sub.status || (sub.enabled ? 'active' : 'disabled');
    const action = status === 'blocked' ? 'unblock' : 'block';
    try {
      await api.post(`/admin/subscribers/${sub.id}/block`, { action });
      refetch();
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    }
    setConfirmAction(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/translator/subscribers/${id}`);
      refetch();
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    }
    setConfirmAction(null);
  };

  const handleAddBalance = async () => {
    if (!showBalance) return;
    try {
      await api.post(`/admin/subscribers/${showBalance}/balance`, balanceForm);
      setShowBalance(null);
      setBalanceForm({ amount: 0, comment: '', type: 'topup' });
      refetch();
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    }
  };

  const getStatusBadge = (sub: Subscriber) => {
    const status = sub.status || (sub.enabled ? 'active' : 'disabled');
    const styleMap: Record<string, 'success' | 'error' | 'neutral'> = {
      active: 'success',
      blocked: 'error',
      disabled: 'neutral',
    };
    return <AdminBadge variant={styleMap[status] || 'neutral'}>{status}</AdminBadge>;
  };

  if (loading) return <AdminLoadingState />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;

  return (
    <div className="py-4 md:py-6 space-y-4">
      <AdminPageHeader
        title="Subscribers"
        subtitle={`${subscribers.length} total subscribers`}
        icon="people"
        action={
          <button
            onClick={() => { setForm(DEFAULT_FORM); setEditingId(null); setShowForm(true); }}
            className="btn-primary px-3 md:px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span className="hidden md:inline">New Subscriber</span>
            <span className="md:hidden">Add</span>
          </button>
        }
      />

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-3">
        <div className="relative flex-1 md:max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: 'var(--th-text-muted)' }}>search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className={`${adminInputClass} w-full pl-10 pr-4`}
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as typeof filter)}
          className={adminSelectClass}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {/* Table / Cards */}
      {isMobile ? (
        <div className="space-y-2">
          {filtered.map(sub => (
            <div
              key={sub.id}
              className="rounded-xl p-3 space-y-2"
              style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{sub.name}</span>
                {getStatusBadge(sub)}
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--th-text-secondary)' }}>
                <span className="font-mono">{sub.phone_number}</span>
                <AdminBadge variant="info">{sub.mode}</AdminBadge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span style={{ color: 'var(--th-primary-text)' }}>{sub.my_language}</span>
                  <span className="mx-1" style={{ color: 'var(--th-text-muted)' }}>&harr;</span>
                  <span style={{ color: 'var(--th-info-text)' }}>{sub.target_language}</span>
                </div>
                <span
                  className="font-mono font-medium"
                  style={{ color: parseFloat(sub.balance_minutes) < 5 ? 'var(--th-error-text)' : 'var(--th-success-text)' }}
                >
                  {parseFloat(sub.balance_minutes).toFixed(1)} min
                </span>
              </div>
              <div className="flex items-center gap-1 pt-1" style={{ borderTop: '1px solid var(--th-border)' }}>
                <ActionButton icon="edit" color="var(--th-primary-text)" label="Edit" onClick={() => handleEdit(sub)} />
                <ActionButton icon="add_card" color="var(--th-info-text)" label="Add Minutes" onClick={() => { setShowBalance(sub.id); setBalanceForm({ amount: 0, comment: '', type: 'topup' }); }} />
                <ActionButton
                  icon={sub.status === 'blocked' ? 'lock_open' : 'block'}
                  color={sub.status === 'blocked' ? 'var(--th-success-text)' : 'var(--th-warning-text)'}
                  label={sub.status === 'blocked' ? 'Unblock' : 'Block'}
                  onClick={() => setConfirmAction({ type: 'block', sub })}
                />
                <ActionButton icon="delete" color="var(--th-error-text)" label="Delete" onClick={() => setConfirmAction({ type: 'delete', sub })} />
                <span className="ml-auto text-xs" style={{ color: 'var(--th-text-muted)' }}>{fmtDateTime(sub.created_at)}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--th-text-muted)' }}>
              <span className="material-symbols-outlined text-3xl mb-2 block">people</span>
              <p className="text-sm">No subscribers found</p>
            </div>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'var(--th-card)',
            border: '1px solid var(--th-card-border-subtle)',
            boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
          }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--th-border)' }}>
                {['Name', 'Phone', 'Languages', 'Mode', 'Balance', 'Status', 'Created', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 font-medium text-[10px] uppercase tracking-wider text-left"
                    style={{ color: 'var(--th-text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(sub => (
                <tr
                  key={sub.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid var(--th-border)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--th-surface)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                >
                  <td className="px-4 py-3 font-medium">{sub.name}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--th-text-secondary)' }}>{sub.phone_number}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: 'var(--th-primary-text)' }}>{sub.my_language}</span>
                    <span className="mx-1" style={{ color: 'var(--th-text-muted)' }}>&harr;</span>
                    <span className="text-xs" style={{ color: 'var(--th-info-text)' }}>{sub.target_language}</span>
                  </td>
                  <td className="px-4 py-3"><AdminBadge variant="info">{sub.mode}</AdminBadge></td>
                  <td className="px-4 py-3">
                    <span
                      className="font-mono text-xs font-medium"
                      style={{ color: parseFloat(sub.balance_minutes) < 5 ? 'var(--th-error-text)' : 'var(--th-success-text)' }}
                    >
                      {parseFloat(sub.balance_minutes).toFixed(1)} min
                    </span>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(sub)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--th-text-muted)' }}>{fmtDateTime(sub.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <ActionButton icon="edit" color="var(--th-primary-text)" label="Edit" onClick={() => handleEdit(sub)} small />
                      <ActionButton icon="add_card" color="var(--th-info-text)" label="Add Minutes" onClick={() => { setShowBalance(sub.id); setBalanceForm({ amount: 0, comment: '', type: 'topup' }); }} small />
                      <ActionButton
                        icon={sub.status === 'blocked' ? 'lock_open' : 'block'}
                        color={sub.status === 'blocked' ? 'var(--th-success-text)' : 'var(--th-warning-text)'}
                        label={sub.status === 'blocked' ? 'Unblock' : 'Block'}
                        onClick={() => setConfirmAction({ type: 'block', sub })}
                        small
                      />
                      <ActionButton icon="delete" color="var(--th-error-text)" label="Delete" onClick={() => setConfirmAction({ type: 'delete', sub })} small />
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center" style={{ color: 'var(--th-text-muted)' }}>No subscribers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal */}
      <AdminModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === 'delete' ? 'Delete Subscriber' : confirmAction?.sub.status === 'blocked' ? 'Unblock Subscriber' : 'Block Subscriber'}
        actions={
          <>
            <button onClick={() => setConfirmAction(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--th-text-muted)' }}>
              Cancel
            </button>
            <button
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === 'delete') handleDelete(confirmAction.sub.id);
                else handleBlock(confirmAction.sub);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--th-error-bg)', color: 'var(--th-error-text)' }}
            >
              {confirmAction?.type === 'delete' ? 'Delete' : confirmAction?.sub.status === 'blocked' ? 'Unblock' : 'Block'}
            </button>
          </>
        }
      >
        <p className="text-sm" style={{ color: 'var(--th-text-secondary)' }}>
          {confirmAction?.type === 'delete'
            ? `Delete subscriber "${confirmAction.sub.name}" permanently?`
            : confirmAction?.sub.status === 'blocked'
              ? `Unblock subscriber "${confirmAction?.sub.name}"?`
              : `Block subscriber "${confirmAction?.sub.name}"?`
          }
        </p>
      </AdminModal>

      {/* Add Balance Modal */}
      <AdminModal
        open={!!showBalance}
        onClose={() => setShowBalance(null)}
        title="Add Minutes"
        actions={
          <>
            <button onClick={() => setShowBalance(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--th-text-muted)' }}>Cancel</button>
            <button onClick={handleAddBalance} disabled={!balanceForm.amount}
              className="btn-primary px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              Add Minutes
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <AdminFormField label="Amount (minutes)">
            <input type="number" value={balanceForm.amount} onChange={e => setBalanceForm(f => ({ ...f, amount: Number(e.target.value) }))}
              className={adminInputClass} />
          </AdminFormField>
          <AdminFormField label="Type">
            <select value={balanceForm.type} onChange={e => setBalanceForm(f => ({ ...f, type: e.target.value as 'topup' | 'gift' }))}
              className={adminSelectClass}>
              <option value="topup">Top-up (paid)</option>
              <option value="gift">Gift (free)</option>
            </select>
          </AdminFormField>
          <AdminFormField label="Comment">
            <input value={balanceForm.comment} onChange={e => setBalanceForm(f => ({ ...f, comment: e.target.value }))}
              placeholder="Optional note..." className={adminInputClass} />
          </AdminFormField>
        </div>
      </AdminModal>

      {/* Create/Edit Modal */}
      <AdminModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingId(null); }}
        title={editingId ? 'Edit Subscriber' : 'New Subscriber'}
        actions={
          <>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--th-text-muted)' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name || !form.phone_number}
              className="btn-primary px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminFormField label="Name *">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={adminInputClass} />
            </AdminFormField>
            <AdminFormField label="Phone *">
              <input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                placeholder="+1..." className={adminInputClass} />
            </AdminFormField>
          </div>
          <AdminFormField label="Email">
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={adminInputClass} />
          </AdminFormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminFormField label="My Language">
              <select value={form.my_language} onChange={e => setForm(f => ({ ...f, my_language: e.target.value }))} className={adminSelectClass}>
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </AdminFormField>
            <AdminFormField label="Target Language">
              <select value={form.target_language} onChange={e => setForm(f => ({ ...f, target_language: e.target.value }))} className={adminSelectClass}>
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </AdminFormField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminFormField label="Translation Mode">
              <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as typeof DEFAULT_FORM.mode }))} className={adminSelectClass}>
                <option value="voice">Voice</option>
                <option value="text">Text only</option>
                <option value="both">Voice + Text</option>
              </select>
            </AdminFormField>
            <AdminFormField label="Who Hears Translation">
              <select value={form.who_hears} onChange={e => setForm(f => ({ ...f, who_hears: e.target.value as typeof DEFAULT_FORM.who_hears }))} className={adminSelectClass}>
                <option value="subscriber">Only subscriber</option>
                <option value="both">Both parties</option>
              </select>
            </AdminFormField>
          </div>
          <AdminFormField label="Greeting Text">
            <textarea value={form.greeting_text} onChange={e => setForm(f => ({ ...f, greeting_text: e.target.value }))}
              rows={2} className={`${adminInputClass} resize-none`} />
          </AdminFormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminFormField label="TTS Provider">
              <select value={form.tts_provider} onChange={e => setForm(f => ({ ...f, tts_provider: e.target.value }))} className={adminSelectClass}>
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI</option>
                <option value="xai">xAI Grok</option>
              </select>
            </AdminFormField>
            <AdminFormField label="Balance (minutes)">
              <input type="number" value={form.balance_minutes} onChange={e => setForm(f => ({ ...f, balance_minutes: Number(e.target.value) }))}
                className={adminInputClass} />
            </AdminFormField>
          </div>
          <AdminFormField label="Telegram Chat ID">
            <input value={form.telegram_chat_id} onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
              placeholder="Optional" className={adminInputClass} />
          </AdminFormField>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="rounded" />
            <span className="text-sm" style={{ color: 'var(--th-text-secondary)' }}>Enabled</span>
          </label>
        </div>
      </AdminModal>
    </div>
  );
}

function ActionButton({ icon, color, label, onClick, small }: {
  icon: string; color: string; label: string; onClick: () => void; small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`${small ? 'p-1.5' : 'p-2'} rounded-lg transition-colors`}
      style={{ color }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--th-surface)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = ''; }}
      aria-label={label}
      title={label}
    >
      <span className="material-symbols-outlined text-base">{icon}</span>
    </button>
  );
}
