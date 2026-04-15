// ─── Admin Panel Type Definitions ───────────────────────────────────────

// Dashboard
export interface DashboardKpi {
  total_revenue: number;
  minutes_used: number;
  total_sessions: number;
  margin: number;
  estimated_cost: number;
}

export interface RevenueDay {
  date: string;
  revenue: string;
  minutes: string;
  sessions: string;
}

export interface RecentSession {
  id: string;
  duration_seconds: number;
  minutes_used: string;
  cost_usd: string;
  status: string;
  created_at: string;
}

export interface DashboardData {
  kpi: DashboardKpi;
  revenue_by_day: RevenueDay[];
  recent_sessions: RecentSession[];
}

// Tickets
export interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'replied' | 'closed';
  created_at: string;
  updated_at: string;
  user_email: string;
  workspace_name: string;
  workspace_id: string;
  message_count: number;
}

export interface TicketMessage {
  id: string;
  sender_role: 'user' | 'admin';
  sender_id: string;
  sender_email: string;
  body: string;
  created_at: string;
}

export interface TicketDetail extends Ticket {
  user_id: string;
  messages: TicketMessage[];
}

// Contacts
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  ip_address: string;
  created_at: string;
}

// Sessions
export interface TranscriptEntry {
  speaker: string;
  text: string;
  translation?: string;
}

export interface Session {
  id: string;
  subscriber_id: string;
  duration_seconds: number;
  minutes_used: string;
  cost_usd: string;
  status: string;
  transcript: TranscriptEntry[];
  created_at: string;
}

// Workspaces
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  balance_usd: number;
  subscription_status: string;
  subscription_current_period_end: string | null;
  provider_config: Record<string, string>;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: string;
  amount_usd: number;
  balance_after: number;
  description: string;
  created_at: string;
}

// Finance
export interface FinanceKpi {
  total_deposit_balance: number;
  deposits_30d: number;
  usage_revenue_30d: number;
  real_provider_cost_30d: number;
  margin_percent: number;
  active_subscriptions: number;
  total_sessions_30d: number;
}

export interface FinanceOverview {
  kpi: FinanceKpi;
  plan_counts: Array<{ plan: string; count: number }>;
}

export interface FinanceRevenueDay {
  date: string;
  deposits: string;
  usage_revenue: string;
}

export interface FinanceTransaction {
  id: string;
  workspace_id: string;
  workspace_name: string;
  type: string;
  amount_usd: number;
  balance_after: number;
  description: string;
  created_at: string;
}

// Billing
export interface BillingSettings {
  billing_markup?: string;
  billing_low_balance_threshold?: string;
  billing_signup_bonus_usd?: string;
  billing_agents_monthly_price?: string;
  billing_agents_mcp_monthly_price?: string;
}

// Providers
export interface StripeStatus {
  connected: boolean;
  stripe_user_id?: string;
  business_name?: string;
  email?: string;
  livemode?: boolean;
}

export interface ProviderConfig {
  name: string;
  icon: string;
  description: string;
  keys: string[];
}

// Settings
export interface PlatformSettings {
  pricing_per_minute?: string;
  bundles?: Array<{ name: string; minutes: number; price: number }>;
  default_greeting?: string;
  default_tts_provider?: string;
  default_languages?: { my: string; target: string };
  [key: string]: unknown;
}

// Audit
export interface AuditEntry {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

// Promo
export interface PromoCode {
  id: string;
  code: string;
  minutes: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

// Translator
export interface TranslatorSubscriber {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  my_language: string;
  target_language: string;
  mode: string;
  who_hears: string;
  tone: string;
  greeting_text: string;
  tts_provider: string;
  tts_voice_id: string | null;
  telegram_chat_id: string | null;
  balance_minutes: number;
  enabled: boolean;
  blocked: boolean;
  blocked_reason: string | null;
  created_at: string;
}

export interface TranslatorTransaction {
  id: string;
  type: string;
  minutes: number;
  comment: string | null;
  created_at: string;
}
