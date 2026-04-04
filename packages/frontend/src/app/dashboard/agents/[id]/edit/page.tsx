'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AgentDetail {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  company_name: string | null;
  language: string;
  voice_provider: string | null;
  voice_id: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  llm_temperature: number | null;
  system_prompt: string | null;
  greeting_message: string | null;
  business_mode: string | null;
  memory_enabled: boolean;
  is_default: boolean;
  is_active: boolean;
  avatar_url: string | null;
  skill_packs?: { id: string; name: string; description?: string | null; intent?: string | null; priority: number }[];
  prompt_packs?: { id: string; name: string; description?: string | null; category?: string | null; priority: number }[];
  knowledge_bases?: { id: string; name: string; description?: string | null }[];
}

interface KnowledgeBaseItem {
  id: string;
  name: string;
  description: string | null;
  document_count?: number;
}

interface SkillPack {
  id: string;
  name: string;
  description: string | null;
  intent: string | null;
}

interface PromptPack {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

interface SkillSuggestion {
  skill_pack_id: string;
  name: string;
  reason: string;
}

interface FormState {
  display_name: string;
  name: string;
  description: string;
  company_name: string;
  language: string;
  voice_provider: string;
  voice_id: string;
  llm_provider: string;
  llm_model: string;
  llm_temperature: number;
  system_prompt: string;
  greeting_message: string;
  business_mode: string;
  memory_enabled: boolean;
  is_default: boolean;
  avatar_url: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const SECTIONS = ['general', 'voice', 'llm', 'skills', 'prompts', 'knowledge', 'advanced'] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_ICONS: Record<Section, string> = {
  general: '\u2699\ufe0f',
  voice: '\ud83c\udf99\ufe0f',
  llm: '\ud83e\udde0',
  skills: '\u26a1',
  prompts: '\ud83d\udcdd',
  knowledge: '\ud83d\udcda',
  advanced: '\ud83d\udd27',
};

const SECTION_KEYS: Record<Section, string> = {
  general: 'agents.general',
  voice: 'agents.voice',
  llm: 'agents.llm',
  skills: 'agents.skills',
  prompts: 'agents.prompts',
  knowledge: 'agents.knowledge',
  advanced: 'agents.advanced',
};

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
];

const VOICE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  elevenlabs: [
    { value: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah' },
    { value: 'rachel', label: 'Rachel' },
    { value: 'domi', label: 'Domi' },
    { value: 'bella', label: 'Bella' },
    { value: 'antoni', label: 'Antoni' },
    { value: 'elli', label: 'Elli' },
    { value: 'josh', label: 'Josh' },
    { value: 'arnold', label: 'Arnold' },
    { value: 'adam', label: 'Adam' },
    { value: 'sam', label: 'Sam' },
  ],
  openai: [
    { value: 'alloy', label: 'Alloy' },
    { value: 'echo', label: 'Echo' },
    { value: 'fable', label: 'Fable' },
    { value: 'onyx', label: 'Onyx' },
    { value: 'nova', label: 'Nova' },
    { value: 'shimmer', label: 'Shimmer' },
  ],
  xai: [
    { value: 'ara', label: 'Ara' },
    { value: 'rex', label: 'Rex' },
    { value: 'sal', label: 'Sal' },
    { value: 'eve', label: 'Eve' },
    { value: 'leo', label: 'Leo' },
  ],
};

const DEFAULT_VOICE: Record<string, string> = {
  elevenlabs: 'EXAVITQu4vr4xnSDxMaL',
  openai: 'alloy',
  xai: 'ara',
};

const LLM_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
    { value: 'claude-opus-4-5-20250514', label: 'Claude Opus 4.5' },
    { value: 'claude-haiku-3-5', label: 'Claude Haiku 3.5' },
  ],
  openai: [
    { value: 'gpt-4.1', label: 'GPT-4.1 (flagship, 1M ctx)' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (fast)' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (cheapest)' },
    { value: 'o3', label: 'o3 (reasoning)' },
    { value: 'o4-mini', label: 'o4-mini (reasoning, fast)' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  ],
  openai_proxy: [
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
    { value: 'gpt-5.4', label: 'GPT-5.4' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'o3', label: 'o3 (reasoning)' },
    { value: 'o4-mini', label: 'o4-mini (reasoning, fast)' },
  ],
  xai: [
    { value: 'grok-3', label: 'Grok 3' },
    { value: 'grok-3-mini', label: 'Grok 3 Mini' },
    { value: 'grok-3-mini-fast', label: 'Grok 3 Mini Fast' },
  ],
};

const DEFAULT_MODEL: Record<string, string> = {
  anthropic: 'claude-sonnet-4-5-20250514',
  openai: 'gpt-4.1-mini',
  openai_proxy: 'gpt-5.4-mini',
  xai: 'grok-3',
};

const VOICE_PROVIDERS = [
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'openai', label: 'OpenAI TTS' },
  { value: 'xai', label: 'xAI Grok' },
];

const LLM_PROVIDERS_BASE = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai_proxy', label: 'OpenAI Proxy' },
  { value: 'xai', label: 'xAI' },
];

const DEFAULT_AVATARS = Array.from({ length: 8 }, (_, i) => `/avatars/default-${i + 1}.svg`);

const INITIAL_FORM: FormState = {
  display_name: '',
  name: '',
  description: '',
  company_name: '',
  language: 'en',
  voice_provider: 'elevenlabs',
  voice_id: 'EXAVITQu4vr4xnSDxMaL',
  llm_provider: 'anthropic',
  llm_model: 'claude-sonnet-4-5-20250514',
  llm_temperature: 0.7,
  system_prompt: '',
  greeting_message: '',
  business_mode: '',
  memory_enabled: false,
  is_default: false,
  avatar_url: '',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function AgentEditPage() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<Section>('general');
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  // Skills / Prompts
  const [allSkills, setAllSkills] = useState<SkillPack[]>([]);
  const [allPrompts, setAllPrompts] = useState<PromptPack[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set());
  const [skillSuggestions, setSkillSuggestions] = useState<SkillSuggestion[] | null>(null);
  const [suggestingSkills, setSuggestingSkills] = useState(false);

  // OpenAI Proxy availability
  const [proxyAvailable, setProxyAvailable] = useState(false);

  // Knowledge bases
  const [allKBs, setAllKBs] = useState<KnowledgeBaseItem[]>([]);
  const [selectedKBs, setSelectedKBs] = useState<Set<string>>(new Set());

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  // ─── Load data ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [agent, skills, prompts, kbs, ws] = await Promise.all([
          api.get<AgentDetail>(`/agents/${id}`),
          api.get<{ skill_packs: SkillPack[] }>('/skill-packs').then(r => r.skill_packs ?? []).catch(() => [] as SkillPack[]),
          api.get<{ prompt_packs: PromptPack[] }>('/prompt-packs').then(r => r.prompt_packs ?? []).catch(() => [] as PromptPack[]),
          api.get<{ knowledge_bases: KnowledgeBaseItem[] }>('/knowledge').then(r => r.knowledge_bases ?? []).catch(() => [] as KnowledgeBaseItem[]),
          api.get<{ openai_proxy_available?: boolean }>('/workspaces/current').catch(() => ({ openai_proxy_available: false })),
        ]);
        setProxyAvailable(ws.openai_proxy_available ?? false);

        setForm({
          display_name: agent.display_name || '',
          name: agent.name || '',
          description: agent.description || '',
          company_name: agent.company_name || '',
          language: agent.language || 'en',
          voice_provider: agent.voice_provider || 'elevenlabs',
          voice_id: agent.voice_id || 'EXAVITQu4vr4xnSDxMaL',
          llm_provider: agent.llm_provider || 'anthropic',
          llm_model: agent.llm_model || 'claude-sonnet-4-5-20250514',
          llm_temperature: agent.llm_temperature ?? 0.7,
          system_prompt: agent.system_prompt || '',
          greeting_message: agent.greeting_message || '',
          business_mode: agent.business_mode || '',
          memory_enabled: agent.memory_enabled ?? false,
          is_default: agent.is_default ?? false,
          avatar_url: agent.avatar_url || '',
        });
        setAvatarPreview(agent.avatar_url || '');
        setAllSkills(skills);
        setAllPrompts(prompts);
        setAllKBs(kbs);
        setSelectedSkills(new Set((agent.skill_packs ?? []).map(s => s.id)));
        setSelectedPrompts(new Set((agent.prompt_packs ?? []).map(p => p.id)));
        setSelectedKBs(new Set((agent.knowledge_bases ?? []).map(kb => kb.id)));
      } catch (err: any) {
        toast.error(err.message || 'Failed to load agent');
        router.push('/dashboard/agents');
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.display_name.trim() || !form.name.trim()) {
      toast.error('Display name and handle are required');
      setSection('general');
      return;
    }

    setSaving(true);
    try {
      // 1. Patch agent
      await api.patch(`/agents/${id}`, {
        display_name: form.display_name,
        name: form.name,
        description: form.description || null,
        company_name: form.company_name || null,
        language: form.language,
        voice_provider: form.voice_provider,
        voice_id: form.voice_id,
        llm_provider: form.llm_provider,
        llm_model: form.llm_model,
        llm_temperature: form.llm_temperature,
        system_prompt: form.system_prompt || null,
        greeting_message: form.greeting_message || null,
        business_mode: form.business_mode || null,
        memory_enabled: form.memory_enabled,
        is_default: form.is_default,
        avatar_url: form.avatar_url || null,
      });

      // 2. Sync skill packs (atomic batch)
      await api.put(`/agents/${id}/skill-packs`, {
        skill_pack_ids: Array.from(selectedSkills),
      });

      // 3. Sync prompt packs (atomic batch)
      await api.put(`/agents/${id}/prompt-packs`, {
        prompt_pack_ids: Array.from(selectedPrompts),
      });

      // 4. Sync knowledge bases: delete all, then re-add selected
      try {
        await api.delete(`/agents/${id}/knowledge-bases`);
        const kbPromises = Array.from(selectedKBs).map(kbId =>
          api.post(`/agents/${id}/knowledge-bases`, { knowledge_base_id: kbId })
        );
        await Promise.all(kbPromises);
      } catch { /* KB sync optional */ }

      // 5. Upload avatar if changed
      if (avatarFile) {
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('caller_token') : null;
          const formData = new FormData();
          formData.append('file', avatarFile);
          await fetch(`${API_BASE}/agents/${id}/avatar`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });
        } catch { /* avatar upload optional */ }
      }

      toast.success(t('agents.saved'));
      router.push('/dashboard/agents');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/agents/${id}`);
      toast.success(t('agents.deleteAgent'));
      router.push('/dashboard/agents');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  // ─── Avatar handling ──────────────────────────────────────────────────────

  function handleAvatarFile(file: File) {
    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
    set('avatar_url', ''); // will use file upload instead
  }

  function selectDefaultAvatar(url: string) {
    setAvatarFile(null);
    setAvatarPreview(url);
    set('avatar_url', url);
  }

  // ─── Skills suggest ───────────────────────────────────────────────────────

  async function suggestSkills() {
    setSuggestingSkills(true);
    setSkillSuggestions(null);
    try {
      const res = await api.post<{ suggestions: SkillSuggestion[] }>(`/agents/${id}/suggest-skills`, {});
      setSkillSuggestions(res.suggestions ?? []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to suggest skills');
    } finally {
      setSuggestingSkills(false);
    }
  }

  function applySuggestions() {
    if (!skillSuggestions) return;
    setSelectedSkills(prev => {
      const next = new Set(prev);
      skillSuggestions.forEach(s => next.add(s.skill_pack_id));
      return next;
    });
    setSkillSuggestions(null);
    toast.success(t('agents.skillActivated'));
  }

  // ─── Toggle helpers ───────────────────────────────────────────────────────

  function toggleSkill(skillId: string) {
    setSelectedSkills(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  }

  function togglePrompt(promptId: string) {
    setSelectedPrompts(prev => {
      const next = new Set(prev);
      if (next.has(promptId)) next.delete(promptId);
      else next.add(promptId);
      return next;
    });
  }

  // ─── Render: Loading ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-[var(--th-text-muted)]">{t('common.loading')}</div>
      </div>
    );
  }

  // ─── Render: Sections ─────────────────────────────────────────────────────

  function renderGeneral() {
    return (
      <div className="space-y-6">
        {/* Avatar */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-2">{t('agents.avatar')}</label>
          <div className="flex items-start gap-4">
            <div
              className="w-20 h-20 rounded-full bg-[var(--th-surface)] border-2 border-[var(--th-border)] overflow-hidden flex items-center justify-center flex-shrink-0"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl text-[var(--th-text-muted)]">
                  {form.display_name?.[0]?.toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {DEFAULT_AVATARS.map(url => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => selectDefaultAvatar(url)}
                    className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all ${
                      avatarPreview === url
                        ? 'border-[var(--th-primary)] ring-2 ring-[var(--th-primary)] ring-offset-1'
                        : 'border-[var(--th-border)] hover:border-[var(--th-primary)]'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-[var(--th-primary)] hover:underline"
              >
                {t('agents.uploadCustom')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarFile(file);
                }}
              />
            </div>
          </div>
        </div>

        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-1">{t('agents.displayName')} *</label>
          <input
            type="text"
            value={form.display_name}
            onChange={e => set('display_name', e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg bg-[var(--th-input)] border border-[var(--th-input-border)] text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]"
          />
        </div>

        {/* Handle */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-1">{t('agents.name')} *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg bg-[var(--th-input)] border border-[var(--th-input-border)] text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-1">{t('agents.description')}</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-[var(--th-input)] border border-[var(--th-input-border)] text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)] resize-none"
          />
          <p className="text-xs text-[var(--th-text-muted)] mt-1">{t('agents.descriptionHint')}</p>
        </div>

        {/* Company */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-1">{t('agents.company')}</label>
          <input
            type="text"
            value={form.company_name}
            onChange={e => set('company_name', e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--th-input)] border border-[var(--th-input-border)] text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]"
          />
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-1">{t('agents.language')}</label>
          <select
            value={form.language}
            onChange={e => set('language', e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--th-input)] border border-[var(--th-input-border)] text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]"
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Greeting */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-1">{t('agents.greeting')}</label>
          <input
            type="text"
            value={form.greeting_message}
            onChange={e => set('greeting_message', e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--th-input)] border border-[var(--th-input-border)] text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]"
          />
        </div>
      </div>
    );
  }

  function renderVoice() {
    return (
      <div className="space-y-6">
        {/* Voice Provider */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-2">{t('agents.voiceProvider')}</label>
          <div className="grid grid-cols-3 gap-2">
            {VOICE_PROVIDERS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  set('voice_provider', p.value);
                  set('voice_id', DEFAULT_VOICE[p.value] || '');
                }}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                  form.voice_provider === p.value
                    ? 'bg-[var(--th-primary)] text-white border-[var(--th-primary)]'
                    : 'bg-[var(--th-surface)] text-[var(--th-text-secondary)] border-[var(--th-border)] hover:border-[var(--th-primary)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Voice Selection */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-2">{t('agents.voiceId')}</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(VOICE_OPTIONS[form.voice_provider] ?? []).map(v => (
              <button
                key={v.value}
                type="button"
                onClick={() => set('voice_id', v.value)}
                className={`px-3 py-2.5 rounded-lg text-sm border transition-all text-left ${
                  form.voice_id === v.value
                    ? 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)] border-[var(--th-primary)]'
                    : 'bg-[var(--th-surface)] text-[var(--th-text-secondary)] border-[var(--th-border)] hover:border-[var(--th-primary)]'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderLLM() {
    return (
      <div className="space-y-6">
        {/* LLM Provider */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-2">{t('agents.llmProvider')}</label>
          <div className="grid grid-cols-3 gap-2">
            {LLM_PROVIDERS_BASE.filter(p => p.value !== 'openai_proxy' || proxyAvailable).map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  set('llm_provider', p.value);
                  set('llm_model', DEFAULT_MODEL[p.value] || '');
                }}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                  form.llm_provider === p.value
                    ? 'bg-[var(--th-primary)] text-white border-[var(--th-primary)]'
                    : 'bg-[var(--th-surface)] text-[var(--th-text-secondary)] border-[var(--th-border)] hover:border-[var(--th-primary)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-1">{t('agents.llmModel')}</label>
          <select
            value={form.llm_model}
            onChange={e => set('llm_model', e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--th-input)] border border-[var(--th-input-border)] text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]"
          >
            {(LLM_MODELS[form.llm_provider] ?? []).map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-1">{t('agents.systemPrompt')}</label>
          <textarea
            value={form.system_prompt}
            onChange={e => set('system_prompt', e.target.value)}
            rows={6}
            className="w-full px-3 py-2 rounded-lg bg-[var(--th-input)] border border-[var(--th-input-border)] text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)] resize-none font-mono text-sm"
          />
        </div>

        {/* Temperature */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-1">
            {t('agents.temperature')}: <span className="text-[var(--th-primary)]">{Number(form.llm_temperature).toFixed(1)}</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={form.llm_temperature}
            onChange={e => set('llm_temperature', parseFloat(e.target.value))}
            className="w-full accent-[var(--th-primary)]"
          />
          <div className="flex justify-between text-xs text-[var(--th-text-muted)]">
            <span>0.0 (Precise)</span>
            <span>1.0 (Creative)</span>
          </div>
        </div>
      </div>
    );
  }

  function renderSkills() {
    return (
      <div className="space-y-4">
        {/* Header with suggest button */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--th-text)]">{t('agents.skills')}</label>
          <button
            type="button"
            onClick={suggestSkills}
            disabled={suggestingSkills}
            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--th-primary)] text-white hover:bg-[var(--th-primary-hover)] disabled:opacity-50 transition-all"
          >
            {suggestingSkills ? t('agents.suggestLoading') : t('agents.suggestSkills')}
          </button>
        </div>

        {/* Suggestions banner */}
        {skillSuggestions && skillSuggestions.length > 0 && (
          <div className="p-3 rounded-lg bg-[var(--th-primary-bg)] border border-[var(--th-primary)]">
            <div className="space-y-2 mb-3">
              {skillSuggestions.map(s => (
                <div key={s.skill_pack_id} className="text-sm">
                  <span className="font-medium text-[var(--th-text)]">{s.name}</span>
                  <span className="text-[var(--th-text-muted)] ml-2">{t('agents.recommendedBecause')} {s.reason}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={applySuggestions}
              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--th-primary)] text-white hover:bg-[var(--th-primary-hover)] transition-all"
            >
              {t('agents.applySuggestions')}
            </button>
          </div>
        )}

        {/* Skill list */}
        {allSkills.length === 0 ? (
          <p className="text-sm text-[var(--th-text-muted)]">{t('agents.noSkills')}</p>
        ) : (
          <div className="space-y-2">
            {allSkills.map(skill => (
              <div
                key={skill.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  selectedSkills.has(skill.id)
                    ? 'bg-[var(--th-primary-bg)] border-[var(--th-primary)]'
                    : 'bg-[var(--th-surface)] border-[var(--th-border)]'
                }`}
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--th-text)]">{skill.name}</span>
                    {skill.intent && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--th-surface)] text-[var(--th-text-muted)] border border-[var(--th-border)]">
                        {skill.intent}
                      </span>
                    )}
                  </div>
                  {skill.description && (
                    <p className="text-xs text-[var(--th-text-muted)] mt-0.5 truncate">{skill.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                    selectedSkills.has(skill.id) ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      selectedSkills.has(skill.id) ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderPrompts() {
    return (
      <div className="space-y-4">
        <label className="block text-sm font-medium text-[var(--th-text)]">{t('agents.prompts')}</label>

        {allPrompts.length === 0 ? (
          <p className="text-sm text-[var(--th-text-muted)]">{t('agents.noPrompts')}</p>
        ) : (
          <div className="space-y-2">
            {allPrompts.map(prompt => (
              <div
                key={prompt.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  selectedPrompts.has(prompt.id)
                    ? 'bg-[var(--th-primary-bg)] border-[var(--th-primary)]'
                    : 'bg-[var(--th-surface)] border-[var(--th-border)]'
                }`}
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--th-text)]">{prompt.name}</span>
                    {prompt.category && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--th-surface)] text-[var(--th-text-muted)] border border-[var(--th-border)]">
                        {prompt.category}
                      </span>
                    )}
                  </div>
                  {prompt.description && (
                    <p className="text-xs text-[var(--th-text-muted)] mt-0.5 truncate">{prompt.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => togglePrompt(prompt.id)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                    selectedPrompts.has(prompt.id) ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      selectedPrompts.has(prompt.id) ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderKnowledge() {
    function toggleKB(kbId: string) {
      setSelectedKBs(prev => {
        const next = new Set(prev);
        if (next.has(kbId)) next.delete(kbId);
        else next.add(kbId);
        return next;
      });
    }

    return (
      <div className="space-y-4">
        <label className="block text-sm font-medium text-[var(--th-text)]">{t('agents.knowledge')}</label>

        {allKBs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--th-text-muted)]">{t('agents.noKBs')}</p>
            <a href="/dashboard/knowledge" className="text-sm text-[var(--th-primary)] hover:underline mt-2 inline-block">{t('knowledge.createKB')}</a>
          </div>
        ) : (
          <div className="space-y-2">
            {allKBs.map(kb => (
              <div
                key={kb.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  selectedKBs.has(kb.id)
                    ? 'bg-[var(--th-primary-bg)] border-[var(--th-primary)]'
                    : 'bg-[var(--th-surface)] border-[var(--th-border)]'
                }`}
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--th-text)]">{kb.name}</span>
                    {kb.document_count != null && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--th-surface)] text-[var(--th-text-muted)] border border-[var(--th-border)]">
                        {kb.document_count} {t('knowledge.docs')}
                      </span>
                    )}
                  </div>
                  {kb.description && (
                    <p className="text-xs text-[var(--th-text-muted)] mt-0.5 truncate">{kb.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleKB(kb.id)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                    selectedKBs.has(kb.id) ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      selectedKBs.has(kb.id) ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderAdvanced() {
    return (
      <div className="space-y-6">
        {/* Business Mode */}
        <div>
          <label className="block text-sm font-medium text-[var(--th-text)] mb-1">{t('agents.businessMode')}</label>
          <input
            type="text"
            value={form.business_mode}
            onChange={e => set('business_mode', e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--th-input)] border border-[var(--th-input-border)] text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]"
          />
        </div>

        {/* Memory Enabled */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--th-text)]">{t('agents.memoryEnabled')}</label>
          <button
            type="button"
            onClick={() => set('memory_enabled', !form.memory_enabled)}
            className={`relative w-10 h-6 rounded-full transition-colors ${
              form.memory_enabled ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                form.memory_enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Is Default */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--th-text)]">{t('agents.isDefault')}</label>
          <button
            type="button"
            onClick={() => set('is_default', !form.is_default)}
            className={`relative w-10 h-6 rounded-full transition-colors ${
              form.is_default ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                form.is_default ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    );
  }

  const RENDER_MAP: Record<Section, () => React.ReactNode> = {
    general: renderGeneral,
    voice: renderVoice,
    llm: renderLLM,
    skills: renderSkills,
    prompts: renderPrompts,
    knowledge: renderKnowledge,
    advanced: renderAdvanced,
  };

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--th-border)] bg-[var(--th-card)]">
        <button
          type="button"
          onClick={() => router.push('/dashboard/agents')}
          className="flex items-center gap-2 text-sm text-[var(--th-text-secondary)] hover:text-[var(--th-text)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t('agents.backToAgents')}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/dashboard/agents')}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--th-border)] text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] transition-all"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--th-primary)] text-white hover:bg-[var(--th-primary-hover)] disabled:opacity-50 transition-all font-medium"
          >
            {saving ? t('agents.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar — desktop */}
        <nav className="hidden md:flex flex-col w-48 border-r border-[var(--th-border)] bg-[var(--th-card)] py-2 flex-shrink-0">
          {SECTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-all mx-2 rounded-lg ${
                section === s
                  ? 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)] font-medium'
                  : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)]'
              }`}
            >
              <span>{SECTION_ICONS[s]}</span>
              <span>{t(SECTION_KEYS[s])}</span>
            </button>
          ))}
        </nav>

        {/* Mobile tabs */}
        <div className="md:hidden flex overflow-x-auto border-b border-[var(--th-border)] bg-[var(--th-card)] px-2 py-1 gap-1 flex-shrink-0">
          {SECTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className={`flex items-center gap-1 px-3 py-2 text-xs rounded-lg whitespace-nowrap transition-all ${
                section === s
                  ? 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)] font-medium'
                  : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)]'
              }`}
            >
              <span>{SECTION_ICONS[s]}</span>
              <span>{t(SECTION_KEYS[s])}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6">
            {RENDER_MAP[section]()}

            {/* Delete zone — always visible at bottom */}
            <div className="mt-12 pt-6 border-t border-[var(--th-border)]">
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 transition-all"
              >
                {t('agents.deleteAgent')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--th-card)] rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl border border-[var(--th-border)]">
            <h3 className="text-lg font-semibold text-[var(--th-text)] mb-2">{t('agents.deleteAgent')}</h3>
            <p className="text-sm text-[var(--th-text-secondary)] mb-6">{t('agents.deleteConfirm')}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-[var(--th-border)] text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-all font-medium"
              >
                {deleting ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
