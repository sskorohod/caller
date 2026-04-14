// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentDetail {
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

export interface KnowledgeBaseItem {
  id: string;
  name: string;
  description: string | null;
  document_count?: number;
}

export interface SkillPack {
  id: string;
  name: string;
  description: string | null;
  intent: string | null;
}

export interface PromptPack {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

export interface SkillSuggestion {
  skill_pack_id: string;
  name: string;
  reason: string;
}

export interface FormState {
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

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export const SECTIONS = ['general', 'voice', 'llm', 'skills', 'prompts', 'knowledge', 'advanced'] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_ICONS: Record<Section, React.ReactNode> = {
  general: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  voice: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>,
  llm: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>,
  skills: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
  prompts: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
  knowledge: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>,
  advanced: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.657-5.657a8.002 8.002 0 1111.314 0l-5.657 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L18 21.75" /><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L4.84 21.75" /></svg>,
};

export const SECTION_KEYS: Record<Section, string> = {
  general: 'agents.general',
  voice: 'agents.voice',
  llm: 'agents.llm',
  skills: 'agents.skills',
  prompts: 'agents.prompts',
  knowledge: 'agents.knowledge',
  advanced: 'agents.advanced',
};

export const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
];

export const VOICE_OPTIONS: Record<string, { value: string; label: string }[]> = {
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

export const DEFAULT_VOICE: Record<string, string> = {
  elevenlabs: 'EXAVITQu4vr4xnSDxMaL',
  openai: 'alloy',
  xai: 'ara',
};

export const LLM_MODELS: Record<string, { value: string; label: string }[]> = {
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

export const DEFAULT_MODEL: Record<string, string> = {
  anthropic: 'claude-sonnet-4-5-20250514',
  openai: 'gpt-4.1-mini',
  openai_proxy: 'gpt-5.4-mini',
  xai: 'grok-3',
};

export const VOICE_PROVIDERS = [
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'openai', label: 'OpenAI TTS' },
  { value: 'xai', label: 'xAI Grok' },
];

export const LLM_PROVIDERS_BASE = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai_proxy', label: 'OpenAI Proxy' },
  { value: 'xai', label: 'xAI' },
];

export const DEFAULT_AVATARS = Array.from({ length: 8 }, (_, i) => `/avatars/default-${i + 1}.svg`);

export const INITIAL_FORM: FormState = {
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
