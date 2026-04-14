'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useIsMobile } from '@/lib/useBreakpoint';

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

import { LANGUAGES } from '@/lib/constants';

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'blocked' | 'disabled'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [showBalance, setShowBalance] = useState<string | null>(null);
  const [balanceForm, setBalanceForm] = useState({ amount: 0, comment: '', type: 'topup' as 'topup' | 'gift' });

  const loadData = useCallback(async () => {
    try {
      const res = await api.get<{ subscribers: Subscriber[] }>('/admin/subscribers');
      setSubscribers(res.subscribers);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
      await loadData();
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
    if (!confirm(`${action === 'block' ? 'Block' : 'Unblock'} ${sub.name}?`)) return;
    try {
      await api.post(`/admin/subscribers/${sub.id}/block`, { action });
      await loadData();
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this subscriber permanently?')) return;
    try {
      await api.delete(`/translator/subscribers/${id}`);
      await loadData();
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    }
  };

  const handleAddBalance = async () => {
    if (!showBalance) return;
    try {
      await api.post(`/admin/subscribers/${showBalance}/balance`, balanceForm);
      setShowBalance(null);
      setBalanceForm({ amount: 0, comment: '', type: 'topup' });
      await loadData();
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    }
  };

  const getStatusBadge = (sub: Subscriber) => {
    const status = sub.status || (sub.enabled ? 'active' : 'disabled');
    const colors: Record<string, { bg: string; text: string }> = {
      active: { bg: 'rgba(74, 222, 128, 0.1)', text: 'var(--th-success-text)' },
      blocked: { bg: 'rgba(248, 113, 113, 0.1)', text: '#f87171' },
      disabled: { bg: 'rgba(156, 163, 175, 0.1)', text: '#9ca3af' },
    };
    const c = colors[status] || colors.disabled;
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: c.bg, color: c.text }}>
        {status}
      </span>
    );
  };

  if (loading) return <div className="p-8 text-center opacity-50">Loading subscribers...</div>;

  return (
    <div className="px-3 py-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-headline font-bold">Subscribers</h1>
          <p className="text-xs md:text-sm mt-1" style={{ color: 'var(--th-text-secondary)' }}>{subscribers.length} total subscribers</p>
        </div>
        <button
          onClick={() => { setForm(DEFAULT_FORM); setEditingId(null); setShowForm(true); }}
          className="btn-primary px-4 py-2.5 px-3 md:px-4 min-h-[44px] md:min-h-0 rounded-xl text-sm font-semibold flex items-center gap-1 md:gap-2 transition hover:opacity-90 whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          <span className="hidden md:inline">New Subscriber</span>
          <span className="md:hidden">Add</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-3">
        <div className="relative flex-1 md:max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: 'var(--th-text-secondary)' }}>search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="input-base w-full pl-10 pr-4 py-2.5 min-h-[44px] md:min-h-0 rounded-xl text-sm"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as typeof filter)}
          className="input-base px-4 py-2.5 min-h-[44px] md:min-h-0 rounded-xl text-sm"
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
            <div key={sub.id} className="glass-panel rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{sub.name}</span>
                {getStatusBadge(sub)}
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--th-text-secondary)' }}>
                <span className="font-mono">{sub.phone_number}</span>
                <span className="px-1.5 py-0.5 rounded-lg" style={{ background: 'rgba(173, 198, 255, 0.1)', color: 'var(--th-primary-light)' }}>{sub.mode}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span style={{ color: 'var(--th-primary-light)' }}>{sub.my_language}</span>
                  <span className="mx-1 opacity-30">&harr;</span>
                  <span style={{ color: 'var(--th-accent-purple)' }}>{sub.target_language}</span>
                </div>
                <span className={`font-mono font-medium ${parseFloat(sub.balance_minutes) < 5 ? 'text-red-400' : ''}`} style={parseFloat(sub.balance_minutes) >= 5 ? { color: 'var(--th-success-text)' } : {}}>
                  {parseFloat(sub.balance_minutes).toFixed(1)} min
                </span>
              </div>
              <div className="flex items-center gap-1 pt-1" style={{ borderTop: '1px solid var(--th-border)' }}>
                <button onClick={() => handleEdit(sub)} className="p-2 rounded-lg hover:bg-white/5 transition" aria-label="Edit" title="Edit">
                  <span className="material-symbols-outlined text-base" style={{ color: 'var(--th-primary-light)' }}>edit</span>
                </button>
                <button onClick={() => { setShowBalance(sub.id); setBalanceForm({ amount: 0, comment: '', type: 'topup' }); }} className="p-2 rounded-lg hover:bg-white/5 transition" aria-label="Add Minutes" title="Add Minutes">
                  <span className="material-symbols-outlined text-base" style={{ color: 'var(--th-accent-purple)' }}>add_card</span>
                </button>
                <button onClick={() => handleBlock(sub)} className="p-2 rounded-lg hover:bg-white/5 transition" aria-label={sub.status === 'blocked' ? 'Unblock' : 'Block'} title={sub.status === 'blocked' ? 'Unblock' : 'Block'}>
                  <span className="material-symbols-outlined text-base" style={{ color: sub.status === 'blocked' ? 'var(--th-success-text)' : 'var(--th-warning-text)' }}>
                    {sub.status === 'blocked' ? 'lock_open' : 'block'}
                  </span>
                </button>
                <button onClick={() => handleDelete(sub.id)} className="p-2 rounded-lg hover:bg-white/5 transition" aria-label="Delete" title="Delete">
                  <span className="material-symbols-outlined text-base" style={{ color: '#f87171' }}>delete</span>
                </button>
                <span className="ml-auto text-xs" style={{ color: 'var(--th-text-secondary)' }}>{new Date(sub.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 opacity-40 text-sm">No subscribers found</div>
          )}
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ borderBottom: '1px solid var(--th-border)' }}>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--th-text-secondary)' }}>Name</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--th-text-secondary)' }}>Phone</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--th-text-secondary)' }}>Languages</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--th-text-secondary)' }}>Mode</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--th-text-secondary)' }}>Balance</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--th-text-secondary)' }}>Status</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--th-text-secondary)' }}>Created</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--th-text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sub => (
                <tr key={sub.id} className="hover:bg-white/[0.02] transition" style={{ borderBottom: '1px solid var(--th-border)' }}>
                  <td className="px-5 py-3.5 font-medium">{sub.name}</td>
                  <td className="px-5 py-3.5 font-mono text-xs" style={{ color: 'var(--th-text-secondary)' }}>{sub.phone_number}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs" style={{ color: 'var(--th-primary-light)' }}>{sub.my_language}</span>
                    <span className="mx-1 opacity-30">&harr;</span>
                    <span className="text-xs" style={{ color: 'var(--th-accent-purple)' }}>{sub.target_language}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 rounded-lg text-xs" style={{ background: 'rgba(173, 198, 255, 0.1)', color: 'var(--th-primary-light)' }}>{sub.mode}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`font-mono text-xs font-medium ${parseFloat(sub.balance_minutes) < 5 ? 'text-red-400' : ''}`} style={parseFloat(sub.balance_minutes) >= 5 ? { color: 'var(--th-success-text)' } : {}}>
                      {parseFloat(sub.balance_minutes).toFixed(1)} min
                    </span>
                  </td>
                  <td className="px-5 py-3.5">{getStatusBadge(sub)}</td>
                  <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--th-text-secondary)' }}>{new Date(sub.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(sub)} className="p-1.5 rounded-lg hover:bg-white/5 transition" aria-label="Edit" title="Edit">
                        <span className="material-symbols-outlined text-base" style={{ color: 'var(--th-primary-light)' }}>edit</span>
                      </button>
                      <button onClick={() => { setShowBalance(sub.id); setBalanceForm({ amount: 0, comment: '', type: 'topup' }); }} className="p-1.5 rounded-lg hover:bg-white/5 transition" aria-label="Add Minutes" title="Add Minutes">
                        <span className="material-symbols-outlined text-base" style={{ color: 'var(--th-accent-purple)' }}>add_card</span>
                      </button>
                      <button onClick={() => handleBlock(sub)} className="p-1.5 rounded-lg hover:bg-white/5 transition" aria-label={sub.status === 'blocked' ? 'Unblock' : 'Block'} title={sub.status === 'blocked' ? 'Unblock' : 'Block'}>
                        <span className="material-symbols-outlined text-base" style={{ color: sub.status === 'blocked' ? 'var(--th-success-text)' : 'var(--th-warning-text)' }}>
                          {sub.status === 'blocked' ? 'lock_open' : 'block'}
                        </span>
                      </button>
                      <button onClick={() => handleDelete(sub.id)} className="p-1.5 rounded-lg hover:bg-white/5 transition" aria-label="Delete" title="Delete">
                        <span className="material-symbols-outlined text-base" style={{ color: '#f87171' }}>delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-12 text-center opacity-40">No subscribers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Balance Modal */}
      {showBalance && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="glass-panel rounded-t-2xl md:rounded-2xl w-full md:max-w-md p-5 md:p-6">
            <h2 className="text-lg font-headline font-bold mb-4">Add Minutes</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>Amount (minutes)</label>
                <input type="number" value={balanceForm.amount} onChange={e => setBalanceForm(f => ({ ...f, amount: Number(e.target.value) }))}
                  className="input-base w-full px-4 py-2.5 rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>Type</label>
                <select value={balanceForm.type} onChange={e => setBalanceForm(f => ({ ...f, type: e.target.value as 'topup' | 'gift' }))}
                  className="input-base w-full px-4 py-2.5 rounded-xl text-sm">
                  <option value="topup">Top-up (paid)</option>
                  <option value="gift">Gift (free)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>Comment</label>
                <input value={balanceForm.comment} onChange={e => setBalanceForm(f => ({ ...f, comment: e.target.value }))}
                  placeholder="Optional note..." className="input-base w-full px-4 py-2.5 rounded-xl text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowBalance(null)} className="px-4 py-2.5 min-h-[44px] md:min-h-0 rounded-xl text-sm" style={{ color: 'var(--th-text-secondary)' }}>Cancel</button>
              <button onClick={handleAddBalance} disabled={!balanceForm.amount}
                className="btn-primary px-4 py-2.5 px-5 min-h-[44px] md:min-h-0 rounded-xl text-sm font-semibold disabled:opacity-50 transition hover:opacity-90">
                Add Minutes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="glass-panel rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto p-5 md:p-6">
            <h2 className="text-lg font-headline font-bold mb-5">
              {editingId ? 'Edit Subscriber' : 'New Subscriber'}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="input-base w-full px-4 py-2.5 min-h-[44px] md:min-h-0 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>Phone *</label>
                  <input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                    placeholder="+1..." className="input-base w-full px-4 py-2.5 min-h-[44px] md:min-h-0 rounded-xl text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="input-base w-full px-4 py-2.5 rounded-xl text-sm" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>My Language</label>
                  <select value={form.my_language} onChange={e => setForm(f => ({ ...f, my_language: e.target.value }))}
                    className="input-base w-full px-4 py-2.5 rounded-xl text-sm">
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>Target Language</label>
                  <select value={form.target_language} onChange={e => setForm(f => ({ ...f, target_language: e.target.value }))}
                    className="input-base w-full px-4 py-2.5 rounded-xl text-sm">
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>Translation Mode</label>
                  <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as typeof DEFAULT_FORM.mode }))}
                    className="input-base w-full px-4 py-2.5 rounded-xl text-sm">
                    <option value="voice">Voice</option>
                    <option value="text">Text only</option>
                    <option value="both">Voice + Text</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>Who Hears Translation</label>
                  <select value={form.who_hears} onChange={e => setForm(f => ({ ...f, who_hears: e.target.value as typeof DEFAULT_FORM.who_hears }))}
                    className="input-base w-full px-4 py-2.5 rounded-xl text-sm">
                    <option value="subscriber">Only subscriber</option>
                    <option value="both">Both parties</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>Greeting Text</label>
                <textarea value={form.greeting_text} onChange={e => setForm(f => ({ ...f, greeting_text: e.target.value }))}
                  rows={2} className="input-base w-full px-4 py-2.5 rounded-xl text-sm resize-none" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>TTS Provider</label>
                  <select value={form.tts_provider} onChange={e => setForm(f => ({ ...f, tts_provider: e.target.value }))}
                    className="input-base w-full px-4 py-2.5 rounded-xl text-sm">
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="openai">OpenAI</option>
                    <option value="xai">xAI Grok</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>Balance (minutes)</label>
                  <input type="number" value={form.balance_minutes} onChange={e => setForm(f => ({ ...f, balance_minutes: Number(e.target.value) }))}
                    className="input-base w-full px-4 py-2.5 rounded-xl text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--th-text-secondary)' }}>Telegram Chat ID</label>
                <input value={form.telegram_chat_id} onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
                  placeholder="Optional" className="input-base w-full px-4 py-2.5 rounded-xl text-sm" />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                  className="rounded" />
                <span className="text-sm" style={{ color: 'var(--th-text-secondary)' }}>Enabled</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2.5 min-h-[44px] md:min-h-0 rounded-xl text-sm" style={{ color: 'var(--th-text-secondary)' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.phone_number}
                className="btn-primary px-4 py-2.5 px-5 min-h-[44px] md:min-h-0 rounded-xl text-sm font-semibold disabled:opacity-50 transition hover:opacity-90">
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
