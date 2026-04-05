'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

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

const LANGUAGES = [
  { value: 'ru', label: 'Russian' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
  { value: 'pt', label: 'Portuguese' },
];

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

const inputStyle = { background: '#2f3542', color: '#dde2f3', border: 'none' };
const btnPrimary = { background: '#adc6ff', color: '#002e6a' };

export default function AdminSubscribersPage() {
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
      active: { bg: 'rgba(74, 222, 128, 0.1)', text: '#4ade80' },
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold">Subscribers</h1>
          <p className="text-sm mt-1" style={{ color: '#c2c6d6' }}>{subscribers.length} total subscribers</p>
        </div>
        <button
          onClick={() => { setForm(DEFAULT_FORM); setEditingId(null); setShowForm(true); }}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition hover:opacity-90"
          style={btnPrimary}
        >
          <span className="material-symbols-outlined text-lg">add</span>
          New Subscriber
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: '#c2c6d6' }}>search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
            style={inputStyle}
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as typeof filter)}
          className="px-4 py-2.5 rounded-xl text-sm"
          style={inputStyle}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ borderBottom: '1px solid rgba(66, 71, 84, 0.15)' }}>
              <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: '#c2c6d6' }}>Name</th>
              <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: '#c2c6d6' }}>Phone</th>
              <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: '#c2c6d6' }}>Languages</th>
              <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: '#c2c6d6' }}>Mode</th>
              <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: '#c2c6d6' }}>Balance</th>
              <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: '#c2c6d6' }}>Status</th>
              <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: '#c2c6d6' }}>Created</th>
              <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider" style={{ color: '#c2c6d6' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(sub => (
              <tr key={sub.id} className="hover:bg-white/[0.02] transition" style={{ borderBottom: '1px solid rgba(66, 71, 84, 0.15)' }}>
                <td className="px-5 py-3.5 font-medium">{sub.name}</td>
                <td className="px-5 py-3.5 font-mono text-xs" style={{ color: '#c2c6d6' }}>{sub.phone_number}</td>
                <td className="px-5 py-3.5">
                  <span className="text-xs" style={{ color: '#adc6ff' }}>{sub.my_language}</span>
                  <span className="mx-1 opacity-30">&harr;</span>
                  <span className="text-xs" style={{ color: '#d0bcff' }}>{sub.target_language}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="px-2 py-0.5 rounded-lg text-xs" style={{ background: 'rgba(173, 198, 255, 0.1)', color: '#adc6ff' }}>{sub.mode}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`font-mono text-xs font-medium ${parseFloat(sub.balance_minutes) < 5 ? 'text-red-400' : ''}`} style={parseFloat(sub.balance_minutes) >= 5 ? { color: '#4ade80' } : {}}>
                    {parseFloat(sub.balance_minutes).toFixed(1)} min
                  </span>
                </td>
                <td className="px-5 py-3.5">{getStatusBadge(sub)}</td>
                <td className="px-5 py-3.5 text-xs" style={{ color: '#c2c6d6' }}>{new Date(sub.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(sub)} className="p-1.5 rounded-lg hover:bg-white/5 transition" title="Edit">
                      <span className="material-symbols-outlined text-base" style={{ color: '#adc6ff' }}>edit</span>
                    </button>
                    <button onClick={() => { setShowBalance(sub.id); setBalanceForm({ amount: 0, comment: '', type: 'topup' }); }} className="p-1.5 rounded-lg hover:bg-white/5 transition" title="Add Minutes">
                      <span className="material-symbols-outlined text-base" style={{ color: '#d0bcff' }}>add_card</span>
                    </button>
                    <button onClick={() => handleBlock(sub)} className="p-1.5 rounded-lg hover:bg-white/5 transition" title={sub.status === 'blocked' ? 'Unblock' : 'Block'}>
                      <span className="material-symbols-outlined text-base" style={{ color: sub.status === 'blocked' ? '#4ade80' : '#fbbf24' }}>
                        {sub.status === 'blocked' ? 'lock_open' : 'block'}
                      </span>
                    </button>
                    <button onClick={() => handleDelete(sub.id)} className="p-1.5 rounded-lg hover:bg-white/5 transition" title="Delete">
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

      {/* Add Balance Modal */}
      {showBalance && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-headline font-bold mb-4">Add Minutes</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>Amount (minutes)</label>
                <input type="number" value={balanceForm.amount} onChange={e => setBalanceForm(f => ({ ...f, amount: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>Type</label>
                <select value={balanceForm.type} onChange={e => setBalanceForm(f => ({ ...f, type: e.target.value as 'topup' | 'gift' }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle}>
                  <option value="topup">Top-up (paid)</option>
                  <option value="gift">Gift (free)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>Comment</label>
                <input value={balanceForm.comment} onChange={e => setBalanceForm(f => ({ ...f, comment: e.target.value }))}
                  placeholder="Optional note..." className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowBalance(null)} className="px-4 py-2.5 rounded-xl text-sm" style={{ color: '#c2c6d6' }}>Cancel</button>
              <button onClick={handleAddBalance} disabled={!balanceForm.amount}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition hover:opacity-90" style={btnPrimary}>
                Add Minutes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-headline font-bold mb-5">
              {editingId ? 'Edit Subscriber' : 'New Subscriber'}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>Phone *</label>
                  <input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                    placeholder="+1..." className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>My Language</label>
                  <select value={form.my_language} onChange={e => setForm(f => ({ ...f, my_language: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle}>
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>Target Language</label>
                  <select value={form.target_language} onChange={e => setForm(f => ({ ...f, target_language: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle}>
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>Translation Mode</label>
                  <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as typeof DEFAULT_FORM.mode }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle}>
                    <option value="voice">Voice</option>
                    <option value="text">Text only</option>
                    <option value="both">Voice + Text</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>Who Hears Translation</label>
                  <select value={form.who_hears} onChange={e => setForm(f => ({ ...f, who_hears: e.target.value as typeof DEFAULT_FORM.who_hears }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle}>
                    <option value="subscriber">Only subscriber</option>
                    <option value="both">Both parties</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>Greeting Text</label>
                <textarea value={form.greeting_text} onChange={e => setForm(f => ({ ...f, greeting_text: e.target.value }))}
                  rows={2} className="w-full px-4 py-2.5 rounded-xl text-sm resize-none" style={inputStyle} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>TTS Provider</label>
                  <select value={form.tts_provider} onChange={e => setForm(f => ({ ...f, tts_provider: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle}>
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="openai">OpenAI</option>
                    <option value="xai">xAI Grok</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>Balance (minutes)</label>
                  <input type="number" value={form.balance_minutes} onChange={e => setForm(f => ({ ...f, balance_minutes: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#c2c6d6' }}>Telegram Chat ID</label>
                <input value={form.telegram_chat_id} onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
                  placeholder="Optional" className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle} />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                  className="rounded" />
                <span className="text-sm" style={{ color: '#c2c6d6' }}>Enabled</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2.5 rounded-xl text-sm" style={{ color: '#c2c6d6' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.phone_number}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition hover:opacity-90" style={btnPrimary}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
