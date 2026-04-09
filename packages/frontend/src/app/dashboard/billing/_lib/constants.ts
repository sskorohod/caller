export const LOW_BALANCE_WARNING = 5;
export const LOW_BALANCE_CRITICAL = 1;

export const DEPOSIT_PRESETS = [10, 25, 50, 100, 250];

export const PLAN_GRADIENTS: Record<string, string> = {
  translator: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.03))',
  agents: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.03))',
  agents_mcp: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(99,102,241,0.03))',
};

export const PLAN_ACCENTS: Record<string, string> = {
  translator: '#10b981',
  agents: '#3b82f6',
  agents_mcp: '#8b5cf6',
};

export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  translator: 'Translator',
  agents: 'Agents',
  agents_mcp: 'Agents + MCP',
};

export const PLAN_PRICES: Record<string, number> = {
  translator: 0,
  agents: 49,
  agents_mcp: 99,
};

export const PLAN_FEATURES: Record<string, { key: string; included: boolean }[]> = {
  translator: [
    { key: 'liveTranslator', included: true },
    { key: 'payAsYouGo', included: true },
    { key: 'signupCredit', included: true },
    { key: 'aiAgents', included: false },
    { key: 'mcpAccess', included: false },
  ],
  agents: [
    { key: 'liveTranslator', included: true },
    { key: 'aiAgents', included: true },
    { key: 'agentProfiles10', included: true },
    { key: 'phoneNumbers5', included: true },
    { key: 'callRecording', included: true },
    { key: 'bringOwnKeys', included: true },
    { key: 'mcpAccess', included: false },
  ],
  agents_mcp: [
    { key: 'liveTranslator', included: true },
    { key: 'aiAgents', included: true },
    { key: 'unlimitedAgents', included: true },
    { key: 'unlimitedPhones', included: true },
    { key: 'mcpAccess', included: true },
    { key: 'oauthIntegration', included: true },
    { key: 'prioritySupport', included: true },
  ],
};

export const TX_TYPE_COLORS: Record<string, string> = {
  topup: 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]',
  usage: 'bg-[var(--th-info-bg)] text-[var(--th-info-text)]',
  refund: 'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]',
  gift: 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]',
  signup_bonus: 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]',
  promo: 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]',
  subscription: 'bg-[var(--th-surface)] text-[var(--th-text-muted)]',
};

export const USAGE_CATEGORIES = [
  { key: 'llm', gradient: 'linear-gradient(90deg, #6366f1, #818cf8)', dot: '#818cf8' },
  { key: 'tts', gradient: 'linear-gradient(90deg, #22c55e, #4ade80)', dot: '#4ade80' },
  { key: 'stt', gradient: 'linear-gradient(90deg, #eab308, #facc15)', dot: '#facc15' },
  { key: 'telephony', gradient: 'linear-gradient(90deg, #3b82f6, #60a5fa)', dot: '#60a5fa' },
];
