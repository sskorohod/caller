'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface PromoCode {
  id: string;
  code: string;
  minutes: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export default function PromoPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', minutes: 5, max_uses: 100, expires_at: '' });
  const [saving, setSaving] = useState(false);

  const load = () => api.get<{ promo_codes: PromoCode[] }>('/admin/promo').then(r => setCodes(r.promo_codes)).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/admin/promo', { ...form, code: form.code.toUpperCase(), expires_at: form.expires_at || undefined });
      setShowForm(false);
      setForm({ code: '', minutes: 5, max_uses: 100, expires_at: '' });
      await load();
    } catch (err) { alert((err as Error).message); }
    setSaving(false);
  };

  const handleToggle = async (id: string, active: boolean) => {
    await api.put(`/admin/promo/${id}`, { active: !active });
    await load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-headline font-bold">Promo Codes</h1>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: '#adc6ff', color: '#002e6a' }}>+ Create Code</button>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: '#c2c6d6' }}>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Minutes</th>
              <th className="px-4 py-3 font-medium">Uses</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {codes.map(c => (
              <tr key={c.id} className="border-t" style={{ borderColor: 'rgba(66,71,84,0.15)' }}>
                <td className="px-4 py-3 font-mono font-bold">{c.code}</td>
                <td className="px-4 py-3">{parseFloat(c.minutes).toFixed(0)} min</td>
                <td className="px-4 py-3">{c.used_count} / {c.max_uses}</td>
                <td className="px-4 py-3 text-xs" style={{ color: '#c2c6d6' }}>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs font-bold" style={c.active ? { background: 'rgba(74,222,128,0.1)', color: '#4ade80' } : { background: 'rgba(107,114,128,0.1)', color: '#6b7280' }}>
                    {c.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleToggle(c.id, c.active)} className="text-xs" style={{ color: '#adc6ff' }}>
                    {c.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {codes.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center opacity-50">No promo codes yet</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="glass-panel rounded-2xl p-6 w-full max-w-md" style={{ background: '#1a202c' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Create Promo Code</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#c2c6d6' }}>Code</label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="WELCOME5"
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono" style={{ background: '#2f3542', color: '#dde2f3', border: 'none', outline: 'none' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#c2c6d6' }}>Free Minutes</label>
                  <input type="number" value={form.minutes} onChange={e => setForm(f => ({ ...f, minutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: '#2f3542', color: '#dde2f3', border: 'none', outline: 'none' }} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#c2c6d6' }}>Max Uses</label>
                  <input type="number" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: '#2f3542', color: '#dde2f3', border: 'none', outline: 'none' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#c2c6d6' }}>Expires (optional)</label>
                <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: '#2f3542', color: '#dde2f3', border: 'none', outline: 'none' }} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm" style={{ color: '#c2c6d6' }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.code} className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: '#adc6ff', color: '#002e6a' }}>
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
