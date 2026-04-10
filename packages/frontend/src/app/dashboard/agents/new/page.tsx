'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { useIsMobile } from '@/lib/useBreakpoint';
import CollapsibleSection from '@/components/CollapsibleSection';
import MobilePageHeader from '@/components/MobilePageHeader';

const DEFAULT_AVATARS = Array.from({ length: 8 }, (_, i) => `/avatars/default-${i + 1}.svg`);

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
  xai: [
    { value: 'grok-3', label: 'Grok 3' },
    { value: 'grok-3-mini-fast', label: 'Grok 3 Mini Fast' },
  ],
};

const VOICE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  elevenlabs: [
    { value: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah' },
    { value: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel' },
    { value: 'AZnzlk1XvdvUeBnXmlld', label: 'Domi' },
    { value: 'pNInz6obpgDQGcFmaJgB', label: 'Adam' },
  ],
  openai: [
    { value: 'alloy', label: 'Alloy' },
    { value: 'echo', label: 'Echo' },
    { value: 'nova', label: 'Nova' },
    { value: 'shimmer', label: 'Shimmer' },
  ],
  xai: [
    { value: 'eve', label: 'Eve' },
    { value: 'rex', label: 'Rex' },
    { value: 'ara', label: 'Ara' },
  ],
};

interface AgentForm {
  display_name: string;
  name: string;
  description: string;
  avatar_url: string;
  company_name: string;
  language: string;
  greeting_message: string;
  voice_provider: string;
  voice_id: string;
  llm_provider: string;
  llm_model: string;
  system_prompt: string;
  business_mode: string;
}

const INITIAL: AgentForm = {
  display_name: '', name: '', description: '', avatar_url: '', company_name: '',
  language: 'auto', greeting_message: '',
  voice_provider: 'elevenlabs', voice_id: 'EXAVITQu4vr4xnSDxMaL',
  llm_provider: 'anthropic', llm_model: 'claude-sonnet-4-5-20250514',
  system_prompt: '', business_mode: '',
};

const SECTIONS = ['general', 'voice', 'llm', 'advanced'] as const;

export default function NewAgentPage() {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const isMobile = useIsMobile();
  const [form, setForm] = useState<AgentForm>(INITIAL);
  const [section, setSection] = useState<string>('general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  const set = (key: keyof AgentForm, value: string) => setForm(p => ({ ...p, [key]: value }));

  function handleAvatarFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    set('avatar_url', ''); // clear default selection
  }

  function selectDefaultAvatar(url: string) {
    setAvatarFile(null);
    setAvatarPreview('');
    set('avatar_url', url);
  }

  async function handleSave() {
    if (!form.display_name.trim()) { setError(t('agents.displayName') + ' is required'); return; }
    if (!form.name.trim()) { setError(t('agents.name') + ' is required'); return; }

    setError('');
    setSaving(true);
    try {
      const created = await api.post<{ id: string }>('/agents', {
        ...form,
        display_name: form.display_name,
        name: form.name,
      });

      // Upload avatar file if selected
      if (avatarFile && created.id) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const token = localStorage.getItem('caller_token');
        const base = process.env.NEXT_PUBLIC_API_URL || '/api';
        await fetch(`${base}/agents/${created.id}/avatar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
      }

      toast.success(t('agents.created'));
      router.push('/dashboard/agents');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const displayAvatar = avatarPreview || form.avatar_url || '';
  const initials = (form.display_name || form.name || '??').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-4">
      {/* Header — mobile */}
      <MobilePageHeader
        title={t('agents.newAgent')}
        backHref="/dashboard/agents"
      />

      {/* Header — desktop */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/agents')} className="p-2 rounded-lg hover:bg-[var(--th-surface)] text-[var(--th-text-secondary)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-[var(--th-text)]">{t('agents.newAgent')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/dashboard/agents')} className="px-4 py-2 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg">{t('common.cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-white text-sm font-semibold rounded-lg disabled:opacity-60">
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}

      {/* Layout: sidebar + content */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Sidebar */}
        <div className="lg:w-48 shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {SECTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`px-3 py-2 text-sm font-medium rounded-lg text-left whitespace-nowrap transition-colors ${
                  section === s
                    ? 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]'
                    : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)]'
                }`}
              >
                {t(`agents.${s}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)] p-6 space-y-5">
          {section === 'general' && (
            <>
              {/* Avatar */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('agents.avatar')}</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--th-surface)] flex items-center justify-center shrink-0 border-2 border-[var(--th-card-border-subtle)]">
                    {displayAvatar ? (
                      <img src={displayAvatar} className="w-full h-full object-cover" alt="Avatar" />
                    ) : (
                      <span className="text-2xl font-bold text-[var(--th-text-muted)]">{initials}</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2 overflow-x-auto md:flex-wrap pb-1 md:pb-0">
                      {DEFAULT_AVATARS.map(url => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => selectDefaultAvatar(url)}
                          className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all shrink-0 ${
                            form.avatar_url === url ? 'border-[var(--th-primary)] ring-2 ring-[var(--th-primary)]/30' : 'border-[var(--th-border)] hover:border-[var(--th-primary-muted)]'
                          }`}
                        >
                          <img src={url} className="w-full h-full object-cover" alt="" />
                        </button>
                      ))}
                    </div>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--th-primary-text)] bg-[var(--th-primary-bg)] rounded-lg cursor-pointer hover:bg-[var(--th-primary-bg-hover)] transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      {t('agents.uploadCustom')}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleAvatarFile(e.target.files[0])} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t('agents.displayName')} value={form.display_name} onChange={v => set('display_name', v)} required placeholder="Support Agent" />
                <Field label={t('agents.name')} value={form.name} onChange={v => set('name', v)} required placeholder="support-agent" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide mb-1.5 block">{t('agents.description')}</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder={t('agents.descriptionHint')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t('agents.company')} value={form.company_name} onChange={v => set('company_name', v)} placeholder="Acme Corp" />
                <div>
                  <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide mb-1.5 block">{t('agents.language')}</label>
                  <select value={form.language} onChange={e => set('language', e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]">
                    <option value="auto">Auto-detect</option>
                    <option value="en">English</option>
                    <option value="ru">Russian</option>
                    <option value="es">Spanish</option>
                    <option value="de">German</option>
                    <option value="fr">French</option>
                  </select>
                </div>
              </div>
              <Field label={t('agents.greeting')} value={form.greeting_message} onChange={v => set('greeting_message', v)} placeholder="Hello! How can I help you today?" />
            </>
          )}

          {section === 'voice' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('agents.voiceProvider')}</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[{ v: 'elevenlabs', l: 'ElevenLabs' }, { v: 'openai', l: 'OpenAI TTS' }, { v: 'xai', l: 'xAI Grok' }].map(p => (
                    <button key={p.v} type="button" onClick={() => { set('voice_provider', p.v); set('voice_id', VOICE_OPTIONS[p.v]?.[0]?.value ?? ''); }}
                      className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${form.voice_provider === p.v ? 'border-[var(--th-primary)] bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]' : 'border-[var(--th-card-border-subtle)] text-[var(--th-text-secondary)] hover:border-[var(--th-primary)]'}`}>
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('agents.voiceId')}</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(VOICE_OPTIONS[form.voice_provider] ?? []).map(v => (
                    <button key={v.value} type="button" onClick={() => set('voice_id', v.value)}
                      className={`px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${form.voice_id === v.value ? 'border-[var(--th-primary)] bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]' : 'border-[var(--th-card-border-subtle)] text-[var(--th-text-secondary)] hover:border-[var(--th-primary)]'}`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {section === 'llm' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{t('agents.llmProvider')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[{ v: 'anthropic', l: 'Anthropic' }, { v: 'openai', l: 'OpenAI' }, { v: 'xai', l: 'xAI (Grok)' }].map(p => (
                    <button key={p.v} type="button" onClick={() => { set('llm_provider', p.v); set('llm_model', LLM_MODELS[p.v]?.[0]?.value ?? ''); }}
                      className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${form.llm_provider === p.v ? 'border-[var(--th-primary)] bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]' : 'border-[var(--th-card-border-subtle)] text-[var(--th-text-secondary)] hover:border-[var(--th-primary)]'}`}>
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide mb-1.5 block">{t('agents.llmModel')}</label>
                <select value={form.llm_model} onChange={e => set('llm_model', e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]">
                  {(LLM_MODELS[form.llm_provider] ?? []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide mb-1.5 block">{t('agents.systemPrompt')}</label>
                <textarea
                  rows={6}
                  value={form.system_prompt}
                  onChange={e => set('system_prompt', e.target.value)}
                  placeholder="You are a helpful AI phone agent..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] font-mono"
                />
              </div>
            </>
          )}

          {section === 'advanced' && (
            <>
              <Field label={t('agents.businessMode')} value={form.business_mode} onChange={v => set('business_mode', v)} placeholder="appointment_booking" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide mb-1.5 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-sm text-[var(--th-text)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]"
      />
    </div>
  );
}
