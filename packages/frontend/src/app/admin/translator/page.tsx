'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Subscriber {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  my_language: string;
  target_language: string;
  mode: string;
  who_hears: string;
  tone: string;
  greeting_text: string;
  tts_provider: string;
  tts_voice_id: string | null;
  telegram_chat_id: string | null;
  balance_minutes: string;
  enabled: boolean;
  blocked: boolean;
  blocked_reason: string | null;
  created_at: string;
}

interface Transaction {
  id: string;
  type: string;
  minutes: number;
  comment: string | null;
  created_at: string;
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
];

const VOICES = [
  { value: 'ara', label: 'Ara', gender: 'Female' },
  { value: 'eve', label: 'Eve', gender: 'Female' },
  { value: 'rex', label: 'Rex', gender: 'Male' },
  { value: 'sal', label: 'Sal', gender: 'Male' },
  { value: 'leo', label: 'Leo', gender: 'Male' },
];

const MODES = [
  { value: 'voice', label: 'Voice' },
  { value: 'text', label: 'Text' },
  { value: 'both', label: 'Both' },
];

const WHO_HEARS = [
  { value: 'subscriber', label: 'Subscriber only' },
  { value: 'both', label: 'Both parties' },
];

const TONES = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'business', label: 'Business' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'medical', label: 'Medical' },
  { value: 'legal', label: 'Legal' },
];

const inputCls = "w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 outline-none focus:border-blue-500/50";
const selectCls = inputCls;
const labelCls = "text-xs font-medium block mb-1";

export default function AdminTranslator() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [selected, setSelected] = useState<Subscriber | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [creating, setCreating] = useState(false);

  // Balance modal
  const [balanceModal, setBalanceModal] = useState(false);
  const [balAmount, setBalAmount] = useState('');
  const [balType, setBalType] = useState<'topup' | 'gift' | 'refund'>('topup');
  const [balComment, setBalComment] = useState('');

  // Edit form
  const [form, setForm] = useState<Partial<Subscriber>>({});

  const load = () => {
    api.get<{ subscribers: Subscriber[] }>('/translator/subscribers')
      .then(r => setSubscribers(r.subscribers))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const selectSubscriber = async (sub: Subscriber) => {
    setSelected(sub);
    setEditMode(false);
    setCreating(false);
    setForm({});
    const data = await api.get<{ transactions: Transaction[] }>(`/translator/subscribers/${sub.id}/transactions`);
    setTransactions(data.transactions);
  };

  const startEdit = () => {
    if (!selected) return;
    setForm({ ...selected });
    setEditMode(true);
    setCreating(false);
  };

  const startCreate = () => {
    setSelected(null);
    setForm({ my_language: 'ru', target_language: 'en', mode: 'voice', who_hears: 'subscriber', tts_voice_id: 'eve', tone: 'neutral', enabled: true });
    setCreating(true);
    setEditMode(false);
  };

  const saveForm = async () => {
    if (creating) {
      const created = await api.post<Subscriber>('/translator/subscribers', form);
      setSubscribers(prev => [...prev, created]);
      setCreating(false);
      selectSubscriber(created);
    } else if (editMode && selected) {
      const updated = await api.put<Subscriber>(`/translator/subscribers/${selected.id}`, form);
      setSubscribers(prev => prev.map(s => s.id === updated.id ? updated : s));
      setSelected(updated);
      setEditMode(false);
    }
    load();
  };

  const deleteSubscriber = async () => {
    if (!selected || !confirm('Delete this subscriber?')) return;
    await api.delete(`/translator/subscribers/${selected.id}`);
    setSelected(null);
    load();
  };

  const adjustBalance = async () => {
    if (!selected || !balAmount) return;
    await api.post(`/translator/subscribers/${selected.id}/balance`, {
      minutes: parseFloat(balAmount),
      type: balType,
      comment: balComment || undefined,
    });
    setBalanceModal(false);
    setBalAmount('');
    setBalComment('');
    selectSubscriber(selected);
    load();
  };

  const toggleEnabled = async (sub: Subscriber) => {
    await api.put(`/translator/subscribers/${sub.id}`, { enabled: !sub.enabled });
    load();
    if (selected?.id === sub.id) selectSubscriber({ ...sub, enabled: !sub.enabled });
  };

  const filtered = subscribers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.phone_number.includes(search)
  );

  const balance = selected ? parseFloat(selected.balance_minutes) : 0;

  if (loading) return <div className="p-8 text-center opacity-50">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold">Translator Subscribers</h1>
          <p className="text-sm mt-1" style={{ color: '#c2c6d6' }}>Manage translator service subscribers</p>
        </div>
        <button onClick={startCreate}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 transition">
          + Add Subscriber
        </button>
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or phone..."
        className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 w-full max-w-md outline-none focus:border-blue-500/50"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscriber List */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: 'rgba(66,71,84,0.15)' }}>
                <th className="px-4 py-3 font-medium" style={{ color: '#c2c6d6' }}>Name</th>
                <th className="px-4 py-3 font-medium" style={{ color: '#c2c6d6' }}>Phone</th>
                <th className="px-4 py-3 font-medium" style={{ color: '#c2c6d6' }}>Languages</th>
                <th className="px-4 py-3 font-medium" style={{ color: '#c2c6d6' }}>Mode</th>
                <th className="px-4 py-3 font-medium" style={{ color: '#c2c6d6' }}>Balance</th>
                <th className="px-4 py-3 font-medium" style={{ color: '#c2c6d6' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sub => (
                <tr key={sub.id}
                  onClick={() => selectSubscriber(sub)}
                  className="border-b cursor-pointer hover:bg-white/5 transition"
                  style={{ borderColor: 'rgba(66,71,84,0.1)', background: selected?.id === sub.id ? 'rgba(173,198,255,0.05)' : undefined }}>
                  <td className="px-4 py-3 font-medium">{sub.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{sub.phone_number}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(173,198,255,0.1)', color: '#adc6ff' }}>
                      {sub.my_language} → {sub.target_language}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize">{sub.mode}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: parseFloat(sub.balance_minutes) < 5 ? '#fbbf24' : '#4ade80' }}>
                    {parseFloat(sub.balance_minutes).toFixed(1)} min
                  </td>
                  <td className="px-4 py-3">
                    {sub.blocked ? (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>Blocked</span>
                    ) : sub.enabled ? (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>Active</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>Disabled</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center opacity-50">No subscribers found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail / Edit Panel */}
        <div className="glass-panel rounded-2xl p-5 space-y-5">
          {(editMode || creating) ? (
            <>
              <h3 className="font-headline font-bold text-lg">{creating ? 'New Subscriber' : 'Edit Subscriber'}</h3>

              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Name</label>
                  <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone Number</label>
                  <input value={form.phone_number || ''} onChange={e => setForm({ ...form, phone_number: e.target.value })} className={inputCls} placeholder="+14155551234" />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value || undefined })} className={inputCls} placeholder="optional" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>My Language</label>
                    <select value={form.my_language || 'ru'} onChange={e => setForm({ ...form, my_language: e.target.value })} className={selectCls}>
                      {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Target Language</label>
                    <select value={form.target_language || 'en'} onChange={e => setForm({ ...form, target_language: e.target.value })} className={selectCls}>
                      {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Mode</label>
                    <select value={form.mode || 'voice'} onChange={e => setForm({ ...form, mode: e.target.value })} className={selectCls}>
                      {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Who Hears</label>
                    <select value={form.who_hears || 'subscriber'} onChange={e => setForm({ ...form, who_hears: e.target.value })} className={selectCls}>
                      {WHO_HEARS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Tone</label>
                  <select value={form.tone || 'neutral'} onChange={e => setForm({ ...form, tone: e.target.value })} className={selectCls}>
                    {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Greeting Text</label>
                  <textarea value={form.greeting_text || ''} onChange={e => setForm({ ...form, greeting_text: e.target.value })}
                    className={inputCls + ' min-h-[60px] resize-y'} rows={2} />
                </div>
                <div>
                  <label className={labelCls}>Voice</label>
                  <select value={form.tts_voice_id || 'eve'} onChange={e => setForm({ ...form, tts_voice_id: e.target.value })} className={selectCls}>
                    <optgroup label="Female">
                      {VOICES.filter(v => v.gender === 'Female').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </optgroup>
                    <optgroup label="Male">
                      {VOICES.filter(v => v.gender === 'Male').map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Telegram Chat ID</label>
                  <input value={form.telegram_chat_id || ''} onChange={e => setForm({ ...form, telegram_chat_id: e.target.value || undefined })} className={inputCls} placeholder="optional" />
                </div>
                {creating && (
                  <div>
                    <label className={labelCls}>Initial Balance (minutes)</label>
                    <input type="number" step="0.1" value={form.balance_minutes || ''} onChange={e => setForm({ ...form, balance_minutes: e.target.value })} className={inputCls} placeholder="0" />
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setEditMode(false); setCreating(false); }} className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition flex-1">Cancel</button>
                <button onClick={saveForm} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 font-medium transition flex-1">Save</button>
              </div>
            </>
          ) : selected ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-headline font-bold text-lg">{selected.name}</h3>
                  <p className="text-xs mt-1 font-mono" style={{ color: '#c2c6d6' }}>{selected.phone_number}</p>
                  {selected.email && <p className="text-xs" style={{ color: '#c2c6d6' }}>{selected.email}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={startEdit} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 transition">Edit</button>
                  <button onClick={deleteSubscriber} className="px-3 py-1.5 rounded-lg text-xs hover:bg-red-500/20 transition" style={{ color: '#f87171' }}>Delete</button>
                </div>
              </div>

              {/* Balance */}
              <div className="glass-panel rounded-xl p-4">
                <div className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: '#c2c6d6' }}>Balance</div>
                <div className="text-3xl font-headline font-bold" style={{ color: balance < 5 ? '#fbbf24' : '#4ade80' }}>
                  {balance.toFixed(1)} <span className="text-sm font-normal opacity-60">min</span>
                </div>
                <button onClick={() => setBalanceModal(true)}
                  className="mt-3 px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 transition">
                  Adjust Balance
                </button>
              </div>

              {/* Settings Summary */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span style={{ color: '#c2c6d6' }}>Languages</span><span>{selected.my_language} → {selected.target_language}</span></div>
                <div className="flex justify-between"><span style={{ color: '#c2c6d6' }}>Mode</span><span className="capitalize">{selected.mode}</span></div>
                <div className="flex justify-between"><span style={{ color: '#c2c6d6' }}>Who Hears</span><span className="capitalize">{selected.who_hears}</span></div>
                <div className="flex justify-between"><span style={{ color: '#c2c6d6' }}>Tone</span><span className="capitalize">{selected.tone || 'neutral'}</span></div>
                <div className="flex justify-between"><span style={{ color: '#c2c6d6' }}>Voice</span><span className="capitalize">{selected.tts_voice_id || 'eve'}</span></div>
                {selected.telegram_chat_id && <div className="flex justify-between"><span style={{ color: '#c2c6d6' }}>Telegram</span><span className="font-mono">{selected.telegram_chat_id}</span></div>}
              </div>

              {/* Greeting */}
              <div>
                <div className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: '#c2c6d6' }}>Greeting</div>
                <p className="text-xs italic" style={{ color: '#e5e7eb' }}>&ldquo;{selected.greeting_text}&rdquo;</p>
              </div>

              {/* Enable / Block toggle */}
              <div className="flex gap-2">
                <button onClick={() => toggleEnabled(selected)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition flex-1"
                  style={selected.enabled
                    ? { background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }
                    : { background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }
                  }>
                  {selected.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>

              {/* Recent Transactions */}
              <div>
                <div className="text-xs uppercase tracking-wider font-medium mb-2" style={{ color: '#c2c6d6' }}>Balance History</div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {transactions.map(t => (
                    <div key={t.id} className="flex justify-between items-center text-xs py-1 border-b" style={{ borderColor: 'rgba(66,71,84,0.1)' }}>
                      <div>
                        <span className="font-medium capitalize">{t.type}</span>
                        {t.comment && <span className="ml-2" style={{ color: '#c2c6d6' }}>{t.comment}</span>}
                      </div>
                      <span className="font-mono" style={{ color: t.minutes >= 0 ? '#4ade80' : '#f87171' }}>
                        {t.minutes >= 0 ? '+' : ''}{t.minutes.toFixed(1)} min
                      </span>
                    </div>
                  ))}
                  {transactions.length === 0 && <p className="text-xs opacity-50">No transactions yet</p>}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center opacity-50 py-12">
              <span className="material-symbols-outlined text-3xl mb-2 block">translate</span>
              Select a subscriber
            </div>
          )}
        </div>
      </div>

      {/* Balance Adjustment Modal */}
      {balanceModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setBalanceModal(false)}>
          <div className="glass-panel rounded-2xl p-6 w-96 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-headline font-bold">Adjust Balance</h3>
            <p className="text-xs" style={{ color: '#c2c6d6' }}>{selected.name} — Current: {balance.toFixed(1)} min</p>

            <div>
              <label className={labelCls}>Type</label>
              <select value={balType} onChange={e => setBalType(e.target.value as any)} className={selectCls}>
                <option value="topup">Top Up</option>
                <option value="gift">Gift</option>
                <option value="refund">Refund</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Minutes</label>
              <input type="number" step="0.1" value={balAmount} onChange={e => setBalAmount(e.target.value)}
                className={inputCls} placeholder="10.0" />
            </div>
            <div>
              <label className={labelCls}>Comment</label>
              <input value={balComment} onChange={e => setBalComment(e.target.value)} className={inputCls} placeholder="Optional" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBalanceModal(false)} className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition">Cancel</button>
              <button onClick={adjustBalance} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 font-medium transition">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
