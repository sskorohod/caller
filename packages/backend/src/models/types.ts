// ============================================================
// Database entity types matching migrations/00001_foundation.sql
// ============================================================

export type ConversationOwner = 'internal' | 'external';
export type WorkspacePlan = 'free' | 'starter' | 'growth' | 'business' | 'enterprise';
export type MemberRole = 'owner' | 'admin' | 'operator' | 'analyst';
export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'initiated' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'canceled' | 'fallback_to_internal';
export type ExternalBootstrapStatus = 'not_requested' | 'requested' | 'accepted' | 'runtime_connecting' | 'ready' | 'timed_out' | 'failed';
export type ProviderName = 'twilio' | 'openai' | 'anthropic' | 'elevenlabs' | 'deepgram' | 'xai';
export type VoiceProvider = 'elevenlabs' | 'openai' | 'xai';
export type LlmProvider = 'anthropic' | 'openai' | 'xai';
export type SttProvider = 'deepgram' | 'openai';
export type Sentiment = 'positive' | 'neutral' | 'negative';

// ============================================================
// Core entities
// ============================================================

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  timezone: string;
  languages: string[];
  conversation_owner_default: ConversationOwner;
  allow_inbound_external_handoff: boolean;
  external_inbound_webhook_url: string | null;
  external_inbound_auth_secret: string | null;
  external_ready_timeout_ms: number;
  inbound_fallback_mode: string;
  recording_retention_days: number;
  transcript_retention_days: number;
  call_recording_disclosure: boolean;
  ai_disclosure: boolean;
  plan: WorkspacePlan;
  minutes_included: number;
  minutes_used_this_period: number;
  billing_period_start: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface ApiKey {
  id: string;
  workspace_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  created_by: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ProviderCredential {
  id: string;
  workspace_id: string;
  provider: ProviderName;
  credential_data: string; // encrypted
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TelephonyConnection {
  id: string;
  workspace_id: string;
  provider: string;
  phone_number: string;
  friendly_name: string | null;
  twilio_sid: string | null;
  inbound_enabled: boolean;
  outbound_enabled: boolean;
  ai_answering_enabled: boolean;
  default_agent_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Agent Configuration
// ============================================================

export interface AgentProfile {
  id: string;
  workspace_id: string;
  name: string;
  display_name: string;
  company_name: string | null;
  company_identity: string | null;
  language: string;
  voice_provider: VoiceProvider;
  voice_id: string | null;
  voice_settings: Record<string, unknown>;
  llm_provider: LlmProvider;
  llm_model: string;
  llm_temperature: number;
  stt_provider: SttProvider;
  system_prompt: string | null;
  greeting_message: string | null;
  escalation_rules: unknown[];
  tool_policies: Record<string, unknown>;
  supported_goals: string[];
  business_mode: string | null;
  business_tags: string[];
  memory_enabled: boolean;
  memory_lookback_days: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromptPack {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  content: string;
  category: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SkillPack {
  id: string;
  workspace_id: string;
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

// ============================================================
// Knowledge Base
// ============================================================

export interface KnowledgeBase {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocument {
  id: string;
  knowledge_base_id: string;
  workspace_id: string;
  title: string;
  content: string | null;
  doc_type: string;
  source_url: string | null;
  file_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Memory
// ============================================================

export interface CallerProfile {
  id: string;
  workspace_id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  company: string | null;
  relationship: string | null;
  metadata: Record<string, unknown>;
  last_call_at: string | null;
  total_calls: number;
  created_at: string;
  updated_at: string;
}

export interface CallerMemoryFact {
  id: string;
  caller_profile_id: string;
  workspace_id: string;
  fact_type: string;
  content: string;
  source_call_id: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Calls & Sessions
// ============================================================

export interface Call {
  id: string;
  workspace_id: string;
  direction: CallDirection;
  status: CallStatus;
  from_number: string;
  to_number: string;
  telephony_connection_id: string | null;
  twilio_call_sid: string | null;
  twilio_status: string | null;
  conversation_owner_requested: ConversationOwner;
  conversation_owner_actual: ConversationOwner;
  external_bootstrap_status: ExternalBootstrapStatus;
  external_runtime_connected_at: string | null;
  fallback_reason: string | null;
  agent_profile_id: string | null;
  goal: string | null;
  goal_source: string | null;
  goal_payload: unknown | null;
  context: Record<string, unknown> | null;
  outcome_schema: Record<string, unknown> | null;
  caller_profile_id: string | null;
  metadata: Record<string, unknown>;
  external_runtime_metadata: Record<string, unknown> | null;
  initiated_at: string;
  ringing_at: string | null;
  connected_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface AiCallSession {
  id: string;
  call_id: string;
  workspace_id: string;
  agent_profile_id: string | null;
  prompt_snapshot: string | null;
  skills_snapshot: unknown | null;
  conversation_owner: ConversationOwner;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  transcript: unknown | null;
  summary: string | null;
  action_items: unknown[];
  extracted_facts: unknown[];
  outcome: Record<string, unknown> | null;
  sentiment: Sentiment | null;
  quality_flags: string[];
  qa_score: number | null;
  total_turns: number;
  total_tokens_in: number;
  total_tokens_out: number;
  avg_latency_ms: number | null;
  cost_stt: number;
  cost_llm: number;
  cost_tts: number;
  cost_telephony: number;
  cost_total: number;
  created_at: string;
  updated_at: string;
}

export interface CallEvent {
  id: string;
  call_id: string;
  workspace_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// Supporting entities
// ============================================================

export interface DataConnector {
  id: string;
  workspace_id: string;
  name: string;
  connector_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEndpoint {
  id: string;
  workspace_id: string;
  url: string;
  events: string[];
  secret: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  workspace_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  changes: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface QaEvaluation {
  id: string;
  session_id: string;
  workspace_id: string;
  criteria: unknown[];
  overall_score: number | null;
  evaluated_at: string;
  evaluated_by: string;
}
