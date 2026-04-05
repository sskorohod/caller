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
  enabled: boolean;
  created_at: string;
}

interface Session {
  id: string;
  subscriber_id: string;
  duration_seconds: number;
  minutes_used: string;
  cost_usd: string;
  status: string;
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

export default function TranslatorPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'subscribers' | 'sessions'>('subscribers');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [subsRes, sessRes] = await Promise.all([
        api.get<{ subscribers: Subscriber[] }>('/translator/subscribers'),
        api.get<{ sessions: Session[] }>('/translator/sessions'),
      ]);
      setSubscribers(subsRes.subscribers);
      setSessions(sessRes.sessions);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
      mode: sub.mode as any,
      who_hears: sub.who_hears as any,
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this subscriber?')) return;
    await api.delete(`/translator/subscribers/${id}`);
    await loadData();
  };

  const handleToggle = async (sub: Subscriber) => {
    await api.put(`/translator/subscribers/${sub.id}`, { enabled: !sub.enabled });
    await loadData();
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Translator</h1>
          <p className="text-sm text-gray-400 mt-1">Manage translator subscribers and view session history</p>
        </div>
        <button
          onClick={() => { setForm(DEFAULT_FORM); setEditingId(null); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
        >
          + Add Subscriber
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('subscribers')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'subscribers' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Subscribers ({subscribers.length})
        </button>
        <button
          onClick={() => setTab('sessions')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'sessions' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Sessions ({sessions.length})
        </button>
      </div>

      {/* Subscribers Table */}
      {tab === 'subscribers' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50">
              <tr className="text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Languages</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {subscribers.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-white font-medium">{sub.name}</td>
                  <td className="px-4 py-3 text-gray-300">{sub.phone_number}</td>
                  <td className="px-4 py-3 text-gray-300">{sub.my_language} &harr; {sub.target_language}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">{sub.mode}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${parseFloat(sub.balance_minutes) < 5 ? 'text-red-400' : 'text-green-400'}`}>
                      {parseFloat(sub.balance_minutes).toFixed(0)} min
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(sub)} className={`px-2 py-0.5 rounded text-xs font-medium ${sub.enabled ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                      {sub.enabled ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => handleEdit(sub)} className="text-blue-400 hover:text-blue-300 text-xs">Edit</button>
                    <button onClick={() => handleDelete(sub.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {subscribers.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No subscribers yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Sessions Table */}
      {tab === 'sessions' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50">
              <tr className="text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Minutes Used</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sessions.map(sess => (
                <tr key={sess.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-gray-300">{new Date(sess.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-white">{Math.floor(sess.duration_seconds / 60)}m {sess.duration_seconds % 60}s</td>
                  <td className="px-4 py-3 text-gray-300">{parseFloat(sess.minutes_used).toFixed(1)}</td>
                  <td className="px-4 py-3 text-gray-300">${parseFloat(sess.cost_usd).toFixed(3)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${sess.status === 'completed' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                      {sess.status}
                    </span>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No sessions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              {editingId ? 'Edit Subscriber' : 'Add Subscriber'}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Phone *</label>
                  <input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                    placeholder="+1..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">My Language</label>
                  <select value={form.my_language} onChange={e => setForm(f => ({ ...f, my_language: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Target Language</label>
                  <select value={form.target_language} onChange={e => setForm(f => ({ ...f, target_language: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Translation Mode</label>
                  <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                    <option value="voice">Voice</option>
                    <option value="text">Text only</option>
                    <option value="both">Voice + Text</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Who Hears Translation</label>
                  <select value={form.who_hears} onChange={e => setForm(f => ({ ...f, who_hears: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                    <option value="subscriber">Only subscriber</option>
                    <option value="both">Both parties</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Greeting Text</label>
                <textarea value={form.greeting_text} onChange={e => setForm(f => ({ ...f, greeting_text: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">TTS Provider</label>
                  <select value={form.tts_provider} onChange={e => setForm(f => ({ ...f, tts_provider: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="openai">OpenAI</option>
                    <option value="xai">xAI Grok</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Balance (minutes)</label>
                  <input type="number" value={form.balance_minutes} onChange={e => setForm(f => ({ ...f, balance_minutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Telegram Chat ID</label>
                <input value={form.telegram_chat_id} onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
                  placeholder="Optional" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                  className="rounded" />
                <label className="text-sm text-gray-300">Enabled</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.phone_number}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
