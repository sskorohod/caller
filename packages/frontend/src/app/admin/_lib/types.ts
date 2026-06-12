// ─── Admin Panel Type Definitions ───────────────────────────────────────

// Dashboard
export type Period = 'today' | '7d' | '30d' | 'year' | 'all';

export interface KpiWindow {
  current: number;
  previous: number | null; // null for 'all' (no trend)
}

export interface DashboardKpi {
  revenue: KpiWindow;
  provider_cost: KpiWindow;
  margin_percent: KpiWindow;
  minutes: KpiWindow;
  sessions: KpiWindow;
  active_users: KpiWindow;
  signups: KpiWindow;
}

export interface ChartBucket {
  bucket: string;
  value: number;
}

export interface FunnelData {
  signed_up: number;
  claimed_bonus: number;
  first_call: number;
  first_topup: number;
  bought_number: number;
}

export interface LowBalanceAlert {
  id: string;
  name: string;
  owner_name: string | null;
  balance_usd: number;
}

export interface NumberAtRisk {
  id: string;
  phone_number: string;
  next_renewal_at: string;
  monthly_price_usd: number;
  workspace_id: string;
  workspace_name: string;
  owner_name: string | null;
  balance_usd: number;
}

export interface HealthData {
  low_balance: LowBalanceAlert[];
  numbers_at_risk: NumberAtRisk[];
  untranslated_7d: { turns: number; sessions: number };
  failed_calls_7d: { failed: number; total: number };
  open_tickets: number;
}

export interface RecentSession {
  id: string;
  duration_seconds: number;
  minutes_used: string;
  cost_usd: string;
  status: string;
  created_at: string;
}

export interface DashboardLiveSession {
  call_id: string;
  workspace_id: string;
  workspace_name: string | null;
  is_admin: boolean;
  type: string;
  started_at: string;
  from_number: string | null;
  to_number: string | null;
}

export interface DashboardLiveData {
  active: DashboardLiveSession[];
  active_count: number;
  today: { revenue: number; sessions: number; signups: number };
  open_tickets: number;
  new_contacts: number;
}

export interface RepeatBonusAttempt {
  id: string;
  phone_number: string;
  source: string; // 'register' | 'magic_link' | 'phone_update'
  created_at: string;
  workspace_id?: string | null;
  workspace_name?: string | null;
  owner_name?: string | null;
  claimed_by_workspace_id: string | null;
  claimed_by_name: string | null;
}

export interface DashboardData {
  period: Period;
  granularity: 'hour' | 'day' | 'month';
  kpi: DashboardKpi;
  revenue_by_bucket: ChartBucket[];
  signups_by_bucket: ChartBucket[];
  funnel: FunnelData;
  health: HealthData;
  recent_sessions: RecentSession[];
  repeat_bonus_attempts?: RepeatBonusAttempt[];
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
  owner_name?: string | null;
  phone_numbers?: string[] | null;
  repeat_phone_attempts?: number;
  // List enrichment (GET /admin/workspaces)
  spent_total?: number;
  sessions_count?: number;
  last_session_at?: string | null;
  owner_email?: string | null;
  has_personal_number?: boolean;
}

export interface WorkspacesListResponse {
  workspaces: Workspace[];
  total: number;
  stats: {
    total_subscribers: number;
    new_30d: number;
    active_30d: number;
    with_balance: number;
  };
}

export interface WorkspaceUsage {
  sessions_total: number;
  minutes_total: number;
  last_session_at: string | null;
  spent_total: number;
  spent_30d: number;
  topup_total: number;
  bonus_granted: boolean;
  languages: string | null;
}

export interface Transaction {
  id: string;
  type: string;
  amount_usd: number;
  balance_after: number;
  description: string;
  created_at: string;
  reference_type?: string | null;
  reference_id?: string | null;
}

// Personal numbers
export interface AdminPersonalNumber {
  id: string;
  phone_number: string;
  monthly_price_usd: number;
  purchased_at: string | null;
  next_renewal_at: string | null;
  auto_renew: boolean;
  status: string; // 'active' | 'released'
  released_at: string | null;
  workspace_id?: string;
  workspace_name?: string | null;
  owner_name?: string | null;
  balance_usd?: number | null;
}

// Finance
export interface FinanceKpi {
  deposits: KpiWindow;
  usage_revenue: KpiWindow;
  provider_cost: KpiWindow;
  margin_percent: KpiWindow;
  total_deposit_balance: number;
  active_subscriptions: number;
  total_sessions: number;
}

export interface FinanceTopSpender {
  workspace_id: string;
  workspace_name: string | null;
  owner_name: string | null;
  spent: number;
}

export interface FinanceOverview {
  period: Period;
  kpi: FinanceKpi;
  revenue_breakdown: { usage: number; number_rental: number };
  top_spenders: FinanceTopSpender[];
  plan_counts: Array<{ plan: string; count: number }>;
}

export interface FinanceRevenueDay {
  date: string;
  deposits: number;
  usage_revenue: number;
}

export interface FinanceRevenueChart {
  granularity: 'hour' | 'day' | 'month';
  rows: FinanceRevenueDay[];
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
  billing_personal_number_monthly_usd?: string;
  billing_agents_monthly_price?: string;
  billing_agents_mcp_monthly_price?: string;
}

// Providers
export interface StripeStatus {
  connected: boolean;
  mode?: 'oauth' | 'manual';
  stripe_user_id?: string | null;
  business_name?: string | null;
  email?: string | null;
  livemode?: boolean;
  oauth_available?: boolean;
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
