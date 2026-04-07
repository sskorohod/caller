import type { WorkspacePlan } from '../models/types.js';

export interface PlanFeatures {
  liveTranslator: boolean;
  aiAgents: boolean;
  mcpAccess: boolean;
  maxAgentProfiles: number;       // -1 = unlimited
  maxTelephonyConnections: number; // -1 = unlimited
}

export interface PlanConfig {
  id: WorkspacePlan;
  name: string;
  hasSubscription: boolean;     // false for translator (deposit-only)
  features: PlanFeatures;
  stripePriceId: string | null; // null for translator
}

export const PLANS: Record<WorkspacePlan, PlanConfig> = {
  translator: {
    id: 'translator',
    name: 'Translator',
    hasSubscription: false,
    features: {
      liveTranslator: true,
      aiAgents: false,
      mcpAccess: false,
      maxAgentProfiles: 0,
      maxTelephonyConnections: 1,
    },
    stripePriceId: null,
  },
  agents: {
    id: 'agents',
    name: 'Agents',
    hasSubscription: true,
    features: {
      liveTranslator: true,
      aiAgents: true,
      mcpAccess: false,
      maxAgentProfiles: 10,
      maxTelephonyConnections: 5,
    },
    stripePriceId: process.env.STRIPE_AGENTS_PRICE_ID || null,
  },
  agents_mcp: {
    id: 'agents_mcp',
    name: 'Agents + MCP',
    hasSubscription: true,
    features: {
      liveTranslator: true,
      aiAgents: true,
      mcpAccess: true,
      maxAgentProfiles: -1,
      maxTelephonyConnections: -1,
    },
    stripePriceId: process.env.STRIPE_AGENTS_MCP_PRICE_ID || null,
  },
};

export function getPlanConfig(plan: WorkspacePlan): PlanConfig {
  return PLANS[plan] ?? PLANS.translator;
}

export function hasFeature(plan: WorkspacePlan, feature: keyof PlanFeatures): boolean {
  const config = getPlanConfig(plan);
  const value = config.features[feature];
  return typeof value === 'boolean' ? value : value !== 0;
}
