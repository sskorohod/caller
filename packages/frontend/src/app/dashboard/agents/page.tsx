'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';

interface Agent {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  avatar_url: string | null;
  voice_provider: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  voice_id: string | null;
  language: string;
  is_active: boolean;
  created_at: string;
}

interface AgentWithPacks extends Agent {
  skill_packs?: { id: string; name: string }[];
}

// ─── Avatar Helpers ─────────────────────────────────────────────────────────

function hashToHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

function AvatarCircle({ src, name, id, size = 56 }: { src: string | null; name: string; id: string; size?: number }) {
  const initials = (name || '??').slice(0, 2).toUpperCase();
  const hue = hashToHue(id);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: `hsl(${hue}, 60%, 55%)`, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

// ─── Model Display Names ────────────────────────────────────────────────────

const MODEL_NAMES: Record<string, string> = {
  'claude-sonnet-4-5-20250514': 'Claude Sonnet 4.5',
  'claude-opus-4-5-20250514': 'Claude Opus 4.5',
  'claude-haiku-3-5': 'Claude Haiku 3.5',
  'gpt-4.1': 'GPT-4.1',
  'gpt-4.1-mini': 'GPT-4.1 Mini',
  'gpt-4.1-nano': 'GPT-4.1 Nano',
  'o3': 'o3',
  'o4-mini': 'o4-mini',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'grok-3': 'Grok 3',
  'grok-3-mini': 'Grok 3 Mini',
  'grok-3-mini-fast': 'Grok 3 Mini Fast',
};

const PROVIDER_LABELS: Record<string, string> = {
  elevenlabs: 'ElevenLabs',
  openai: 'OpenAI TTS',
  xai: 'xAI Voice',
};

const LANG_LABELS: Record<string, string> = {
  auto: 'Auto',
  en: 'English',
  ru: 'Russian',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
};

// ─── Page Component ─────────────────────────────────────────────────────────

export default function AgentsPage() {
  const t = useT();
  const toast = useToast();
  const [agents, setAgents] = useState<AgentWithPacks[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleteError, setDeleteError] = useState('');

  function loadAgents() {
    setLoadError('');
    api.get<{ agents: Agent[] }>('/agents')
      .then(async (r) => {
        const list = (r?.agents ?? []).filter(Boolean);
        // Load skill packs for each agent in parallel
        const withPacks = await Promise.all(list.map(async (a) => {
          try {
            const detail = await api.get<AgentWithPacks>(`/agents/${a.id}`);
            return { ...a, avatar_url: detail.avatar_url ?? a.avatar_url, skill_packs: detail.skill_packs ?? [] };
          } catch {
            return { ...a, skill_packs: [] };
          }
        }));
        setAgents(withPacks);
      })
      .catch((err: any) => setLoadError(err?.message ?? 'Failed to load agents'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadAgents(); }, []);

  async function toggleActive(agent: Agent) {
    await api.patch(`/agents/${agent.id}`, { is_active: !agent.is_active });
    loadAgents();
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
        <Link
          href="/dashboard/agents/new"
          className="px-4 py-2.5 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-sm font-semibold rounded-xl transition-all active:scale-[.98] flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('agents.newAgent')}
        </Link>
      </div>

      {loadError ? (
        <div className="bg-[var(--th-error-bg)] border border-[var(--th-card-border-subtle)] rounded-2xl p-6 text-center shadow-[0_1px_3px_var(--th-shadow)]">
          <p className="text-sm font-semibold text-[var(--th-error-text)]">{loadError}</p>
          <button onClick={loadAgents} className="mt-3 px-4 py-2 text-sm font-semibold text-[var(--th-error-text)] hover:bg-[var(--th-surface)] rounded-xl transition-all">{t('common.retry')}</button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-6 animate-pulse space-y-4 shadow-[0_1px_3px_var(--th-shadow)]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[var(--th-skeleton)] rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-[var(--th-skeleton)] rounded-lg w-1/3" />
                  <div className="h-3 bg-[var(--th-skeleton)] rounded-lg w-1/4" />
                </div>
              </div>
              <div className="h-3 bg-[var(--th-skeleton)] rounded-lg w-2/3" />
              <div className="flex gap-2">
                <div className="h-5 bg-[var(--th-skeleton)] rounded-full w-16" />
                <div className="h-5 bg-[var(--th-skeleton)] rounded-full w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] flex flex-col items-center justify-center py-20 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
          <div className="w-14 h-14 bg-[var(--th-primary-bg)] rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--th-primary-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--th-text-secondary)]">{t('agents.noAgents')}</p>
          <p className="text-xs text-[var(--th-text-muted)] mt-1 mb-4">{t('agents.noAgentsDesc')}</p>
          <Link href="/dashboard/agents/new" className="px-4 py-2 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white text-sm font-semibold rounded-xl hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all">
            {t('agents.createAgent')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {agents.map(agent => (
            <div key={agent.id} className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-6 hover:border-[var(--th-border)] hover:shadow-[0_4px_16px_var(--th-card-glow)] transition-all group shadow-[0_1px_3px_var(--th-shadow)] relative overflow-hidden">
              {/* Active indicator bar */}
              {agent.is_active && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-400 to-emerald-500" />}

              {/* Header: Avatar + Name + Toggle */}
              <div className="flex items-start gap-4 mb-3">
                <AvatarCircle src={agent.avatar_url} name={agent.display_name || agent.name} id={agent.id} size={56} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--th-text)] text-base truncate group-hover:text-[var(--th-primary-text)] transition-colors">{agent.display_name || agent.name}</h3>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${agent.is_active ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' : 'bg-[var(--th-text-muted)]'}`} />
                  </div>
                  <p className="text-xs text-[var(--th-text-muted)]">@{agent.name}</p>
                </div>
                <button
                  onClick={() => toggleActive(agent)}
                  className={`relative w-10 h-6 rounded-full transition-all shrink-0 ${agent.is_active ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'}`}
                  aria-label={agent.is_active ? 'Disable' : 'Enable'}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${agent.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Description */}
              {agent.description && (
                <p className="text-sm text-[var(--th-text-secondary)] line-clamp-2 mb-3 leading-relaxed">{agent.description}</p>
              )}

              {/* Skills */}
              {(agent.skill_packs?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {agent.skill_packs!.slice(0, 5).map(sp => (
                    <span key={sp.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--th-warning-bg)] text-[var(--th-warning-text)] font-semibold">
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                      </svg>
                      {sp.name}
                    </span>
                  ))}
                  {(agent.skill_packs?.length ?? 0) > 5 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--th-surface)] text-[var(--th-text-muted)] font-semibold">
                      +{agent.skill_packs!.length - 5}
                    </span>
                  )}
                </div>
              )}

              {/* Provider info */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--th-text-muted)] mb-4">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  {MODEL_NAMES[agent.llm_model ?? ''] ?? agent.llm_model ?? 'Claude'}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  {PROVIDER_LABELS[agent.voice_provider ?? ''] ?? agent.voice_provider ?? 'ElevenLabs'}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
                  </svg>
                  {LANG_LABELS[agent.language] ?? agent.language}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--th-card-border-subtle)]">
                <Link
                  href={`/dashboard/agents/${agent.id}/edit`}
                  className="text-sm font-semibold text-[var(--th-primary-text)] hover:text-[var(--th-primary-hover)] transition-colors flex items-center gap-1"
                >
                  {t('common.edit')}
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
                <button
                  onClick={() => { setDeleteTarget(agent); setDeleteError(''); }}
                  className="p-1.5 rounded-lg hover:bg-[var(--th-error-bg)] text-[var(--th-text-muted)] hover:text-[var(--th-error-text)] transition-all opacity-0 group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-[var(--th-card)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-[var(--th-card-border-subtle)] w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 space-y-4">
              <div className="w-11 h-11 bg-[var(--th-error-bg)] rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--th-error-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--th-text)]">{t('agents.deleteAgent')}</h3>
                <p className="text-sm text-[var(--th-text-secondary)] mt-1">{t('agents.deleteConfirm')}</p>
              </div>
              {deleteError && <p className="text-sm text-[var(--th-error-text)]">{deleteError}</p>}
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-xl transition-all">{t('common.cancel')}</button>
                <button onClick={handleDeleteConfirm} className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold rounded-xl hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)] transition-all">{t('common.delete')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
