'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { OAuthClient } from '../_lib/types';
import { fmtDate } from '../_lib/constants';
import { IconOAuth, IconCheck, IconCopy } from '../_lib/icons';

export function OAuthSection() {
  const t = useT();
  const [clients, setClients] = useState<OAuthClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [uris, setUris] = useState('');
  const [creating, setCreating] = useState(false);
  const [newClient, setNewClient] = useState<{ client_id: string; client_secret: string; name: string } | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => {
    api.get<OAuthClient[]>('/oauth/clients').then(setClients).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const redirect_uris = uris.split('\n').map(s => s.trim()).filter(Boolean);
    if (!redirect_uris.length) { setCreateError('Enter at least one redirect URI'); return; }
    setCreating(true); setCreateError('');
    try {
      const res = await api.post<{ id: string; name: string; client_id: string; client_secret: string; redirect_uris: string[]; created_at: string }>(
        '/oauth/clients', { name: name.trim(), redirect_uris }
      );
      setNewClient({ client_id: res.client_id, client_secret: res.client_secret, name: res.name });
      setName(''); setUris('');
      load();
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function deleteClientConfirm() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/oauth/clients/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      setCreateError(e.message);
      setDeleteTarget(null);
    }
  }

  function copy(text: string, setFlag: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setFlag(true);
    setTimeout(() => setFlag(false), 2000);
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://caller.yourdomain.com';

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_2px_8px_rgba(6,182,212,0.3)]">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--th-text)]">OAuth 2.0 Applications</h2>
            <p className="text-xs text-[var(--th-text-muted)]">{t('settings.oauthHint')}</p>
          </div>
        </div>
        <button
          onClick={() => { setModal(true); setNewClient(null); }}
          className="shrink-0 px-3.5 py-2 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-xs font-semibold rounded-xl transition-all active:scale-[.98] flex items-center gap-1.5 shadow-sm shadow-[var(--th-shadow-primary)]"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('settings.createOAuth')}
        </button>
      </div>

      {/* Endpoints reference */}
      <div className="bg-[var(--th-card-hover)] border border-[var(--th-primary-bg-hover)] rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-[var(--th-primary-text)]">OAuth 2.0 Endpoints (for ChatGPT GPT Actions)</p>
        {[
          { label: 'Authorization URL', value: `${origin}/oauth/authorize` },
          { label: 'Token URL', value: `${origin}/api/oauth/token` },
          { label: 'Scope', value: '(leave empty)' },
        ].map(row => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--th-primary-text)] font-medium w-36 shrink-0">{row.label}</span>
            <code className="text-xs text-[var(--th-text-dark)] font-mono bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] px-2 py-0.5 rounded">{row.value}</code>
          </div>
        ))}
      </div>

      {/* Clients table */}
      <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-12 bg-[var(--th-skeleton)] rounded-lg" />)}
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <div className="w-11 h-11 bg-[var(--th-surface)] rounded-xl flex items-center justify-center mb-3">
              <IconOAuth className="w-5 h-5 text-[var(--th-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--th-text-secondary)]">{t('settings.noOAuthApps')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[var(--th-table-header)] border-b border-[var(--th-card-border-subtle)]">
              <tr>
                {[t('settings.appName') || 'App Name', 'Client ID', t('settings.redirectUris') || 'Redirect URIs', t('settings.created') || 'Created', ''].map(h => (
                  <th key={h} className="px-3 md:px-5 py-3 text-left text-xs font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--th-card-border-subtle)]">
              {clients.map(c => (
                <tr key={c.id} className="hover:bg-[var(--th-table-row-hover)] transition-colors">
                  <td className="px-3 md:px-5 py-3.5 text-sm font-medium text-[var(--th-text)]">{c.name}</td>
                  <td className="px-3 md:px-5 py-3.5">
                    <code className="text-xs bg-[var(--th-surface)] text-[var(--th-text-secondary)] px-2 py-0.5 rounded-md font-mono">{c.client_id}</code>
                  </td>
                  <td className="px-3 md:px-5 py-3.5 text-xs text-[var(--th-text-muted)] max-w-[200px]">
                    {c.redirect_uris.map(u => <div key={u} className="truncate">{u}</div>)}
                  </td>
                  <td className="px-3 md:px-5 py-3.5 text-sm text-[var(--th-text-muted)]">{fmtDate(c.created_at)}</td>
                  <td className="px-3 md:px-5 py-3.5">
                    {deleteTarget?.id === c.id ? (
                      <div className="flex items-center gap-2">
                        <button onClick={deleteClientConfirm} className="text-xs text-[var(--th-error-text)] font-medium transition-colors">{t('settings.confirm')}</button>
                        <button onClick={() => setDeleteTarget(null)} className="text-xs text-[var(--th-text-muted)] hover:text-[var(--th-text-secondary)] font-medium transition-colors">{t('common.cancel')}</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                        className="text-xs text-[var(--th-text-muted)] hover:text-[var(--th-error-text)] transition-colors font-medium"
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Register modal */}
      {modal && (
        <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setModal(false); setNewClient(null); }}>
          <div className="bg-[var(--th-modal)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--th-card-border-subtle)]">
              <h2 className="text-base font-semibold text-[var(--th-text)]">
                {newClient ? t('settings.createOAuth') : t('settings.newOAuthApp')}
              </h2>
              <button onClick={() => { setModal(false); setNewClient(null); }} className="p-1.5 hover:bg-[var(--th-surface)] rounded-lg" aria-label="Close">
                <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {newClient ? (
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-start gap-3 p-4 bg-[var(--th-success-bg)] border border-[var(--th-success-border)] rounded-xl">
                  <IconCheck className="w-4 h-4 text-[var(--th-success-dark)] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--th-success-dark)]">{newClient.name} registered</p>
                    <p className="text-xs text-[var(--th-success-dark)] mt-0.5">Save the client secret — it won't be shown again.</p>
                  </div>
                </div>
                {[
                  { label: 'Client ID', value: newClient.client_id, copied: copiedId, onCopy: () => copy(newClient.client_id, setCopiedId) },
                  { label: 'Client Secret', value: newClient.client_secret, copied: copiedSecret, onCopy: () => copy(newClient.client_secret, setCopiedSecret) },
                ].map(row => (
                  <div key={row.label} className="space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{row.label}</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2.5 bg-[var(--th-surface)] border border-[var(--th-card-border-subtle)] rounded-lg text-xs font-mono text-[var(--th-text)] break-all select-all">
                        {row.value}
                      </code>
                      <button onClick={row.onCopy} className="shrink-0 p-2.5 border border-[var(--th-card-border-subtle)] hover:bg-[var(--th-surface)] rounded-lg transition-colors" aria-label={`Copy ${row.label}`}>
                        {row.copied ? <IconCheck className="w-4 h-4 text-[var(--th-success-text)]" /> : <IconCopy className="w-4 h-4 text-[var(--th-text-muted)]" />}
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={() => { setModal(false); setNewClient(null); }} className="w-full py-2.5 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-sm font-semibold rounded-xl transition-all mt-2">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('settings.appName')}</label>
                  <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('settings.appNamePlaceholder')}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] bg-[var(--th-card)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('settings.redirectUris')}</label>
                  <textarea
                    rows={3}
                    value={uris}
                    onChange={e => setUris(e.target.value)}
                    placeholder={'https://chat.openai.com/aip/oauth/callback\nhttps://...'}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] bg-[var(--th-card)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all font-mono"
                  />
                  <p className="text-xs text-[var(--th-text-muted)]">One URL per line. For ChatGPT: <code className="font-mono">https://chat.openai.com/aip/oauth/callback</code></p>
                </div>
                {createError && <p className="text-sm text-[var(--th-error-text)]">{createError}</p>}
                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={() => setModal(false)} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg">{t('common.cancel')}</button>
                  <button type="submit" disabled={creating || !name.trim()} className="px-4 py-2.5 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-sm font-semibold rounded-xl disabled:opacity-60">
                    {creating ? t('settings.creating') : t('settings.createOAuth')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
