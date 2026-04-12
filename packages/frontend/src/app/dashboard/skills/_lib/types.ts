// ─── Skill Pack Types ──────────────────────────────────────────────────────

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

export type SkillSection = 'general' | 'activation' | 'dataTools' | 'escalation' | 'completion' | 'json';

export interface SkillCategory {
  id: string;
  labelEn: string;
  labelRu: string;
  icon: string;
  color: string;
  gradient: string;
}
