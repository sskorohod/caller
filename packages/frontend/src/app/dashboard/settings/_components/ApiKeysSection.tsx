'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useIsMobile } from '@/lib/useBreakpoint';
import type { ApiKey } from '../_lib/types';
import { fmtDate } from '../_lib/constants';
import { IconKey, IconCheck, IconCopy } from '../_lib/icons';

export function ApiKeysSection() {
  const t = useT();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

  const isMobile = useIsMobile();

  const load = useCallback(() => {
    api.get<ApiKey[]>('/auth/api-keys').then(setKeys).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!keyName.trim()) return;
    setCreating(true); setError('');
    try {
      const res = await api.post<{ id: string; name: string; key_prefix: string; key: string; created_at: string }>(
        '/auth/api-keys', { name: keyName.trim() }
      );
      setNewKey({ key: res.key, name: res.name });
      setKeyName('');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function revokeKeyConfirm() {
    if (!revokeTarget) return;
    try {
      await api.delete(`/auth/api-keys/${revokeTarget.id}`);
      setRevokeTarget(null);
      load();
    } catch (e: any) {
      setError(e.message);
      setRevokeTarget(null);
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeKeys = keys.filter(k => !k.revoked_at);
  const revokedKeys = keys.filter(k => k.revoked_at);

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-[0_2px_8px_rgba(245,158,11,0.3)]">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--th-text)]">MCP API Keys</h2>
            <p className="text-xs text-[var(--th-text-muted)]">{t('settings.apiKeysHint')}</p>
          </div>
        </div>
        <button
          onClick={() => { setModal(true); setNewKey(null); }}
          className="shrink-0 px-3.5 py-2 min-h-[44px] btn-primary flex items-center gap-1.5 shadow-sm shadow-[var(--th-shadow-primary)]"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('settings.createApiKey')}
        </button>
      </div>

      <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-12 bg-[var(--th-skeleton)] rounded-lg" />)}
          </div>
        ) : activeKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <div className="w-11 h-11 bg-[var(--th-surface)] rounded-xl flex items-center justify-center mb-3">
              <IconKey className="w-5 h-5 text-[var(--th-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--th-text-secondary)]">{t('settings.noApiKeys')}</p>
          </div>
        ) : isMobile ? (
            /* Mobile: card-based view */
            <div className="divide-y divide-[var(--th-card-border-subtle)]">
              {activeKeys.map(k => (
                <div key={k.id} className="px-4 py-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--th-text)]">{k.name}</span>
                    <code className="text-xs bg-[var(--th-surface)] text-[var(--th-text-secondary)] px-2 py-0.5 rounded-md font-mono">{k.key_prefix}...</code>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--th-text-muted)]">
                    <span>{t('settings.lastUsed') || 'Last Used'}: {k.last_used_at ? fmtDate(k.last_used_at) : t('settings.never')}</span>
                    <span>{fmtDate(k.created_at)}</span>
                  </div>
                  <div className="flex justify-end">
                    {revokeTarget?.id === k.id ? (
                      <div className="flex items-center gap-3">
                        <button onClick={revokeKeyConfirm} className="text-xs min-h-[44px] px-3 text-[var(--th-error-text)] font-medium">{t('settings.confirm')}</button>
                        <button onClick={() => setRevokeTarget(null)} className="text-xs min-h-[44px] px-3 text-[var(--th-text-muted)] font-medium">{t('common.cancel')}</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRevokeTarget({ id: k.id, name: k.name })}
                        className="text-xs min-h-[44px] px-3 text-[var(--th-text-muted)] hover:text-[var(--th-error-text)] font-medium"
                      >
                        {t('settings.revoke')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop: table view */
            <table className="w-full">
              <thead className="bg-[var(--th-table-header)] border-b border-[var(--th-card-border-subtle)]">
                <tr>
                  {[t('settings.keyName') || 'Name', 'Prefix', t('settings.lastUsed') || 'Last Used', t('settings.created') || 'Created', ''].map(h => (
                    <th key={h} className="px-3 md:px-5 py-3 text-left text-xs font-semibold text-[var(--th-text-muted)] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--th-card-border-subtle)]">
                {activeKeys.map(k => (
                  <tr key={k.id} className="hover:bg-[var(--th-table-row-hover)] transition-colors">
                    <td className="px-3 md:px-5 py-3.5 text-sm font-medium text-[var(--th-text)]">{k.name}</td>
                    <td className="px-3 md:px-5 py-3.5">
                      <code className="text-xs bg-[var(--th-surface)] text-[var(--th-text-secondary)] px-2 py-0.5 rounded-md font-mono">{k.key_prefix}…</code>
                    </td>
                    <td className="px-3 md:px-5 py-3.5 text-sm text-[var(--th-text-muted)]">
                      {k.last_used_at ? fmtDate(k.last_used_at) : t('settings.never')}
                    </td>
                    <td className="px-3 md:px-5 py-3.5 text-sm text-[var(--th-text-muted)]">{fmtDate(k.created_at)}</td>
                    <td className="px-3 md:px-5 py-3.5">
                      {revokeTarget?.id === k.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={revokeKeyConfirm} className="text-xs text-[var(--th-error-text)] font-medium transition-colors">{t('settings.confirm')}</button>
                          <button onClick={() => setRevokeTarget(null)} className="text-xs text-[var(--th-text-muted)] hover:text-[var(--th-text-secondary)] font-medium transition-colors">{t('common.cancel')}</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRevokeTarget({ id: k.id, name: k.name })}
                          className="text-xs text-[var(--th-text-muted)] hover:text-[var(--th-error-text)] transition-colors font-medium"
                        >
                          {t('settings.revoke')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }

        {revokedKeys.length > 0 && (
          <div className="border-t border-[var(--th-card-border-subtle)] px-3 md:px-5 py-3">
            <p className="text-xs text-[var(--th-text-muted)]">{revokedKeys.length} revoked key{revokedKeys.length > 1 ? 's' : ''} hidden</p>
          </div>
        )}
      </div>

      {/* Usage tip */}
      <div className="bg-[var(--th-card-hover)] border border-[var(--th-primary-bg-hover)] rounded-xl p-4">
        <p className="text-xs font-semibold text-[var(--th-primary-text)] mb-2">Using with Claude Desktop</p>
        <pre className="text-xs text-[var(--th-text-secondary)] bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{`{
  "mcpServers": {
    "caller": {
      "command": "npx",
      "args": ["@caller/mcp-server"],
      "env": {
        "CALLER_API_URL": "${typeof window !== 'undefined' ? window.location.origin : 'https://caller.yourdomain.com'}",
        "CALLER_API_KEY": "mcp_xxxx..."
      }
    }
  }
}`}</pre>
      </div>

      {/* Create modal */}
      {modal && (
        <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setModal(false); setNewKey(null); }}>
          <div className="bg-[var(--th-modal)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--th-card-border-subtle)]">
              <h2 className="text-base font-semibold text-[var(--th-text)]">{t('settings.createApiKey')}</h2>
              <button onClick={() => { setModal(false); setNewKey(null); }} className="p-1.5 hover:bg-[var(--th-surface)] rounded-lg" aria-label="Close">
                <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {newKey ? (
              <div className="px-6 py-6 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-[var(--th-success-bg)] border border-[var(--th-success-border)] rounded-xl">
                  <div className="w-8 h-8 bg-[var(--th-success-bg-strong)] rounded-lg flex items-center justify-center shrink-0">
                    <IconCheck className="w-4 h-4 text-[var(--th-success-dark)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--th-success-dark)]">Key created: {newKey.name}</p>
                    <p className="text-xs text-[var(--th-success-dark)] mt-0.5">{t('settings.copyWarning')}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">Your API Key</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2.5 bg-[var(--th-surface)] border border-[var(--th-card-border-subtle)] rounded-lg text-xs font-mono text-[var(--th-text)] break-all select-all">
                      {newKey.key}
                    </code>
                    <button
                      onClick={() => copyKey(newKey.key)}
                      className="shrink-0 w-11 h-11 flex items-center justify-center border border-[var(--th-card-border-subtle)] hover:bg-[var(--th-surface)] rounded-lg transition-colors"
                      aria-label="Copy API key"
                    >
                      {copied ? <IconCheck className="w-4 h-4 text-[var(--th-success-text)]" /> : <IconCopy className="w-4 h-4 text-[var(--th-text-muted)]" />}
                    </button>
                  </div>
                </div>
                <button onClick={() => { setModal(false); setNewKey(null); }} className="w-full py-2.5 btn-primary">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('settings.keyName')}</label>
                  <input
                    autoFocus
                    type="text"
                    value={keyName}
                    onChange={e => setKeyName(e.target.value)}
                    placeholder={t('settings.keyNamePlaceholder')}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] bg-[var(--th-card)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
                  />
                </div>
                {error && <p className="text-sm text-[var(--th-error-text)]">{error}</p>}
                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={() => setModal(false)} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg transition-colors">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={creating || !keyName.trim()} className="px-4 py-2.5 btn-primary">
                    {creating ? t('settings.generating') : t('settings.generate')}
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
