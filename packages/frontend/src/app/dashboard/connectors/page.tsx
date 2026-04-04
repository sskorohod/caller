'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Connector {
  id: string;
  name: string;
  connector_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

interface ConnectorForm {
  name: string;
  connector_type: string;
  base_url: string;
  auth_type: 'bearer' | 'basic' | 'header';
  auth_value: string;
  auth_header: string;
}

const EMPTY_FORM: ConnectorForm = {
  name: '',
  connector_type: 'http',
  base_url: '',
  auth_type: 'bearer',
  auth_value: '',
  auth_header: '',
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  http: { label: 'HTTP', color: 'bg-[var(--th-primary)]/10 text-[var(--th-primary-text)]' },
  salesforce: { label: 'Salesforce', color: 'bg-[#00a1e0]/10 text-[#00a1e0]' },
  hubspot: { label: 'HubSpot', color: 'bg-[#ff7a59]/10 text-[#ff7a59]' },
  bitrix: { label: 'Bitrix24', color: 'bg-[#2fc6f6]/10 text-[#2fc6f6]' },
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ConnectorsPage() {
  const t = useT();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ConnectorForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Connector | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  function loadConnectors() {
    setLoadError('');
    api.get<Connector[]>('/connectors')
      .then(r => setConnectors(Array.isArray(r) ? r : []))
      .catch((err: unknown) => setLoadError((err as Error)?.message ?? 'Failed to load connectors'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadConnectors(); }, []);

  function buildConfig(): Record<string, unknown> {
    return {
      base_url: form.base_url,
      auth_type: form.auth_type,
      auth_value: form.auth_value,
      ...(form.auth_type === 'header' && form.auth_header ? { auth_header: form.auth_header } : {}),
      actions: {},
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        connector_type: form.connector_type,
        config: buildConfig(),
      };
      if (editId) {
        await api.patch(`/connectors/${editId}`, payload);
      } else {
        await api.post('/connectors', payload);
      }
      closeModal();
      loadConnectors();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(connector: Connector) {
    setEditId(connector.id);
    const cfg = connector.config as Record<string, unknown>;
    setForm({
      name: connector.name,
      connector_type: connector.connector_type,
      base_url: (cfg.base_url as string) ?? '',
      auth_type: (cfg.auth_type as ConnectorForm['auth_type']) ?? 'bearer',
      auth_value: (cfg.auth_value as string) ?? '',
      auth_header: (cfg.auth_header as string) ?? '',
    });
    setError('');
    setModal(true);
  }

  function closeModal() {
    setModal(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/connectors/${deleteTarget.id}`);
      setDeleteTarget(null);
      setDeleteError('');
      loadConnectors();
    } catch (err: unknown) {
      setDeleteError((err as Error).message);
    }
  }

  async function handleTest(id: string) {
    setTesting(id);
    setTestResult(null);
    try {
      const result = await api.post<{ success: boolean; status?: number; error?: string }>(`/connectors/${id}/test`, {});
      setTestResult({
        id,
        success: result.success,
        message: result.success ? `Connected (${result.status})` : (result.error ?? `Failed (${result.status})`),
      });
      if (result.success) loadConnectors();
    } catch (err: unknown) {
      setTestResult({ id, success: false, message: (err as Error).message });
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--th-text)]">{t('connectors.title')}</h2>
          <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{t('connectors.subtitle')}</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-sm font-semibold rounded-2xl transition-all active:scale-[.98] shadow-lg shadow-[var(--th-shadow-primary)] flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('connectors.newConnector')}
        </button>
      </div>

      {loadError ? (
        <div className="bg-[var(--th-error-bg)] border border-[var(--th-card-border-subtle)] rounded-2xl p-6 text-center">
          <p className="text-sm font-medium text-[var(--th-error-text)]">{loadError}</p>
          <button onClick={loadConnectors} className="mt-3 px-4 py-2 text-sm font-medium text-[var(--th-error-text)] hover:bg-[var(--th-error-bg)] rounded-lg transition-colors">{t('common.retry')}</button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 animate-pulse space-y-3">
              <div className="w-10 h-10 bg-[var(--th-skeleton)] rounded-lg" />
              <div className="h-4 bg-[var(--th-skeleton)] rounded-lg w-2/3" />
              <div className="h-3 bg-[var(--th-skeleton)] rounded-lg w-1/2" />
            </div>
          ))}
        </div>
      ) : connectors.length === 0 ? (
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 bg-[var(--th-primary-bg)] rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--th-text-secondary)]">{t('connectors.noConnectors')}</p>
          <p className="text-xs text-[var(--th-text-muted)] mt-1 mb-4">{t('connectors.noConnectorsDesc')}</p>
          <button onClick={() => setModal(true)} className="px-4 py-2 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-sm font-medium rounded-lg transition-all">
            {t('connectors.createConnector')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {connectors.map(connector => {
            const typeMeta = TYPE_LABELS[connector.connector_type] ?? { label: connector.connector_type, color: 'bg-[var(--th-skeleton)] text-[var(--th-text-muted)]' };
            return (
              <div key={connector.id} className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] hover:shadow-[0_2px_8px_var(--th-shadow),0_12px_32px_var(--th-card-glow)] transition-shadow group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-[var(--th-primary-bg)] rounded-2xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${typeMeta.color}`}>
                      {typeMeta.label}
                    </span>
                    {connector.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--th-success-bg)] text-[var(--th-success-text)] text-[10px] font-semibold uppercase tracking-wider">
                        <span className="w-1 h-1 rounded-full bg-[var(--th-success-icon)]" />
                        {t('connectors.active')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--th-skeleton)] text-[var(--th-text-muted)] text-[10px] font-semibold uppercase tracking-wider">
                        {t('connectors.inactive')}
                      </span>
                    )}
                  </div>
                </div>
                <h3 className="font-semibold text-[var(--th-text)] text-sm">{connector.name}</h3>
                <p className="text-xs text-[var(--th-text-muted)] mt-1 truncate">
                  {(connector.config as Record<string, unknown>).base_url as string ?? 'No URL configured'}
                </p>
                {connector.last_synced_at && (
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)] mt-1.5">
                    Last synced {new Date(connector.last_synced_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}

                {/* Test result */}
                {testResult && testResult.id === connector.id && (
                  <div className={`mt-2 px-2.5 py-1.5 rounded-lg text-xs font-medium ${testResult.success ? 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]' : 'bg-[var(--th-error-bg)] text-[var(--th-error-text)]'}`}>
                    {testResult.message}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={() => handleTest(connector.id)}
                    disabled={testing === connector.id}
                    className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-primary-text)] hover:text-[var(--th-primary-hover)] disabled:opacity-50 transition-colors"
                  >
                    {testing === connector.id ? t('connectors.testing') : t('connectors.testConnection')}
                  </button>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(connector)}
                      className="p-1.5 rounded-lg hover:bg-[var(--th-surface)] text-[var(--th-text-muted)] hover:text-[var(--th-primary-text)] transition-colors"
                      aria-label="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setDeleteTarget(connector); setDeleteError(''); }}
                      className="p-1.5 rounded-lg hover:bg-[var(--th-error-bg)] text-[var(--th-text-muted)] hover:text-red-500 transition-colors"
                      aria-label="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)} role="dialog" aria-modal="true">
          <div className="bg-[var(--th-modal)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 space-y-4">
              <div className="w-11 h-11 bg-[var(--th-error-bg)] rounded-2xl flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--th-text)]">{t('connectors.deleteConnector')}</h3>
                <p className="text-sm text-[var(--th-text-muted)] mt-1">{t('connectors.deleteConfirm', { name: deleteTarget.name })}</p>
              </div>
              {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg transition-colors">{t('common.cancel')}</button>
                <button onClick={handleDeleteConfirm} className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)] text-white text-sm font-semibold rounded-lg transition-all">{t('common.delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal} onKeyDown={e => e.key === 'Escape' && closeModal()} role="dialog" aria-modal="true">
          <div className="bg-[var(--th-modal)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--th-card-border-subtle)]">
              <h2 className="text-base font-semibold text-[var(--th-text)]">{editId ? t('connectors.editConnector') : t('connectors.newConnector')}</h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-[var(--th-surface)] rounded-lg" aria-label="Close">
                <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('connectors.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="HubSpot CRM"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('connectors.type')}</label>
                <select
                  value={form.connector_type}
                  onChange={e => setForm(p => ({ ...p, connector_type: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors"
                >
                  <option value="http">HTTP (Generic API)</option>
                  <option value="salesforce" disabled>Salesforce (coming soon)</option>
                  <option value="hubspot" disabled>HubSpot (coming soon)</option>
                  <option value="bitrix" disabled>Bitrix24 (coming soon)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('connectors.baseUrl')}</label>
                <input
                  type="url"
                  value={form.base_url}
                  onChange={e => setForm(p => ({ ...p, base_url: e.target.value }))}
                  placeholder="https://api.hubspot.com/crm/v3"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('connectors.authType')}</label>
                <select
                  value={form.auth_type}
                  onChange={e => setForm(p => ({ ...p, auth_type: e.target.value as ConnectorForm['auth_type'] }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors"
                >
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth (user:pass)</option>
                  <option value="header">Custom Header</option>
                </select>
              </div>
              {form.auth_type === 'header' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('connectors.headerName')}</label>
                  <input
                    type="text"
                    value={form.auth_header}
                    onChange={e => setForm(p => ({ ...p, auth_header: e.target.value }))}
                    placeholder="X-Api-Key"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('connectors.authValue')}</label>
                <input
                  type="password"
                  value={form.auth_value}
                  onChange={e => setForm(p => ({ ...p, auth_value: e.target.value }))}
                  placeholder={form.auth_type === 'basic' ? 'user:password' : 'Token or API key'}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors"
                />
              </div>

              {error && (
                <div className="px-3 py-2 rounded-lg bg-[var(--th-error-bg)] text-[var(--th-error-text)] text-sm">{error}</div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg transition-colors">{t('common.cancel')}</button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all"
                >
                  {saving ? t('connectors.saving') : editId ? t('connectors.saveChanges') : t('connectors.createConnector')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
