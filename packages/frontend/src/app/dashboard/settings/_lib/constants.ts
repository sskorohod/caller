import type { SectionId, AccentColor } from './types';
import { IconBuildingOffice, IconPalette, IconPuzzle, IconKey, IconOAuth, IconShield } from './icons';

export const SECTIONS: { id: SectionId; labelKey: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'general',    labelKey: 'settings.general',    icon: IconBuildingOffice },
  { id: 'appearance', labelKey: 'settings.appearance', icon: IconPalette },
  { id: 'providers',  labelKey: 'settings.providers',  icon: IconPuzzle },
  { id: 'api-keys',   labelKey: 'settings.apiKeys',   icon: IconKey },
  { id: 'oauth',      labelKey: 'settings.oauth',      icon: IconOAuth },
  { id: 'compliance', labelKey: 'settings.compliance', icon: IconShield },
];

export const TRANSLATOR_SECTIONS: SectionId[] = ['general', 'appearance', 'providers'];

export const PROVIDER_META: Record<string, { label: string; color: string; ownOnly?: boolean; fields: { key: string; label: string; placeholder: string; secret?: boolean }[] }> = {
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
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'sk-ant-api03-...', secret: true }],
  },
  openai: {
    label: 'OpenAI',
    color: 'bg-[#10a37f]/10 text-[#10a37f]',
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'sk-...', secret: true }],
  },
  deepgram: {
    label: 'Deepgram (STT)',
    color: 'bg-[#6366f1]/10 text-[#6366f1]',
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: true }],
  },
  elevenlabs: {
    label: 'ElevenLabs (TTS)',
    color: 'bg-[#8b5cf6]/10 text-[#8b5cf6]',
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: true }],
  },
  xai: {
    label: 'xAI (Grok Voice)',
    color: 'bg-[#ef4444]/10 text-[#ef4444]',
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'xai-...', secret: true }],
  },
  telegram: {
    label: 'Telegram Bot',
    color: 'bg-[#0088cc]/10 text-[#0088cc]',
    ownOnly: true,
    fields: [
      { key: 'bot_token', label: 'Bot Token', placeholder: '123456:ABC-DEF...', secret: true },
    ],
  },
};

export const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'UTC', label: 'UTC' },
];

export const ACCENT_COLORS: { id: AccentColor; label: string; value: string }[] = [
  { id: 'indigo',  label: 'Indigo',  value: '#6366f1' },
  { id: 'blue',    label: 'Blue',    value: '#3b82f6' },
  { id: 'emerald', label: 'Emerald', value: '#10b981' },
  { id: 'purple',  label: 'Purple',  value: '#8b5cf6' },
  { id: 'amber',   label: 'Amber',   value: '#f59e0b' },
];

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
