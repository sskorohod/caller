// ─── Admin Panel Constants ──────────────────────────────────────────────

export const PLAN_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  translator: { bg: 'var(--th-primary-bg)', color: 'var(--th-primary-text)', label: 'Translator' },
  agents: { bg: 'var(--th-success-bg)', color: 'var(--th-success-text)', label: 'Agents' },
  agents_mcp: { bg: 'var(--th-info-bg)', color: 'var(--th-info-text)', label: 'Agents + MCP' },
};

export const PLANS = ['translator', 'agents', 'agents_mcp'] as const;

export const TICKET_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  open: { bg: 'var(--th-primary-bg)', color: 'var(--th-primary-text)' },
  replied: { bg: 'var(--th-success-bg)', color: 'var(--th-success-text)' },
  closed: { bg: 'var(--th-surface)', color: 'var(--th-text-muted)' },
};

export const CONTACT_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  new: { bg: 'var(--th-primary-bg)', color: 'var(--th-primary-text)' },
  read: { bg: 'var(--th-success-bg)', color: 'var(--th-success-text)' },
  archived: { bg: 'var(--th-surface)', color: 'var(--th-text-muted)' },
};

export const SUBSCRIPTION_STATUS_STYLES: Record<string, { color: string; label: string }> = {
  active: { color: 'var(--th-success-text)', label: 'Active' },
  canceled: { color: 'var(--th-warning-text)', label: 'Canceled' },
  past_due: { color: 'var(--th-error-text)', label: 'Past Due' },
};

export const ACTION_COLORS: Record<string, string> = {
  create: 'var(--th-success-text)',
  update: 'var(--th-primary-text)',
  delete: 'var(--th-error-text)',
  login: 'var(--th-info-text)',
  setting: 'var(--th-warning-text)',
};

export const FINANCE_TYPE_COLORS: Record<string, string> = {
  topup: 'var(--th-success-text)',
  usage: 'var(--th-primary-text)',
  gift: 'var(--th-info-text)',
  refund: 'var(--th-warning-text)',
  subscription: 'var(--th-text-muted)',
};

export const PROVIDER_LIST = [
  { name: 'twilio', icon: 'call', description: 'Telephony & SMS', keys: ['account_sid', 'auth_token'] },
  { name: 'deepgram', icon: 'mic', description: 'Speech-to-Text', keys: ['api_key'] },
  { name: 'openai', icon: 'psychology', description: 'LLM & TTS', keys: ['api_key'] },
  { name: 'anthropic', icon: 'smart_toy', description: 'Claude LLM', keys: ['api_key'] },
  { name: 'elevenlabs', icon: 'record_voice_over', description: 'Voice Synthesis', keys: ['api_key'] },
  { name: 'xai', icon: 'auto_awesome', description: 'Grok LLM & TTS', keys: ['api_key'] },
];
