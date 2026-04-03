'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';

interface Agent {
  id: string;
  name: string;
  voice_provider: string | null;
  llm_provider: string | null;
  language: string;
  is_active: boolean;
  created_at: string;
}

interface AgentDetail extends Agent {
  prompt_packs?: { id: string; name: string; priority: number }[];
  skill_packs?: { id: string; name: string; priority: number }[];
}

interface PackItem {
  id: string;
  name: string;
  description?: string | null;
}

interface AgentForm {
  name: string;
  language: string;
  voice_provider: string;
  voice_id: string;
  llm_provider: string;
  llm_model: string;
  system_prompt: string;
  first_message: string;
}

const VOICE_OPTIONS: Record<string, { value: string; label: string; desc: string; emoji: string }[]> = {
  elevenlabs: [
    { value: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah', desc: 'Default female voice', emoji: '🎙️' },
  ],
  openai: [
    { value: 'alloy', label: 'Alloy', desc: 'Neutral, balanced', emoji: '⚡' },
    { value: 'echo', label: 'Echo', desc: 'Warm male voice', emoji: '🔊' },
    { value: 'fable', label: 'Fable', desc: 'Expressive, storytelling', emoji: '📖' },
    { value: 'onyx', label: 'Onyx', desc: 'Deep, authoritative', emoji: '🪨' },
    { value: 'nova', label: 'Nova', desc: 'Friendly female', emoji: '✨' },
    { value: 'shimmer', label: 'Shimmer', desc: 'Soft, gentle female', emoji: '🌟' },
  ],
  xai: [
    { value: 'ara', label: 'Ara', desc: 'Warm, friendly female', emoji: '🌸' },
    { value: 'rex', label: 'Rex', desc: 'Professional male', emoji: '👔' },
    { value: 'sal', label: 'Sal', desc: 'Neutral, balanced', emoji: '⚖️' },
    { value: 'eve', label: 'Eve', desc: 'Energetic female', emoji: '⚡' },
    { value: 'leo', label: 'Leo', desc: 'Authoritative male', emoji: '🦁' },
  ],
};

const DEFAULT_VOICE: Record<string, string> = {
  elevenlabs: 'EXAVITQu4vr4xnSDxMaL',
  openai: 'alloy',
  xai: 'ara',
};

const LLM_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5 (recommended)' },
    { value: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
    { value: 'claude-haiku-3-5-20241022', label: 'Claude Haiku 3.5 (fast)' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (recommended)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini (fast & cheap)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (cheapest)' },
  ],
  xai: [
    { value: 'grok-3', label: 'Grok 3' },
    { value: 'grok-3-mini', label: 'Grok 3 Mini (fast)' },
  ],
};

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-5-20250514',
  openai: 'gpt-4o',
  xai: 'grok-3',
};

const EMPTY_FORM: AgentForm = {
  name: '', language: 'en', voice_provider: 'elevenlabs', voice_id: 'EXAVITQu4vr4xnSDxMaL',
  llm_provider: 'anthropic', llm_model: 'claude-sonnet-4-5-20250514',
  system_prompt: '', first_message: '',
};

export default function AgentsPage() {
  const t = useT();
  const toast = useToast();
  const [agents, setAgents]   = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [editId, setEditId]   = useState<string | null>(null);
  const [form, setForm]       = useState<AgentForm>(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [loadError, setLoadError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Pack linking state
  const [allPromptPacks, setAllPromptPacks] = useState<PackItem[]>([]);
  const [allSkillPacks, setAllSkillPacks] = useState<PackItem[]>([]);
  const [selectedPromptPackIds, setSelectedPromptPackIds] = useState<Set<string>>(new Set());
  const [selectedSkillPackIds, setSelectedSkillPackIds] = useState<Set<string>>(new Set());
  const [packsLoading, setPacksLoading] = useState(false);

  function loadAgents() {
    setLoadError('');
    api.get<{ agents: Agent[] }>('/agents')
      .then(r => setAgents(r?.agents ?? []))
      .catch((err: any) => setLoadError(err?.message ?? 'Failed to load agents'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadAgents(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        display_name: form.name,
        language: form.language,
        voice_provider: form.voice_provider,
        voice_id: form.voice_id,
        llm_provider: form.llm_provider,
        llm_model: form.llm_model,
        system_prompt: form.system_prompt,
        greeting_message: form.first_message,
      };
      let agentId = editId;
      if (editId) {
        await api.patch(`/agents/${editId}`, payload);
      } else {
        const created = await api.post<{ id: string }>('/agents', payload);
        agentId = created.id;
      }
      // Sync attached packs
      if (agentId) {
        const ppPromises = Array.from(selectedPromptPackIds).map((ppId, i) =>
          api.post(`/agents/${agentId}/prompt-packs`, { prompt_pack_id: ppId, priority: i })
        );
        const spPromises = Array.from(selectedSkillPackIds).map((spId, i) =>
          api.post(`/agents/${agentId}/skill-packs`, { skill_pack_id: spId, priority: i })
        );
        await Promise.all([...ppPromises, ...spPromises]).catch(() => {});
      }
      toast.success(editId ? t('toast.agentUpdated') : t('toast.agentCreated'));
      closeModal();
      loadAgents();
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(agent: Agent) {
    await api.patch(`/agents/${agent.id}`, { is_active: !agent.is_active });
    loadAgents();
  }

  function openEdit(agent: Agent) {
    const a = agent as any;
    setEditId(agent.id);
    setForm({
      name: agent.name,
      language: agent.language ?? 'en',
      voice_provider: agent.voice_provider ?? 'elevenlabs',
      voice_id: a.voice_id ?? DEFAULT_VOICE[agent.voice_provider ?? 'elevenlabs'] ?? '',
      llm_provider: a.llm_provider ?? 'anthropic',
      llm_model: a.llm_model ?? DEFAULT_MODELS[a.llm_provider ?? 'anthropic'] ?? '',
      system_prompt: a.system_prompt ?? '',
      first_message: a.greeting_message ?? '',
    });
    setError('');
    setModal(true);

    // Load packs for linking
    setPacksLoading(true);
    Promise.all([
      api.get<PackItem[]>('/prompt-packs').catch(() => []),
      api.get<PackItem[]>('/skill-packs').catch(() => []),
      api.get<AgentDetail>(`/agents/${agent.id}`).catch(() => null),
    ]).then(([pp, sp, detail]) => {
      setAllPromptPacks(Array.isArray(pp) ? pp : []);
      setAllSkillPacks(Array.isArray(sp) ? sp : []);
      if (detail) {
        setSelectedPromptPackIds(new Set((detail.prompt_packs ?? []).map(p => p.id)));
        setSelectedSkillPackIds(new Set((detail.skill_packs ?? []).map(p => p.id)));
      } else {
        setSelectedPromptPackIds(new Set());
        setSelectedSkillPackIds(new Set());
      }
    }).finally(() => setPacksLoading(false));
  }

  function closeModal() {
    setModal(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setError('');
    setSelectedPromptPackIds(new Set());
    setSelectedSkillPackIds(new Set());
    setAllPromptPacks([]);
    setAllSkillPacks([]);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/agents/${deleteTarget.id}`);
      toast.success(t('toast.agentDeleted'));
      setDeleteTarget(null);
      setDeleteError('');
      loadAgents();
    } catch (err: any) {
      setDeleteError(err.message);
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--th-text)]">{t('agents.title')}</h2>
          <p className="text-sm text-[var(--th-text-muted)] mt-0.5">{t('agents.subtitle')}</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="px-4 py-2.5 bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-white text-sm font-semibold rounded-xl transition-all active:scale-[.98] shadow-lg shadow-[var(--th-shadow-primary)] flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('agents.newAgent')}
        </button>
      </div>

      {loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-red-700">{loadError}</p>
          <button onClick={loadAgents} className="mt-3 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 rounded-lg transition-colors">{t('common.retry')}</button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] p-5 animate-pulse space-y-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl" />
              <div className="h-4 bg-slate-100 rounded w-2/3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 bg-[var(--th-primary-bg)] rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--th-text-secondary)]">{t('agents.noAgents')}</p>
          <p className="text-xs text-[var(--th-text-muted)] mt-1 mb-4">{t('agents.noAgentsDesc')}</p>
          <button onClick={() => setModal(true)} className="px-4 py-2 bg-[var(--th-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--th-primary-hover)] transition-colors">
            {t('agents.createAgent')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {agents.map(agent => (
            <div key={agent.id} className="bg-[var(--th-card)] rounded-xl border border-[var(--th-border)] p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-[var(--th-primary-bg)] rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(agent)}
                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${agent.is_active ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'}`}
                    aria-label={agent.is_active ? 'Disable agent' : 'Enable agent'}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${agent.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-[var(--th-text)] text-sm">{agent.name}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--th-primary-bg)] text-[var(--th-primary-text)] font-medium">{(agent as any).llm_model ?? agent.llm_provider ?? 'anthropic'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--th-surface)] text-[var(--th-text-secondary)] font-medium">{agent.voice_provider ?? 'elevenlabs'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--th-surface)] text-[var(--th-text-secondary)] font-medium">{agent.language}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[10px] text-[var(--th-text-muted)]">
                  Created {new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(agent)}
                    className="p-1.5 rounded-lg hover:bg-[var(--th-surface)] text-[var(--th-text-muted)] hover:text-[var(--th-primary-text)] transition-colors"
                    aria-label="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => { setDeleteTarget(agent); setDeleteError(''); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--th-text-muted)] hover:text-red-500 transition-colors"
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
          <div className="bg-[var(--th-modal)] rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 space-y-4">
              <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--th-text)]">{t('agents.deleteAgent')}</h3>
                <p className="text-sm text-[var(--th-text-secondary)] mt-1">{t('agents.deleteConfirm', { name: deleteTarget.name })}</p>
              </div>
              {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg transition-colors">{t('common.cancel')}</button>
                <button onClick={handleDeleteConfirm} className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-all">{t('common.delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {modal && (
        <div className="fixed inset-0 bg-[var(--th-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal} onKeyDown={e => e.key === 'Escape' && closeModal()} role="dialog" aria-modal="true">
          <div className="bg-[var(--th-modal)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--th-border)]">
              <h2 className="text-base font-semibold text-[var(--th-text)]">{editId ? t('agents.editAgent') : t('agents.newAIAgent')}</h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-[var(--th-surface)] rounded-lg" aria-label="Close">
                <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {[
                { label: t('agents.agentName'), key: 'name', type: 'text', placeholder: 'Support Agent' },
              ].map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors"
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('agents.language') || 'Language'}</label>
                <select
                  value={form.language}
                  onChange={e => setForm(p => ({ ...p, language: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] bg-[var(--th-input)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="en">English</option>
                  <option value="ru">Russian</option>
                  <option value="es">Spanish</option>
                  <option value="de">German</option>
                  <option value="fr">French</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('agents.llmProvider')}</label>
                  <select
                    value={form.llm_provider}
                    onChange={e => {
                      const provider = e.target.value;
                      setForm(p => ({ ...p, llm_provider: provider, llm_model: DEFAULT_MODELS[provider] ?? '' }));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] bg-[var(--th-input)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]"
                  >
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="xai">xAI (Grok)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('agents.voiceProvider')}</label>
                  <select
                    value={form.voice_provider}
                    onChange={e => {
                      const vp = e.target.value;
                      setForm(p => ({ ...p, voice_provider: vp, voice_id: DEFAULT_VOICE[vp] ?? '' }));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] bg-[var(--th-input)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]"
                  >
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="openai">OpenAI TTS</option>
                    <option value="xai">xAI Grok</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('agents.model')}</label>
                <select
                  value={form.llm_model}
                  onChange={e => setForm(p => ({ ...p, llm_model: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] bg-[var(--th-input)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]"
                >
                  {(LLM_MODELS[form.llm_provider] ?? []).map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              {(VOICE_OPTIONS[form.voice_provider]?.length ?? 0) > 1 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('agents.voice')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(VOICE_OPTIONS[form.voice_provider] ?? []).map(v => (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, voice_id: v.value }))}
                        className={`relative flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 text-center transition-all ${
                          form.voice_id === v.value
                            ? 'border-[var(--th-primary)] bg-[var(--th-primary-bg)] shadow-sm'
                            : 'border-[var(--th-border)] bg-[var(--th-card)] hover:border-[var(--th-primary-muted)] hover:bg-[var(--th-skeleton)]'
                        }`}
                      >
                        <span className="text-lg">{v.emoji}</span>
                        <span className={`text-sm font-semibold ${form.voice_id === v.value ? 'text-[var(--th-primary-text)]' : 'text-[var(--th-text)]'}`}>{v.label}</span>
                        <span className="text-[10px] text-[var(--th-text-muted)] leading-tight">{v.desc}</span>
                        {form.voice_id === v.value && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-[var(--th-primary)] rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Pack Linking (edit mode) */}
              {editId && (
                <div className="space-y-3 border-t border-[var(--th-border)] pt-4">
                  {packsLoading ? (
                    <p className="text-xs text-[var(--th-text-muted)]">{t('agents.loadingPacks')}</p>
                  ) : (
                    <>
                      {/* Prompt Packs */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('agents.promptPacks')}</label>
                        {allPromptPacks.length === 0 ? (
                          <p className="text-xs text-[var(--th-text-muted)]">{t('agents.noPromptPacks')}</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {allPromptPacks.map(pp => {
                              const active = selectedPromptPackIds.has(pp.id);
                              return (
                                <button
                                  key={pp.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPromptPackIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(pp.id)) next.delete(pp.id); else next.add(pp.id);
                                      return next;
                                    });
                                  }}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                    active
                                      ? 'bg-[var(--th-primary)] text-white border-[var(--th-primary)]'
                                      : 'bg-[var(--th-card)] text-[var(--th-text-secondary)] border-[var(--th-border)] hover:border-[var(--th-primary-muted)] hover:bg-[var(--th-skeleton)]'
                                  }`}
                                >
                                  {pp.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/* Skill Packs */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('agents.skillPacks')}</label>
                        {allSkillPacks.length === 0 ? (
                          <p className="text-xs text-[var(--th-text-muted)]">{t('agents.noSkillPacks')}</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {allSkillPacks.map(sp => {
                              const active = selectedSkillPackIds.has(sp.id);
                              return (
                                <button
                                  key={sp.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSkillPackIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(sp.id)) next.delete(sp.id); else next.add(sp.id);
                                      return next;
                                    });
                                  }}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                    active
                                      ? 'bg-[var(--th-primary)] text-white border-[var(--th-primary)]'
                                      : 'bg-[var(--th-card)] text-[var(--th-text-secondary)] border-[var(--th-border)] hover:border-[var(--th-primary-muted)] hover:bg-[var(--th-skeleton)]'
                                  }`}
                                >
                                  {sp.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('agents.systemPrompt')}</label>
                <textarea
                  rows={3}
                  value={form.system_prompt}
                  onChange={e => setForm(p => ({ ...p, system_prompt: e.target.value }))}
                  placeholder="You are a helpful AI phone agent for..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('agents.firstMessage')}</label>
                <input
                  type="text"
                  value={form.first_message}
                  onChange={e => setForm(p => ({ ...p, first_message: e.target.value }))}
                  placeholder="Hello! How can I help you today?"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-colors"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg transition-colors">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} className="px-4 py-2.5 bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-60">
                  {saving ? t('agents.saving') : editId ? t('agents.saveChanges') : t('agents.createAgent')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
