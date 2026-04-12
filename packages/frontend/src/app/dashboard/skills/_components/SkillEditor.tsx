'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import type { SkillPack, SkillPackForm, SkillSection, RequiredDataItem, ToolStep, EscalationCondition } from '../_lib/types';
import { SECTIONS, SECTION_KEYS, SECTION_ICONS, EMPTY_FORM } from '../_lib/constants';
import ActivationRulesEditor from './ActivationRulesEditor';
import RequiredDataEditor from './RequiredDataEditor';
import ToolSequenceEditor from './ToolSequenceEditor';
import AllowedToolsEditor from './AllowedToolsEditor';
import EscalationEditor from './EscalationEditor';
import CompletionEditor from './CompletionEditor';
import InterruptionEditor from './InterruptionEditor';

// ─── Props ─────────────────────────────────────────────────────────────────

interface SkillEditorProps {
  skillId?: string; // undefined = create mode
  initialForm?: SkillPackForm;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function packToForm(pack: SkillPack): SkillPackForm {
  return {
    name: pack.name,
    description: pack.description ?? '',
    intent: pack.intent,
    conversation_rules: pack.conversation_rules ?? '',
    is_active: pack.is_active,
    activation_rules: pack.activation_rules ?? {},
    required_data: (pack.required_data ?? []) as RequiredDataItem[],
    tool_sequence: (pack.tool_sequence ?? []) as ToolStep[],
    allowed_tools: pack.allowed_tools ?? [],
    escalation_conditions: (pack.escalation_conditions ?? []) as EscalationCondition[],
    completion_criteria: pack.completion_criteria ?? {},
    interruption_rules: pack.interruption_rules ?? {},
  };
}

function formToPayload(form: SkillPackForm): Record<string, unknown> {
  return {
    name: form.name,
    description: form.description || null,
    intent: form.intent,
    conversation_rules: form.conversation_rules || null,
    is_active: form.is_active,
    activation_rules: form.activation_rules,
    required_data: form.required_data,
    tool_sequence: form.tool_sequence,
    allowed_tools: form.allowed_tools,
    escalation_conditions: form.escalation_conditions,
    completion_criteria: form.completion_criteria,
    interruption_rules: form.interruption_rules,
  };
}

// ─── Intent Suggestions ────────────────────────────────────────────────────

import { INTENT_SUGGESTIONS } from '../_lib/constants';

// ─── Component ─────────────────────────────────────────────────────────────

export default function SkillEditor({ skillId, initialForm }: SkillEditorProps) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();

  const isEdit = !!skillId;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<SkillSection>('general');
  const [form, setForm] = useState<SkillPackForm>(initialForm ?? EMPTY_FORM);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showIntentSuggestions, setShowIntentSuggestions] = useState(false);

  // JSON tab state
  const [jsonFields, setJsonFields] = useState<Record<string, string>>({});
  const [jsonError, setJsonError] = useState('');

  // Load existing skill
  useEffect(() => {
    if (!isEdit) return;
    api.get<SkillPack>(`/skill-packs/${skillId}`)
      .then(pack => {
        setForm(packToForm(pack));
        setLoading(false);
      })
      .catch((err: unknown) => {
        toast.error((err as Error).message || 'Failed to load skill');
        router.push('/dashboard/skills');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId]);

  // Sync JSON fields when switching to JSON tab
  useEffect(() => {
    if (section === 'json') {
      setJsonFields({
        activation_rules: JSON.stringify(form.activation_rules, null, 2),
        required_data: JSON.stringify(form.required_data, null, 2),
        tool_sequence: JSON.stringify(form.tool_sequence, null, 2),
        allowed_tools: JSON.stringify(form.allowed_tools, null, 2),
        escalation_conditions: JSON.stringify(form.escalation_conditions, null, 2),
        completion_criteria: JSON.stringify(form.completion_criteria, null, 2),
        interruption_rules: JSON.stringify(form.interruption_rules, null, 2),
      });
      setJsonError('');
    }
  }, [section, form]);

  // Helpers
  const set = <K extends keyof SkillPackForm>(key: K, value: SkillPackForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // Save
  async function handleSave() {
    if (!form.name.trim() || !form.intent.trim()) {
      toast.error('Name and Intent are required');
      setSection('general');
      return;
    }

    // If on JSON tab, apply JSON changes first
    if (section === 'json') {
      try {
        const updated = { ...form };
        for (const [key, val] of Object.entries(jsonFields)) {
          (updated as Record<string, unknown>)[key] = JSON.parse(val);
        }
        setForm(updated);
      } catch {
        setJsonError('Invalid JSON');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (isEdit) {
        await api.patch(`/skill-packs/${skillId}`, payload);
        toast.success(t('skills.saved'));
      } else {
        await api.post('/skill-packs', payload);
        toast.success(t('skills.created'));
      }
      router.push('/dashboard/skills');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // Delete
  async function handleDelete() {
    if (!skillId) return;
    setDeleting(true);
    try {
      await api.delete(`/skill-packs/${skillId}`);
      toast.success(t('skills.deleted'));
      router.push('/dashboard/skills');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to delete');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  // Intent suggestion filter
  const filteredIntents = form.intent
    ? INTENT_SUGGESTIONS.filter(s => s.includes(form.intent.toLowerCase()) && s !== form.intent.toLowerCase())
    : INTENT_SUGGESTIONS;

  // ─── Section Renderers ───────────────────────────────────────────────────

  function renderGeneral() {
    return (
      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('skills.name')} *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('skills.namePlaceholder')} required
            className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('skills.description')}</label>
          <input type="text" value={form.description} onChange={e => set('description', e.target.value)} placeholder={t('skills.descPlaceholder')}
            className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all" />
        </div>

        {/* Intent with suggestions */}
        <div className="relative">
          <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('skills.intent')} *</label>
          <input type="text" value={form.intent} placeholder={t('skills.intentPlaceholder')} required
            onChange={e => { set('intent', e.target.value); setShowIntentSuggestions(true); }}
            onFocus={() => setShowIntentSuggestions(true)}
            onBlur={() => setTimeout(() => setShowIntentSuggestions(false), 200)}
            className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all" />
          <p className="text-[10px] text-[var(--th-text-muted)] mt-1">{t('skills.intentHint')}</p>
          {showIntentSuggestions && filteredIntents.length > 0 && (
            <div className="absolute z-20 top-[calc(100%-1rem)] left-0 right-0 bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] rounded-xl shadow-[0_8px_24px_var(--th-shadow)] max-h-40 overflow-y-auto">
              {filteredIntents.slice(0, 6).map(intent => (
                <button key={intent} type="button" onMouseDown={() => { set('intent', intent); setShowIntentSuggestions(false); }}
                  className="w-full px-3.5 py-2 text-left text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] transition-colors font-mono">
                  {intent}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversation Rules */}
        <div>
          <label className="block text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider mb-1.5">{t('skills.conversationRules')}</label>
          <textarea value={form.conversation_rules} onChange={e => set('conversation_rules', e.target.value)} rows={8}
            placeholder={t('skills.conversationRulesPlaceholder')}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all" />
          <p className="text-[10px] text-[var(--th-text-muted)] mt-1">{t('skills.conversationRulesHint')}</p>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-[var(--th-text)]">{t('skills.active')}</label>
          <button type="button" onClick={() => set('is_active', !form.is_active)}
            className={`relative w-10 h-6 rounded-full transition-colors ${form.is_active ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'}`}>
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    );
  }

  function renderActivation() {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-[var(--th-text)] mb-1">{t('skills.activationRules')}</h3>
          <p className="text-xs text-[var(--th-text-muted)] mb-4">{t('skills.activationRulesDesc')}</p>
        </div>
        <ActivationRulesEditor rules={form.activation_rules} onChange={rules => set('activation_rules', rules)} />
      </div>
    );
  }

  function renderDataTools() {
    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-semibold text-[var(--th-text)] mb-1">{t('skills.requiredData')}</h3>
          <p className="text-xs text-[var(--th-text-muted)] mb-4">{t('skills.requiredDataDesc')}</p>
          <RequiredDataEditor items={form.required_data} onChange={items => set('required_data', items)} />
        </div>
        <div className="border-t border-[var(--th-card-border-subtle)] pt-6">
          <h3 className="text-sm font-semibold text-[var(--th-text)] mb-1">{t('skills.toolSequence')}</h3>
          <p className="text-xs text-[var(--th-text-muted)] mb-4">{t('skills.toolSequenceDesc')}</p>
          <ToolSequenceEditor steps={form.tool_sequence} onChange={steps => set('tool_sequence', steps)} />
        </div>
        <div className="border-t border-[var(--th-card-border-subtle)] pt-6">
          <h3 className="text-sm font-semibold text-[var(--th-text)] mb-1">{t('skills.allowedTools')}</h3>
          <p className="text-xs text-[var(--th-text-muted)] mb-4">{t('skills.allowedToolsDesc')}</p>
          <AllowedToolsEditor tools={form.allowed_tools} onChange={tools => set('allowed_tools', tools)} />
        </div>
      </div>
    );
  }

  function renderEscalation() {
    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-semibold text-[var(--th-text)] mb-1">{t('skills.escalationConditions')}</h3>
          <p className="text-xs text-[var(--th-text-muted)] mb-4">{t('skills.escalationConditionsDesc')}</p>
          <EscalationEditor conditions={form.escalation_conditions} onChange={c => set('escalation_conditions', c)} />
        </div>
        <div className="border-t border-[var(--th-card-border-subtle)] pt-6">
          <h3 className="text-sm font-semibold text-[var(--th-text)] mb-1">{t('skills.interruptionRules')}</h3>
          <p className="text-xs text-[var(--th-text-muted)] mb-4">{t('skills.interruptionRulesDesc')}</p>
          <InterruptionEditor rules={form.interruption_rules} onChange={r => set('interruption_rules', r)} />
        </div>
      </div>
    );
  }

  function renderCompletion() {
    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-semibold text-[var(--th-text)] mb-1">{t('skills.completionCriteria')}</h3>
          <p className="text-xs text-[var(--th-text-muted)] mb-4">{t('skills.completionCriteriaDesc')}</p>
          <CompletionEditor criteria={form.completion_criteria} onChange={c => set('completion_criteria', c)} />
        </div>
      </div>
    );
  }

  function renderJson() {
    const fields = ['activation_rules', 'required_data', 'tool_sequence', 'allowed_tools', 'escalation_conditions', 'completion_criteria', 'interruption_rules'] as const;

    function applyJson() {
      try {
        const updated = { ...form };
        for (const [key, val] of Object.entries(jsonFields)) {
          (updated as Record<string, unknown>)[key] = JSON.parse(val);
        }
        setForm(updated);
        setJsonError('');
        toast.success('JSON applied');
      } catch {
        setJsonError('Invalid JSON in one or more fields');
      }
    }

    return (
      <div className="space-y-5">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="material-symbols-outlined text-amber-400 text-lg mt-0.5">warning</span>
          <p className="text-xs text-amber-300">{t('skills.rawJsonWarning')}</p>
        </div>
        {jsonError && <p className="text-sm text-[var(--th-error-text)]">{jsonError}</p>}
        {fields.map(field => (
          <div key={field}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider font-mono">{field}</label>
              <button type="button" onClick={() => {
                try { setJsonFields(prev => ({ ...prev, [field]: JSON.stringify(JSON.parse(prev[field] || '{}'), null, 2) })); } catch { /* ignore */ }
              }} className="text-[10px] font-medium text-[var(--th-primary-text)] hover:underline">{t('skills.formatJson')}</button>
            </div>
            <textarea value={jsonFields[field] || ''} onChange={e => setJsonFields(prev => ({ ...prev, [field]: e.target.value }))} rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] text-xs text-[var(--th-text)] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all" />
          </div>
        ))}
        <button type="button" onClick={applyJson} className="px-4 py-2 text-sm btn-primary">Apply JSON</button>
      </div>
    );
  }

  const RENDER_MAP: Record<SkillSection, () => React.ReactNode> = {
    general: renderGeneral,
    activation: renderActivation,
    dataTools: renderDataTools,
    escalation: renderEscalation,
    completion: renderCompletion,
    json: renderJson,
  };

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-[var(--th-text-muted)]">{t('common.loading')}</div>
      </div>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 md:px-5 py-3 border-b border-[var(--th-card-border-subtle)] bg-[var(--th-card)] shadow-[0_1px_3px_var(--th-shadow)]">
        <button type="button" onClick={() => router.push('/dashboard/skills')}
          className="flex items-center gap-1.5 md:gap-2 text-sm text-[var(--th-text-secondary)] hover:text-[var(--th-text)] transition-all font-medium min-h-[44px]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          <span className="hidden md:inline">{t('skills.backToSkills')}</span>
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.push('/dashboard/skills')}
            className="hidden md:inline-flex px-4 py-2 text-sm rounded-xl border border-[var(--th-card-border-subtle)] text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] transition-all font-medium min-h-[44px] items-center">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm min-h-[44px] btn-primary disabled:opacity-40">
            {saving ? t('skills.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar — desktop */}
        <nav className="hidden md:flex flex-col w-48 border-r border-[var(--th-card-border-subtle)] bg-[var(--th-card)] py-3 flex-shrink-0">
          {SECTIONS.map(s => (
            <button key={s} type="button" onClick={() => setSection(s)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-all mx-2 rounded-xl ${
                section === s
                  ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white font-semibold shadow-[0_2px_8px_var(--th-shadow-primary)]'
                  : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)]'
              }`}>
              <span className="material-symbols-outlined text-lg">{SECTION_ICONS[s]}</span>
              <span>{t(SECTION_KEYS[s])}</span>
            </button>
          ))}
        </nav>

        {/* Mobile tabs */}
        <div className="md:hidden flex overflow-x-auto border-b border-[var(--th-card-border-subtle)] bg-[var(--th-card)] px-2 py-1.5 gap-1 flex-shrink-0 scrollbar-none">
          {SECTIONS.map(s => (
            <button key={s} type="button" onClick={() => setSection(s)}
              className={`flex items-center gap-1 px-3 py-2 min-h-[44px] text-xs rounded-lg whitespace-nowrap transition-all ${
                section === s
                  ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white font-semibold'
                  : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)]'
              }`}>
              <span className="material-symbols-outlined text-base">{SECTION_ICONS[s]}</span>
              <span>{t(SECTION_KEYS[s])}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-3 py-3 md:px-4 md:py-4 lg:p-6">
            {RENDER_MAP[section]()}

            {/* Delete zone */}
            {isEdit && (
              <div className="mt-12 pt-6 border-t border-[var(--th-card-border-subtle)]">
                <button type="button" onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 text-sm rounded-xl border border-[var(--th-card-border-subtle)] text-[var(--th-error-text)] hover:bg-[var(--th-error-bg)] transition-all font-medium">
                  {t('skills.deletePack')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--th-card)] rounded-t-2xl md:rounded-2xl p-4 md:p-6 w-full md:max-w-sm md:mx-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)]">
            <div className="w-11 h-11 bg-[var(--th-error-bg)] rounded-xl flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-[var(--th-error-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[var(--th-text)] mb-2">{t('skills.deletePack')}</h3>
            <p className="text-sm text-[var(--th-text-secondary)] mb-6">{t('skills.deleteConfirm', { name: form.name })}</p>
            <div className="flex flex-col-reverse md:flex-row md:justify-end gap-2">
              <button type="button" onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 min-h-[44px] text-sm rounded-xl border border-[var(--th-card-border-subtle)] text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] transition-all">
                {t('common.cancel')}
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="px-4 py-2.5 min-h-[44px] text-sm rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)] disabled:opacity-40 transition-all font-semibold">
                {deleting ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
