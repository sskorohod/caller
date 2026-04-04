'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface SkillPack {
  id: string;
  name: string;
  description: string | null;
  intent: string;
  activation_rules: Record<string, unknown>;
  required_data: unknown[];
  tool_sequence: unknown[];
  allowed_tools: string[];
  escalation_conditions: unknown[];
  completion_criteria: Record<string, unknown>;
  conversation_rules: string | null;
  is_active: boolean;
  created_at: string;
}

interface SkillPackForm {
  name: string;
  description: string;
  intent: string;
  conversation_rules: string;
  advanced_json: string;
}

const EMPTY_FORM: SkillPackForm = { name: '', description: '', intent: '', conversation_rules: '', advanced_json: '' };

export default function SkillsPage() {
  const t = useT();
  const [packs, setPacks] = useState<SkillPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SkillPackForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SkillPack | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  function loadPacks() {
    setLoadError('');
    api.get<{ skill_packs: SkillPack[] }>('/skill-packs')
      .then(r => setPacks(r.skill_packs ?? []))
      .catch((err: unknown) => setLoadError((err as Error)?.message ?? 'Failed to load skill packs'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPacks(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        intent: form.intent,
      };
      if (form.description) payload.description = form.description;
      if (form.conversation_rules) payload.conversation_rules = form.conversation_rules;

      if (form.advanced_json.trim()) {
        try {
          const adv = JSON.parse(form.advanced_json);
          Object.assign(payload, adv);
        } catch {
          setError('Invalid JSON in advanced fields');
          setSaving(false);
          return;
        }
      }

      if (editId) {
        await api.patch(`/skill-packs/${editId}`, payload);
      } else {
        await api.post('/skill-packs', payload);
      }
      closeModal();
      loadPacks();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(pack: SkillPack) {
    setEditId(pack.id);
    const { activation_rules, required_data, tool_sequence, allowed_tools, escalation_conditions, completion_criteria } = pack;
    const hasAdvanced = Object.keys(activation_rules ?? {}).length > 0 ||
      (required_data ?? []).length > 0 ||
      (tool_sequence ?? []).length > 0 ||
      (allowed_tools ?? []).length > 0 ||
      (escalation_conditions ?? []).length > 0 ||
      Object.keys(completion_criteria ?? {}).length > 0;

    setForm({
      name: pack.name,
      description: pack.description ?? '',
      intent: pack.intent,
      conversation_rules: pack.conversation_rules ?? '',
      advanced_json: hasAdvanced ? JSON.stringify({ activation_rules, required_data, tool_sequence, allowed_tools, escalation_conditions, completion_criteria }, null, 2) : '',
    });
    setShowAdvanced(hasAdvanced);
    setError('');
    setModal(true);
  }

  function closeModal() {
    setModal(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowAdvanced(false);
    setError('');
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/skill-packs/${deleteTarget.id}`);
      setDeleteTarget(null);
      setDeleteError('');
      loadPacks();
    } catch (err: unknown) {
      setDeleteError((err as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--th-text)]">{t('skills.title')}</h2>
          <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{t('skills.subtitle')}</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-sm font-semibold rounded-2xl transition-all active:scale-[.98] shadow-lg shadow-[var(--th-shadow-primary)] flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('skills.newPack')}
        </button>
      </div>

      {loadError ? (
        <div className="bg-[var(--th-error-bg)] border border-[var(--th-card-border-subtle)] rounded-2xl p-6 text-center shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <p className="text-sm font-medium text-[var(--th-error-text)]">{loadError}</p>
          <button onClick={loadPacks} className="mt-3 px-4 py-2 text-sm font-medium text-[var(--th-error-text)] hover:bg-[var(--th-error-bg)] rounded-lg transition-colors">{t('common.retry')}</button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 animate-pulse space-y-3 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
              <div className="w-10 h-10 bg-[var(--th-skeleton)] rounded-lg" />
              <div className="h-4 bg-[var(--th-skeleton)] rounded-lg w-2/3" />
              <div className="h-3 bg-[var(--th-skeleton)] rounded-lg w-1/2" />
            </div>
          ))}
        </div>
      ) : packs.length === 0 ? (
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] flex flex-col items-center justify-center py-20 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <div className="w-12 h-12 bg-[var(--th-surface)] rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--th-text-secondary)]">{t('skills.noPacks')}</p>
          <p className="text-xs text-[var(--th-text-muted)] mt-1 mb-4">{t('skills.noPacksDesc')}</p>
          <button onClick={() => setModal(true)} className="px-4 py-2 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-sm font-medium rounded-lg transition-all">
            {t('skills.createPack')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {packs.map(pack => (
            <div key={pack.id} className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 hover:border-[var(--th-border)] hover:shadow-[0_4px_16px_var(--th-card-glow)] transition-shadow group shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-[var(--th-primary-bg)] rounded-2xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await api.patch(`/skill-packs/${pack.id}`, { is_active: !pack.is_active });
                      loadPacks();
                    } catch { /* ignore */ }
                  }}
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                    pack.is_active ? 'bg-[var(--th-success-icon)]' : 'bg-[var(--th-border)]'
                  }`}
                  title={pack.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    pack.is_active ? 'translate-x-[18px]' : 'translate-x-[2px]'
                  }`} />
                </button>
              </div>
              <h3 className="font-semibold text-[var(--th-text)] text-sm">{pack.name}</h3>
              {pack.description && (
                <p className="text-xs text-[var(--th-text-muted)] mt-1 line-clamp-2">{pack.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--th-primary-bg)] text-[var(--th-primary-text)] font-semibold uppercase tracking-wider">{pack.intent}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">
                  Created {new Date(pack.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(pack)}
                    className="p-1.5 rounded-lg hover:bg-[var(--th-surface)] text-[var(--th-text-muted)] hover:text-[var(--th-primary-text)] transition-colors"
                    aria-label="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => { setDeleteTarget(pack); setDeleteError(''); }}
                    className="p-1.5 rounded-lg hover:bg-[var(--th-error-bg)] text-[var(--th-text-muted)] hover:text-[var(--th-error-text)] transition-colors"
                    aria-label="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)} role="dialog" aria-modal="true">
          <div className="bg-[var(--th-modal)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 space-y-4">
              <div className="w-12 h-12 bg-[var(--th-surface)] rounded-2xl flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--th-error-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--th-text)]">{t('skills.deletePack')}</h3>
                <p className="text-sm text-[var(--th-text-muted)] mt-1">{t('skills.deleteConfirm', { name: deleteTarget.name })}</p>
              </div>
              {deleteError && <p className="text-sm text-[var(--th-error-text)]">{deleteError}</p>}
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
              <h2 className="text-base font-semibold text-[var(--th-text)]">{editId ? t('skills.editPack') : t('skills.newPack')}</h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-[var(--th-surface)] rounded-lg" aria-label="Close">
                <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('skills.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Appointment Scheduling"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('skills.description')}</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('skills.intent')}</label>
                <input
                  type="text"
                  value={form.intent}
                  onChange={e => setForm(p => ({ ...p, intent: e.target.value }))}
                  placeholder="schedule_appointment"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">{t('skills.conversationRules')}</label>
                <textarea
                  rows={4}
                  value={form.conversation_rules}
                  onChange={e => setForm(p => ({ ...p, conversation_rules: e.target.value }))}
                  placeholder="Define conversation rules and flow..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs font-medium text-[var(--th-primary-text)] hover:text-[var(--th-primary-hover)] transition-colors flex items-center gap-1"
                >
                  <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  {t('skills.advancedJSON')}
                </button>
                {showAdvanced && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-muted)]">activation_rules, required_data, tool_sequence, allowed_tools, escalation_conditions, completion_criteria</p>
                    <textarea
                      rows={6}
                      value={form.advanced_json}
                      onChange={e => setForm(p => ({ ...p, advanced_json: e.target.value }))}
                      placeholder='{"activation_rules": {}, "tool_sequence": []}'
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all font-mono"
                    />
                  </div>
                )}
              </div>
              {error && <p className="text-sm text-[var(--th-error-text)]">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg transition-colors">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} className="px-4 py-2.5 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-60">
                  {saving ? t('skills.saving') : editId ? t('skills.saveChanges') : t('skills.createPack')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
