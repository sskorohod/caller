'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Agent {
  id: string;
  name: string;
  voice_provider: string | null;
  llm_provider: string | null;
  language: string;
  is_active: boolean;
  created_at: string;
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

const VOICE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  elevenlabs: [
    { value: 'EXAVITQu4vr4xnSDxMaL', label: 'Default (Sarah)' },
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
    { value: 'ara', label: 'Ara — warm, friendly female' },
    { value: 'rex', label: 'Rex — professional male' },
    { value: 'sal', label: 'Sal — neutral, balanced' },
    { value: 'eve', label: 'Eve — energetic female' },
    { value: 'leo', label: 'Leo — authoritative male' },
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
  const [agents, setAgents]   = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState<AgentForm>(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  function loadAgents() {
    api.get<{ agents: Agent[] }>('/agents')
      .then(r => setAgents(r?.agents ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadAgents(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/agents', {
        name: form.name,
        display_name: form.name,
        language: form.language,
        voice_provider: form.voice_provider,
        voice_id: form.voice_id,
        llm_provider: form.llm_provider,
        llm_model: form.llm_model,
        system_prompt: form.system_prompt,
        greeting_message: form.first_message,
      });
      setModal(false);
      setForm(EMPTY_FORM);
      loadAgents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(agent: Agent) {
    await api.patch(`/agents/${agent.id}`, { is_active: !agent.is_active });
    loadAgents();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0f172a]">AI Agents</h2>
          <p className="text-sm text-[#94a3b8] mt-0.5">Configure your AI phone agents</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="px-4 py-2.5 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-xl transition-all active:scale-[.98] shadow-lg shadow-[#6366f1]/25 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Agent
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#e2e8f0] p-5 animate-pulse space-y-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl" />
              <div className="h-4 bg-slate-100 rounded w-2/3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 bg-[#eef2ff] rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[#6366f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#475569]">No agents yet</p>
          <p className="text-xs text-[#94a3b8] mt-1 mb-4">Create your first AI phone agent</p>
          <button onClick={() => setModal(true)} className="px-4 py-2 bg-[#6366f1] text-white text-sm font-medium rounded-lg hover:bg-[#4f46e5] transition-colors">
            Create Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {agents.map(agent => (
            <div key={agent.id} className="bg-white rounded-xl border border-[#e2e8f0] p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-[#eef2ff] rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#6366f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <button
                  onClick={() => toggleActive(agent)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${agent.is_active ? 'bg-[#6366f1]' : 'bg-[#e2e8f0]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${agent.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <h3 className="font-semibold text-[#0f172a] text-sm">{agent.name}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#6366f1] font-medium">{(agent as any).llm_model ?? agent.llm_provider ?? 'anthropic'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#64748b] font-medium">{agent.voice_provider ?? 'elevenlabs'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#64748b] font-medium">{agent.language}</span>
              </div>
              <p className="text-[10px] text-[#94a3b8] mt-3">
                Created {new Date(agent.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e2e8f0]">
              <h2 className="text-base font-semibold text-[#0f172a]">New AI Agent</h2>
              <button onClick={() => setModal(false)} className="p-1.5 hover:bg-[#f1f5f9] rounded-lg">
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              {[
                { label: 'Agent Name', key: 'name', type: 'text', placeholder: 'Support Agent' },
              ].map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition-colors"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">LLM Provider</label>
                  <select
                    value={form.llm_provider}
                    onChange={e => {
                      const provider = e.target.value;
                      setForm(p => ({ ...p, llm_provider: provider, llm_model: DEFAULT_MODELS[provider] ?? '' }));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
                  >
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="xai">xAI (Grok)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">Voice Provider</label>
                  <select
                    value={form.voice_provider}
                    onChange={e => {
                      const vp = e.target.value;
                      setForm(p => ({ ...p, voice_provider: vp, voice_id: DEFAULT_VOICE[vp] ?? '' }));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
                  >
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="openai">OpenAI TTS</option>
                    <option value="xai">xAI Grok</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">Model</label>
                <select
                  value={form.llm_model}
                  onChange={e => setForm(p => ({ ...p, llm_model: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
                >
                  {(LLM_MODELS[form.llm_provider] ?? []).map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              {(VOICE_OPTIONS[form.voice_provider]?.length ?? 0) > 1 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">Voice</label>
                  <select
                    value={form.voice_id}
                    onChange={e => setForm(p => ({ ...p, voice_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
                  >
                    {(VOICE_OPTIONS[form.voice_provider] ?? []).map(v => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">System Prompt</label>
                <textarea
                  rows={3}
                  value={form.system_prompt}
                  onChange={e => setForm(p => ({ ...p, system_prompt: e.target.value }))}
                  placeholder="You are a helpful AI phone agent for..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] placeholder:text-[#94a3b8] resize-none focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">First Message</label>
                <input
                  type="text"
                  value={form.first_message}
                  onChange={e => setForm(p => ({ ...p, first_message: e.target.value }))}
                  placeholder="Hello! How can I help you today?"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition-colors"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="px-4 py-2.5 text-sm text-[#475569] hover:bg-[#f1f5f9] rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2.5 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-60">
                  {saving ? 'Creating...' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
