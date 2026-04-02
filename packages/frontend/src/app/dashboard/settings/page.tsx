'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Workspace {
  id: string;
  name: string;
  industry: string | null;
  timezone: string | null;
  conversation_owner_default: string;
  allow_inbound_external_handoff: boolean;
  call_recording_disclosure: boolean;
  ai_disclosure: boolean;
}

interface Provider {
  provider: string;
  is_verified: boolean;
  updated_at: string | null;
}

interface TwilioPhone {
  sid: string;
  phone_number: string;
  friendly_name: string;
  voice_enabled: boolean;
}

interface TelephonyConnection {
  id: string;
  phone_number: string;
  friendly_name: string | null;
  inbound_enabled: boolean;
  outbound_enabled: boolean;
  ai_answering_enabled: boolean;
  default_agent_profile_id: string | null;
  created_at: string;
}

interface SimpleAgent {
  id: string;
  name: string;
}

interface OAuthClient {
  id: string;
  name: string;
  client_id: string;
  redirect_uris: string[];
  created_at: string;
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'general',    labelKey: 'settings.general',    icon: IconBuildingOffice },
  { id: 'providers',  labelKey: 'settings.providers',  icon: IconPuzzle },
  { id: 'api-keys',   labelKey: 'settings.apiKeys',   icon: IconKey },
  { id: 'oauth',      labelKey: 'settings.oauth', icon: IconOAuth },
  { id: 'compliance', labelKey: 'settings.compliance', icon: IconShield },
  { id: 'team',       labelKey: 'settings.team',       icon: IconTeam },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

const PROVIDER_META: Record<string, { label: string; color: string; fields: { key: string; label: string; placeholder: string; secret?: boolean }[] }> = {
  twilio: {
    label: 'Twilio',
    color: 'bg-[#f22f46]/10 text-[#f22f46]',
    fields: [
      { key: 'account_sid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'auth_token',  label: 'Auth Token',  placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
    ],
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    color: 'bg-[#d97706]/10 text-[#d97706]',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'sk-ant-api03-...', secret: true },
    ],
  },
  openai: {
    label: 'OpenAI',
    color: 'bg-[#10a37f]/10 text-[#10a37f]',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'sk-...', secret: true },
    ],
  },
  deepgram: {
    label: 'Deepgram (STT)',
    color: 'bg-[#6366f1]/10 text-[#6366f1]',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
    ],
  },
  elevenlabs: {
    label: 'ElevenLabs (TTS)',
    color: 'bg-[#8b5cf6]/10 text-[#8b5cf6]',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
    ],
  },
  xai: {
    label: 'xAI (Grok Voice)',
    color: 'bg-[#ef4444]/10 text-[#ef4444]',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xai-...', secret: true },
    ],
  },
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────

function IconBuildingOffice({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
}
function IconPuzzle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
    </svg>
  );
}
function IconKey({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  );
}
function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}
function IconOAuth({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}
function IconTeam({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}
function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  );
}
function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}
function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

// ─── Input component ──────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, type = 'text', hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  const isSecret = type === 'password';
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">{label}</label>
      <div className="relative">
        <input
          type={isSecret && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a]
                     placeholder:text-[#cbd5e1] bg-white
                     focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]
                     transition-colors pr-10"
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569] transition-colors"
            aria-label={show ? 'Hide value' : 'Show value'}
          >
            {show ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-[#94a3b8]">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-[#6366f1]' : 'bg-[#e2e8f0]'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <span className="text-sm text-[#334155]">{label}</span>
    </label>
  );
}

function SaveBar({ saving, saved, error, onSave }: { saving: boolean; saved: boolean; error: string; onSave: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between mt-6 pt-5 border-t border-[#f1f5f9]">
      <span className="text-xs text-[#94a3b8]">
        {error ? <span className="text-red-500">{error}</span> : saved ? <span className="text-[#059669] flex items-center gap-1"><IconCheck className="w-3.5 h-3.5" />{t('settings.saved')}</span> : null}
      </span>
      <button
        onClick={onSave}
        disabled={saving}
        className="px-4 py-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-60 active:scale-[.98]"
      >
        {saving ? t('settings.saving') : t('settings.saveChanges')}
      </button>
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function GeneralSection({ workspace, onUpdated }: { workspace: Workspace | null; onUpdated: (w: Workspace) => void }) {
  const t = useT();
  const [name, setName]       = useState(workspace?.name ?? '');
  const [industry, setIndustry] = useState(workspace?.industry ?? '');
  const [timezone, setTimezone] = useState(workspace?.timezone ?? '');
  const [convOwner, setConvOwner] = useState(workspace?.conversation_owner_default ?? 'internal');
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setIndustry(workspace.industry ?? '');
      setTimezone(workspace.timezone ?? '');
      setConvOwner(workspace.conversation_owner_default ?? 'internal');
    }
  }, [workspace]);

  async function save() {
    setSaving(true); setError(''); setSaved(false);
    try {
      const updated = await api.patch<Workspace>('/workspaces/current', {
        name: name.trim(),
        industry: industry || undefined,
        timezone: timezone || undefined,
        conversation_owner_default: convOwner,
      });
      onUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <h3 className="text-sm font-semibold text-[#0f172a] mb-5">{t('settings.workspaceSettings')}</h3>
      <div className="space-y-4">
        <Field label={t('settings.workspaceName')} value={name} onChange={setName} placeholder="My Company" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">{t('settings.industry')}</label>
            <select
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
            >
              <option value="">{t('settings.selectIndustry')}</option>
              <option value="appliance_repair">Appliance Repair</option>
              <option value="hvac">HVAC</option>
              <option value="plumbing">Plumbing</option>
              <option value="real_estate">Real Estate</option>
              <option value="healthcare">Healthcare</option>
              <option value="legal">Legal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">{t('settings.timezone')}</label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
            >
              <option value="">{t('settings.selectTimezone')}</option>
              <option value="America/New_York">Eastern (ET)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Los_Angeles">Pacific (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Moscow">Moscow (MSK)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">{t('settings.defaultConversationOwner')}</label>
          <select
            value={convOwner}
            onChange={e => setConvOwner(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
          >
            <option value="internal">{t('settings.internalAgent')}</option>
            <option value="external">{t('settings.externalAgent')}</option>
          </select>
          <p className="text-xs text-[#94a3b8]">
            {t('settings.convOwnerHint')}
          </p>
        </div>
      </div>
      <SaveBar saving={saving} saved={saved} error={error} onSave={save} />
    </div>
  );
}

function ProviderCard({
  providerKey,
  existingProvider,
  onSaved,
}: {
  providerKey: string;
  existingProvider: Provider | undefined;
  onSaved: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const meta = PROVIDER_META[providerKey];
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(meta.fields.map(f => [f.key, '']))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    const filled = Object.values(fields).some(v => v.trim());
    if (!filled) { setError(t('settings.enterCredential')); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.put(`/auth/providers/${providerKey}`, { credentials: fields });
      setSaved(true);
      toast.success(t('toast.providerSaved'));
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    setDeleting(true);
    try {
      await api.delete(`/auth/providers/${providerKey}`);
      setConfirmDelete(false);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  const isConnected = !!existingProvider;

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${meta.color}`}>
            {meta.label.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-[#0f172a]">{meta.label}</div>
            {isConnected ? (
              <div className="flex items-center gap-1 text-xs text-[#059669]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                Connected · {fmtDate(existingProvider.updated_at)}
              </div>
            ) : (
              <div className="text-xs text-[#94a3b8]">{t('settings.notConfigured')}</div>
            )}
          </div>
        </div>
        {isConnected && (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <button onClick={handleDeleteConfirm} disabled={deleting} className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors">{deleting ? t('settings.removing') : t('settings.confirm')}</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-[#94a3b8] hover:text-[#475569] font-medium transition-colors">{t('common.cancel')}</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 hover:bg-red-50 rounded-lg text-[#94a3b8] hover:text-red-500 transition-colors"
              aria-label="Remove credentials"
            >
              <IconTrash className="w-4 h-4" />
            </button>
          )
        )}
      </div>

      <div className="space-y-3">
        {meta.fields.map(f => (
          <Field
            key={f.key}
            label={f.label}
            value={fields[f.key]}
            onChange={v => setFields(p => ({ ...p, [f.key]: v }))}
            placeholder={isConnected ? '••••••••••••••••' : f.placeholder}
            type={f.secret ? 'password' : 'text'}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#f1f5f9]">
        <span className="text-xs">
          {error ? <span className="text-red-500">{error}</span>
            : saved ? <span className="text-[#059669] flex items-center gap-1"><IconCheck className="w-3 h-3" />Saved</span>
            : null}
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3.5 py-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-60 active:scale-[.98]"
        >
          {saving ? t('settings.saving') : isConnected ? t('settings.update') : t('settings.saveConnect')}
        </button>
      </div>
    </div>
  );
}

function TwilioCard({
  existingProvider,
  onSaved,
}: {
  existingProvider: Provider | undefined;
  onSaved: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken]   = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [saved, setSaved]           = useState(false);

  const [phones, setPhones]               = useState<TwilioPhone[]>([]);
  const [connections, setConnections]     = useState<TelephonyConnection[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [activating, setActivating]       = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<TelephonyConnection | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [updatingConn, setUpdatingConn] = useState<string | null>(null);

  const isConnected = existingProvider?.is_verified === true;

  const loadPhones = useCallback(() => {
    setLoadingPhones(true);
    Promise.all([
      api.get<TwilioPhone[]>('/telephony/numbers').catch(() => []),
      api.get<TelephonyConnection[]>('/telephony/connections').catch(() => []),
    ]).then(([nums, conns]) => {
      setPhones(Array.isArray(nums) ? nums : []);
      setConnections(Array.isArray(conns) ? conns : []);
    }).finally(() => setLoadingPhones(false));
  }, []);

  useEffect(() => {
    if (isConnected) loadPhones();
  }, [isConnected, loadPhones]);

  async function handleSave() {
    if (!accountSid.trim() || !authToken.trim()) {
      setError('Enter Account SID and Auth Token');
      return;
    }
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await api.put<{
        is_verified: boolean;
        phone_numbers?: TwilioPhone[];
        verify_error?: string | null;
      }>('/auth/providers/twilio', {
        credentials: { account_sid: accountSid.trim(), auth_token: authToken.trim() },
      });

      if (res.verify_error) {
        setError(res.verify_error);
      } else {
        setSaved(true);
        toast.success(t('toast.providerSaved'));
        setAccountSid('');
        setAuthToken('');
        setPhones(res.phone_numbers ?? []);
        onSaved();
        // Load connections too
        api.get<TelephonyConnection[]>('/telephony/connections').then(c => setConnections(Array.isArray(c) ? c : []));
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(phone: TwilioPhone) {
    setActivating(phone.phone_number);
    try {
      await api.post('/telephony/connections', {
        phone_number: phone.phone_number,
        friendly_name: phone.friendly_name,
        twilio_sid: phone.sid,
        inbound_enabled: true,
        outbound_enabled: true,
      });
      loadPhones();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActivating(null);
    }
  }

  async function handleDeactivateConfirm() {
    if (!confirmDeactivate) return;
    try {
      await api.delete(`/telephony/connections/${confirmDeactivate.id}`);
      setConfirmDeactivate(null);
      loadPhones();
    } catch (e: any) {
      setError(e.message);
      setConfirmDeactivate(null);
    }
  }

  async function handleDisconnectConfirm() {
    try {
      await api.delete('/auth/providers/twilio');
      setPhones([]);
      setConnections([]);
      setConfirmDisconnect(false);
      onSaved();
    } catch (e: any) {
      setError(e.message);
      setConfirmDisconnect(false);
    }
  }

  const activeNumbers = new Set(connections.map(c => c.phone_number));

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 col-span-2 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold bg-[#f22f46]/10 text-[#f22f46]">
            TW
          </div>
          <div>
            <div className="text-sm font-semibold text-[#0f172a]">Twilio</div>
            {isConnected ? (
              <div className="flex items-center gap-1.5 text-xs text-[#059669]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                Connected · {phones.length} number{phones.length !== 1 ? 's' : ''} in account
              </div>
            ) : (
              <div className="text-xs text-[#94a3b8]">Not configured</div>
            )}
          </div>
        </div>
        {isConnected && (
          confirmDisconnect ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#94a3b8]">All connections will stop.</span>
              <button onClick={handleDisconnectConfirm} className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors">Confirm</button>
              <button onClick={() => setConfirmDisconnect(false)} className="text-xs text-[#94a3b8] hover:text-[#475569] font-medium transition-colors">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDisconnect(true)} className="text-xs text-[#94a3b8] hover:text-red-500 transition-colors font-medium">
              Disconnect
            </button>
          )
        )}
      </div>

      {/* Credentials form (always shown so user can update) */}
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Account SID"
          value={accountSid}
          onChange={setAccountSid}
          placeholder={isConnected ? '••••••••••••••••••••' : 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
        />
        <Field
          label="Auth Token"
          value={authToken}
          onChange={setAuthToken}
          placeholder={isConnected ? '••••••••••••••••' : 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
          type="password"
        />
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs">
          {error && <span className="text-red-500">{error}</span>}
          {saved && <span className="text-[#059669] flex items-center gap-1"><IconCheck className="w-3 h-3" />Connected successfully</span>}
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3.5 py-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-60 active:scale-[.98]"
        >
          {saving ? 'Connecting…' : isConnected ? 'Update Credentials' : 'Connect Twilio'}
        </button>
      </div>

      {/* Phone numbers list */}
      {isConnected && (
        <div className="mt-5 pt-5 border-t border-[#f1f5f9]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#475569] uppercase tracking-wide">
              Phone Numbers
            </p>
            <button onClick={loadPhones} className="text-xs text-[#6366f1] hover:text-[#4f46e5]">
              Refresh
            </button>
          </div>

          {loadingPhones ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-12 bg-[#f8fafc] rounded-xl animate-pulse" />)}
            </div>
          ) : phones.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-[#f8fafc] rounded-xl border border-dashed border-[#e2e8f0]">
              <svg className="w-5 h-5 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[#475569]">No phone numbers in this account</p>
                <p className="text-xs text-[#94a3b8]">Buy a number in the Twilio Console first</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {phones.map(phone => {
                const isActive = activeNumbers.has(phone.phone_number);
                const conn = connections.find(c => c.phone_number === phone.phone_number);
                return (
                  <div
                    key={phone.sid}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                      isActive
                        ? 'bg-[#f0fdf4] border-[#bbf7d0]'
                        : 'bg-[#f8fafc] border-[#e2e8f0] hover:border-[#c7d2fe]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isActive ? (
                        <div className="w-7 h-7 bg-[#dcfce7] rounded-full flex items-center justify-center shrink-0">
                          <IconCheck className="w-3.5 h-3.5 text-[#16a34a]" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 bg-[#f1f5f9] rounded-full flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372..." />
                          </svg>
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-[#0f172a]">{phone.phone_number}</div>
                        <div className="text-xs text-[#94a3b8]">{phone.friendly_name !== phone.phone_number ? phone.friendly_name : 'Voice enabled'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <>
                          <span className="text-xs text-[#16a34a] font-medium">Active</span>
                          {confirmDeactivate?.id === conn?.id ? (
                            <div className="flex items-center gap-2">
                              <button onClick={handleDeactivateConfirm} className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors">Confirm</button>
                              <button onClick={() => setConfirmDeactivate(null)} className="text-xs text-[#94a3b8] hover:text-[#475569] font-medium transition-colors">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => conn && setConfirmDeactivate(conn)}
                              className="text-xs text-[#94a3b8] hover:text-red-500 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => handleActivate(phone)}
                          disabled={activating === phone.phone_number}
                          className="px-3 py-1.5 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                        >
                          {activating === phone.phone_number ? '…' : 'Use this number'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProvidersSection() {
  const t = useT();
  const [providers, setProviders] = useState<Provider[]>([]);

  const load = useCallback(() => {
    api.get<Provider[]>('/auth/providers').then(setProviders).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const providerMap = Object.fromEntries(providers.map(p => [p.provider, p]));
  const otherProviders = Object.keys(PROVIDER_META).filter(k => k !== 'twilio');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[#0f172a]">{t('settings.providerCredentials')}</h3>
        <p className="text-xs text-[#94a3b8] mt-1">
          {t('settings.providerCredentials')}
        </p>
      </div>

      {/* Twilio — full width card with phone number picker */}
      <TwilioCard existingProvider={providerMap['twilio']} onSaved={load} />

      {/* Other AI providers — 2-column grid */}
      <div className="grid grid-cols-2 gap-4">
        {otherProviders.map(key => (
          <ProviderCard
            key={key}
            providerKey={key}
            existingProvider={providerMap[key]}
            onSaved={load}
          />
        ))}
      </div>
    </div>
  );
}

function ApiKeysSection() {
  const t = useT();
  const [keys, setKeys]     = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(false);
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey]   = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied]   = useState(false);
  const [error, setError]     = useState('');
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

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
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a]">MCP API Keys</h3>
          <p className="text-xs text-[#94a3b8] mt-1">
            Allow external AI agents (Claude, ChatGPT) to make calls on behalf of your workspace.
          </p>
        </div>
        <button
          onClick={() => { setModal(true); setNewKey(null); }}
          className="shrink-0 px-3.5 py-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold rounded-lg transition-all active:scale-[.98] flex items-center gap-1.5 shadow-sm shadow-[#6366f1]/30"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('settings.createApiKey')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-12 bg-[#f8fafc] rounded-lg" />)}
          </div>
        ) : activeKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <div className="w-11 h-11 bg-[#f1f5f9] rounded-xl flex items-center justify-center mb-3">
              <IconKey className="w-5 h-5 text-[#94a3b8]" />
            </div>
            <p className="text-sm font-medium text-[#475569]">{t('settings.noApiKeys')}</p>
            <p className="text-xs text-[#94a3b8] mt-1">{t('settings.noApiKeys')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              <tr>
                {['Name', 'Prefix', 'Last Used', 'Created', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {activeKeys.map(k => (
                <tr key={k.id} className="hover:bg-[#fafbfc] transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-[#0f172a]">{k.name}</td>
                  <td className="px-5 py-3.5">
                    <code className="text-xs bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded-md font-mono">{k.key_prefix}…</code>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[#94a3b8]">
                    {k.last_used_at ? fmtDate(k.last_used_at) : t('settings.never')}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[#94a3b8]">{fmtDate(k.created_at)}</td>
                  <td className="px-5 py-3.5">
                    {revokeTarget?.id === k.id ? (
                      <div className="flex items-center gap-2">
                        <button onClick={revokeKeyConfirm} className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors">{t('settings.confirm')}</button>
                        <button onClick={() => setRevokeTarget(null)} className="text-xs text-[#94a3b8] hover:text-[#475569] font-medium transition-colors">{t('common.cancel')}</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRevokeTarget({ id: k.id, name: k.name })}
                        className="text-xs text-[#94a3b8] hover:text-red-500 transition-colors font-medium"
                      >
                        {t('settings.revoke')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {revokedKeys.length > 0 && (
          <div className="border-t border-[#f1f5f9] px-5 py-3">
            <p className="text-xs text-[#94a3b8]">{revokedKeys.length} revoked key{revokedKeys.length > 1 ? 's' : ''} hidden</p>
          </div>
        )}
      </div>

      {/* Usage tip */}
      <div className="bg-[#fafbff] border border-[#e0e7ff] rounded-xl p-4">
        <p className="text-xs font-semibold text-[#4338ca] mb-2">Using with Claude Desktop</p>
        <pre className="text-xs text-[#475569] bg-white border border-[#e2e8f0] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{`{
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setModal(false); setNewKey(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e2e8f0]">
              <h2 className="text-base font-semibold text-[#0f172a]">{t('settings.createApiKey')}</h2>
              <button onClick={() => { setModal(false); setNewKey(null); }} className="p-1.5 hover:bg-[#f1f5f9] rounded-lg" aria-label="Close">
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {newKey ? (
              <div className="px-6 py-6 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl">
                  <div className="w-8 h-8 bg-[#dcfce7] rounded-lg flex items-center justify-center shrink-0">
                    <IconCheck className="w-4 h-4 text-[#16a34a]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#15803d]">Key created: {newKey.name}</p>
                    <p className="text-xs text-[#16a34a] mt-0.5">Copy it now — it won't be shown again.</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">Your API Key</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-xs font-mono text-[#0f172a] break-all select-all">
                      {newKey.key}
                    </code>
                    <button
                      onClick={() => copyKey(newKey.key)}
                      className="shrink-0 p-2.5 border border-[#e2e8f0] hover:bg-[#f1f5f9] rounded-lg transition-colors"
                      aria-label="Copy API key"
                    >
                      {copied ? <IconCheck className="w-4 h-4 text-[#059669]" /> : <IconCopy className="w-4 h-4 text-[#94a3b8]" />}
                    </button>
                  </div>
                </div>
                <button onClick={() => { setModal(false); setNewKey(null); }} className="w-full py-2.5 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-lg transition-all">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">{t('settings.keyName')}</label>
                  <input
                    autoFocus
                    type="text"
                    value={keyName}
                    onChange={e => setKeyName(e.target.value)}
                    placeholder={t('settings.keyNamePlaceholder')}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition-colors"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={() => setModal(false)} className="px-4 py-2.5 text-sm text-[#475569] hover:bg-[#f1f5f9] rounded-lg transition-colors">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={creating || !keyName.trim()} className="px-4 py-2.5 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-60">
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

function OAuthAppsSection() {
  const t = useT();
  const [clients, setClients]   = useState<OAuthClient[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [name, setName]         = useState('');
  const [uris, setUris]         = useState('');
  const [creating, setCreating] = useState(false);
  const [newClient, setNewClient] = useState<{ client_id: string; client_secret: string; name: string } | null>(null);
  const [copiedId, setCopiedId]   = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [createError, setCreateError]   = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => {
    api.get<OAuthClient[]>('/oauth/clients').then(setClients).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const redirect_uris = uris.split('\n').map(s => s.trim()).filter(Boolean);
    if (!redirect_uris.length) { setCreateError('Enter at least one redirect URI'); return; }
    setCreating(true); setCreateError('');
    try {
      const res = await api.post<{ id: string; name: string; client_id: string; client_secret: string; redirect_uris: string[]; created_at: string }>(
        '/oauth/clients', { name: name.trim(), redirect_uris }
      );
      setNewClient({ client_id: res.client_id, client_secret: res.client_secret, name: res.name });
      setName(''); setUris('');
      load();
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function deleteClientConfirm() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/oauth/clients/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      setCreateError(e.message);
      setDeleteTarget(null);
    }
  }

  function copy(text: string, setFlag: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setFlag(true);
    setTimeout(() => setFlag(false), 2000);
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://caller.yourdomain.com';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a]">OAuth 2.0 Applications</h3>
          <p className="text-xs text-[#94a3b8] mt-1">
            Register apps (ChatGPT GPT Actions, custom integrations) to connect via OAuth.
          </p>
        </div>
        <button
          onClick={() => { setModal(true); setNewClient(null); }}
          className="shrink-0 px-3.5 py-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold rounded-lg transition-all active:scale-[.98] flex items-center gap-1.5 shadow-sm shadow-[#6366f1]/30"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('settings.createOAuth')}
        </button>
      </div>

      {/* Endpoints reference */}
      <div className="bg-[#fafbff] border border-[#e0e7ff] rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-[#4338ca]">OAuth 2.0 Endpoints (for ChatGPT GPT Actions)</p>
        {[
          { label: 'Authorization URL', value: `${origin}/oauth/authorize` },
          { label: 'Token URL', value: `${origin}/api/oauth/token` },
          { label: 'Scope', value: '(leave empty)' },
        ].map(row => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="text-[11px] text-[#6366f1] font-medium w-36 shrink-0">{row.label}</span>
            <code className="text-xs text-[#334155] font-mono bg-white border border-[#e2e8f0] px-2 py-0.5 rounded">{row.value}</code>
          </div>
        ))}
      </div>

      {/* Clients table */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-12 bg-[#f8fafc] rounded-lg" />)}
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <div className="w-11 h-11 bg-[#f1f5f9] rounded-xl flex items-center justify-center mb-3">
              <IconOAuth className="w-5 h-5 text-[#94a3b8]" />
            </div>
            <p className="text-sm font-medium text-[#475569]">{t('settings.noOAuthApps')}</p>
            <p className="text-xs text-[#94a3b8] mt-1">{t('settings.noOAuthApps')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              <tr>
                {['App Name', 'Client ID', 'Redirect URIs', 'Created', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {clients.map(c => (
                <tr key={c.id} className="hover:bg-[#fafbfc] transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-[#0f172a]">{c.name}</td>
                  <td className="px-5 py-3.5">
                    <code className="text-xs bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded-md font-mono">{c.client_id}</code>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#64748b] max-w-[200px]">
                    {c.redirect_uris.map(u => <div key={u} className="truncate">{u}</div>)}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[#94a3b8]">{fmtDate(c.created_at)}</td>
                  <td className="px-5 py-3.5">
                    {deleteTarget?.id === c.id ? (
                      <div className="flex items-center gap-2">
                        <button onClick={deleteClientConfirm} className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors">{t('settings.confirm')}</button>
                        <button onClick={() => setDeleteTarget(null)} className="text-xs text-[#94a3b8] hover:text-[#475569] font-medium transition-colors">{t('common.cancel')}</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                        className="text-xs text-[#94a3b8] hover:text-red-500 transition-colors font-medium"
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Register modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setModal(false); setNewClient(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e2e8f0]">
              <h2 className="text-base font-semibold text-[#0f172a]">
                {newClient ? t('settings.createOAuth') : t('settings.newOAuthApp')}
              </h2>
              <button onClick={() => { setModal(false); setNewClient(null); }} className="p-1.5 hover:bg-[#f1f5f9] rounded-lg" aria-label="Close">
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {newClient ? (
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-start gap-3 p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl">
                  <IconCheck className="w-4 h-4 text-[#16a34a] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[#15803d]">{newClient.name} registered</p>
                    <p className="text-xs text-[#16a34a] mt-0.5">Save the client secret — it won't be shown again.</p>
                  </div>
                </div>
                {[
                  { label: 'Client ID', value: newClient.client_id, copied: copiedId, onCopy: () => copy(newClient.client_id, setCopiedId) },
                  { label: 'Client Secret', value: newClient.client_secret, copied: copiedSecret, onCopy: () => copy(newClient.client_secret, setCopiedSecret) },
                ].map(row => (
                  <div key={row.label} className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">{row.label}</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-xs font-mono text-[#0f172a] break-all select-all">
                        {row.value}
                      </code>
                      <button onClick={row.onCopy} className="shrink-0 p-2.5 border border-[#e2e8f0] hover:bg-[#f1f5f9] rounded-lg transition-colors" aria-label={`Copy ${row.label}`}>
                        {row.copied ? <IconCheck className="w-4 h-4 text-[#059669]" /> : <IconCopy className="w-4 h-4 text-[#94a3b8]" />}
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={() => { setModal(false); setNewClient(null); }} className="w-full py-2.5 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-lg transition-all mt-2">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">{t('settings.appName')}</label>
                  <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('settings.appNamePlaceholder')}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">{t('settings.redirectUris')}</label>
                  <textarea
                    rows={3}
                    value={uris}
                    onChange={e => setUris(e.target.value)}
                    placeholder={'https://chat.openai.com/aip/oauth/callback\nhttps://...'}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] placeholder:text-[#94a3b8] resize-none focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] font-mono"
                  />
                  <p className="text-xs text-[#94a3b8]">One URL per line. For ChatGPT: <code className="font-mono">https://chat.openai.com/aip/oauth/callback</code></p>
                </div>
                {createError && <p className="text-sm text-red-500">{createError}</p>}
                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={() => setModal(false)} className="px-4 py-2.5 text-sm text-[#475569] hover:bg-[#f1f5f9] rounded-lg">{t('common.cancel')}</button>
                  <button type="submit" disabled={creating || !name.trim()} className="px-4 py-2.5 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-lg disabled:opacity-60">
                    {creating ? t('settings.creating') : t('settings.createOAuth')}
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

function ComplianceSection({ workspace, onUpdated }: { workspace: Workspace | null; onUpdated: (w: Workspace) => void }) {
  const t = useT();
  const [recording, setRecording] = useState(workspace?.call_recording_disclosure ?? true);
  const [aiDisclosure, setAiDisclosure] = useState(workspace?.ai_disclosure ?? true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (workspace) {
      setRecording(workspace.call_recording_disclosure ?? true);
      setAiDisclosure(workspace.ai_disclosure ?? true);
    }
  }, [workspace]);

  async function save() {
    setSaving(true); setError(''); setSaved(false);
    try {
      const updated = await api.patch<Workspace>('/workspaces/current', {
        call_recording_disclosure: recording,
        ai_disclosure: aiDisclosure,
      });
      onUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[#0f172a]">{t('settings.complianceSettings')}</h3>
        <p className="text-xs text-[#94a3b8] mt-1">
          Configure required disclosures for call recording and AI identity laws.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-[0_1px_3px_rgba(0,0,0,.04)] space-y-5">
        <div className="flex items-start gap-4">
          <button
            type="button"
            role="switch"
            aria-checked={recording}
            aria-label="Toggle call recording disclosure"
            onClick={() => setRecording(v => !v)}
            className={`mt-0.5 relative w-10 h-5 rounded-full transition-colors shrink-0 ${recording ? 'bg-[#6366f1]' : 'bg-[#e2e8f0]'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${recording ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <div>
            <div className="text-sm font-medium text-[#0f172a]">{t('settings.callRecordingDisclosure')}</div>
            <div className="text-xs text-[#94a3b8] mt-0.5">
              {t('settings.callRecordingHint')}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <button
            type="button"
            role="switch"
            aria-checked={aiDisclosure}
            aria-label="Toggle AI identity disclosure"
            onClick={() => setAiDisclosure(v => !v)}
            className={`mt-0.5 relative w-10 h-5 rounded-full transition-colors shrink-0 ${aiDisclosure ? 'bg-[#6366f1]' : 'bg-[#e2e8f0]'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${aiDisclosure ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <div>
            <div className="text-sm font-medium text-[#0f172a]">{t('settings.aiDisclosure')}</div>
            <div className="text-xs text-[#94a3b8] mt-0.5">
              {t('settings.aiDisclosureHint')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-[#fffbeb] border border-[#fde68a] rounded-lg">
          <svg className="w-4 h-4 text-[#d97706] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-[#92400e]">
            We recommend keeping both disclosures enabled. Disabling them may expose you to legal liability depending on your jurisdiction.
          </p>
        </div>

        <SaveBar saving={saving} saved={saved} error={error} onSave={save} />
      </div>
    </div>
  );
}

// ─── Team Section ────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  created_at: string;
  email?: string;
}

function TeamSection() {
  const t = useT();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('operator');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);

  const load = useCallback(() => {
    api.get<TeamMember[]>('/workspaces/members')
      .then(data => setMembers(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post('/workspaces/members/invite', {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail('');
      setInviteRole('operator');
      setModal(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function handleRemoveConfirm() {
    if (!removeTarget) return;
    try {
      await api.delete(`/workspaces/members/${removeTarget.id}`);
      setRemoveTarget(null);
      load();
    } catch (e: any) {
      setError(e.message);
      setRemoveTarget(null);
    }
  }

  function roleBadge(role: string) {
    const map: Record<string, string> = {
      owner: 'bg-[#fef3c7] text-[#92400e]',
      admin: 'bg-[#eef2ff] text-[#6366f1]',
      operator: 'bg-[#f0fdf4] text-[#16a34a]',
      analyst: 'bg-[#f1f5f9] text-[#475569]',
    };
    return map[role] ?? 'bg-[#f1f5f9] text-[#475569]';
  }

  function roleLabel(role: string) {
    const key = `team.${role}` as string;
    return t(key);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a]">{t('team.title')}</h3>
          <p className="text-xs text-[#94a3b8] mt-1">{t('team.subtitle')}</p>
        </div>
        <button
          onClick={() => { setModal(true); setError(''); }}
          className="shrink-0 px-3.5 py-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold rounded-lg transition-all active:scale-[.98] flex items-center gap-1.5 shadow-sm shadow-[#6366f1]/30"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('team.inviteMember')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        {loading ? (
          <div className="p-5 space-y-3 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-[#f8fafc] rounded-lg" />)}
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <div className="w-11 h-11 bg-[#f1f5f9] rounded-xl flex items-center justify-center mb-3">
              <IconTeam className="w-5 h-5 text-[#94a3b8]" />
            </div>
            <p className="text-sm font-medium text-[#475569]">{t('team.noMembers')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              <tr>
                {[t('team.email'), t('team.role'), t('team.joined'), t('team.actions')].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-[#fafbfc] transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-[#0f172a]">{m.email ?? m.user_id}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex text-xs px-2.5 py-0.5 rounded-full font-medium ${roleBadge(m.role)}`}>
                      {roleLabel(m.role)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[#94a3b8]">{fmtDate(m.created_at)}</td>
                  <td className="px-5 py-3.5">
                    {m.role !== 'owner' && (
                      removeTarget?.id === m.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={handleRemoveConfirm} className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors">{t('settings.confirm')}</button>
                          <button onClick={() => setRemoveTarget(null)} className="text-xs text-[#94a3b8] hover:text-[#475569] font-medium transition-colors">{t('common.cancel')}</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRemoveTarget(m)}
                          className="text-xs text-[#94a3b8] hover:text-red-500 transition-colors font-medium"
                        >
                          {t('team.removeMember')}
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e2e8f0]">
              <h2 className="text-base font-semibold text-[#0f172a]">{t('team.inviteModal')}</h2>
              <button onClick={() => setModal(false)} className="p-1.5 hover:bg-[#f1f5f9] rounded-lg" aria-label="Close">
                <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleInvite} className="px-6 py-5 space-y-4">
              <p className="text-xs text-[#94a3b8]">{t('team.inviteDesc')}</p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">{t('team.email')}</label>
                <input
                  autoFocus
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569] uppercase tracking-wide">{t('team.role')}</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] text-sm text-[#0f172a] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20 focus:border-[#6366f1]"
                >
                  <option value="admin">{t('team.admin')}</option>
                  <option value="operator">{t('team.operator')}</option>
                  <option value="analyst">{t('team.analyst')}</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setModal(false)} className="px-4 py-2.5 text-sm text-[#475569] hover:bg-[#f1f5f9] rounded-lg transition-colors">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={sending || !inviteEmail.trim()} className="px-4 py-2.5 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-60">
                  {sending ? t('team.sending') : t('team.inviteMember')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { setWorkspace } = useAuth();
  const t = useT();
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const [workspace, setWorkspaceLocal] = useState<Workspace | null>(null);

  useEffect(() => {
    api.get<Workspace>('/workspaces/current').then(setWorkspaceLocal).catch(() => {});
  }, []);

  function handleWorkspaceUpdate(updated: Workspace) {
    setWorkspaceLocal(updated);
    setWorkspace({ id: updated.id, name: updated.name });
  }

  return (
    <div className="flex flex-col md:flex-row gap-5 md:gap-7 min-h-full">
      {/* Left nav (vertical on desktop, horizontal scroll on mobile) */}
      <div className="md:w-52 shrink-0">
        <nav className="md:space-y-0.5 md:sticky md:top-0 flex md:flex-col overflow-x-auto md:overflow-x-visible gap-1 md:gap-0 pb-2 md:pb-0">
          <p className="hidden md:block text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest px-3 mb-2">{t('settings.title')}</p>
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-2 md:gap-3 px-3 py-2 md:py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors shrink-0 md:w-full md:text-left ${
                  active
                    ? 'bg-[#eef2ff] text-[#6366f1] font-medium'
                    : 'text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {t(s.labelKey)}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-8">
        {activeSection === 'general'    && <GeneralSection workspace={workspace} onUpdated={handleWorkspaceUpdate} />}
        {activeSection === 'providers'  && <ProvidersSection />}
        {activeSection === 'api-keys'   && <ApiKeysSection />}
        {activeSection === 'oauth'      && <OAuthAppsSection />}
        {activeSection === 'compliance' && <ComplianceSection workspace={workspace} onUpdated={handleWorkspaceUpdate} />}
        {activeSection === 'team'       && <TeamSection />}
      </div>
    </div>
  );
}
