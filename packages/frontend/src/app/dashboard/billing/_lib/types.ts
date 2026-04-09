export interface BillingInfo {
  balance_usd: number;
  plan: string;
  plan_name: string;
  subscription_status: string;
  subscription_current_period_end: string | null;
  provider_config: Record<string, string>;
  features: {
    liveTranslator: boolean;
    aiAgents: boolean;
    mcpAccess: boolean;
    maxAgentProfiles: number;
    maxTelephonyConnections: number;
  };
}

export interface Transaction {
  id: string;
  type: string;
  amount_usd: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface PlanInfo {
  id: string;
  name: string;
  has_subscription: boolean;
  features: Record<string, boolean | number>;
}

export type TransactionFilter = 'all' | 'topup' | 'usage' | 'refund' | 'gift' | 'signup_bonus' | 'promo';
