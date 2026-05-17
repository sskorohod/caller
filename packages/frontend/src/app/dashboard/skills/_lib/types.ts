// ─── Skill Pack Types ──────────────────────────────────────────────────────

export interface PauseProfile {
  pre_response_ms?: number;
  post_question_ms?: number;
  pre_price_ms?: number;
  after_close_ms?: number;
}

export interface BackchannelPolicy {
  enabled?: boolean;
  min_user_turn_ms?: number;
  phrases?: Record<string, string[]>;
}

export interface ObjectionBranch {
  trigger: string;
  response: string;
  action?: string;
}

export interface SkillPack {
  id: string;
  name: string;
  description: string | null;
  intent: string;
  activation_rules: Record<string, unknown>;
  required_data: unknown[];
  tool_sequence: unknown[];
  allowed_tools: string[];
  escalation_conditions: unknown[];
  completion_criteria: Record<string, unknown>;
  interruption_rules: Record<string, unknown>;
  conversation_rules: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Human-likeness fields
  opening_line?: string | null;
  talk_listen_ratio?: string | number | null;
  pause_profile?: PauseProfile;
  backchannel_policy?: BackchannelPolicy;
  bridging_phrases?: string[];
  objection_branches?: ObjectionBranch[];
  escalation_tags?: string[];
  requires_explicit_confirmation?: boolean;
}

export interface SkillPackForm {
  name: string;
  description: string;
  intent: string;
  conversation_rules: string;
  is_active: boolean;
  activation_rules: Record<string, unknown>;
  required_data: RequiredDataItem[];
  tool_sequence: ToolStep[];
  allowed_tools: string[];
  escalation_conditions: EscalationCondition[];
  completion_criteria: Record<string, unknown>;
  interruption_rules: Record<string, unknown>;
  // Human-likeness fields
  opening_line: string;
  talk_listen_ratio: number | null;
  pause_profile: PauseProfile;
  backchannel_policy: BackchannelPolicy;
  bridging_phrases: string[];
  objection_branches: ObjectionBranch[];
  escalation_tags: string[];
  requires_explicit_confirmation: boolean;
}

export interface RequiredDataItem {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ToolStep {
  tool: string;
  action: string;
  parameters: Record<string, string>;
}

export interface EscalationCondition {
  type: string;
  threshold: string;
  action: string;
  message: string;
}

export type SkillSection = 'general' | 'humanLike' | 'activation' | 'dataTools' | 'escalation' | 'completion' | 'json';

export interface SkillCategory {
  id: string;
  labelEn: string;
  labelRu: string;
  icon: string;
  color: string;
  gradient: string;
}
