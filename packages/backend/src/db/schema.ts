import {
  pgTable, uuid, text, boolean, integer, numeric, timestamp, jsonb, unique, index, customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Custom pgvector type
const vector = customType<{ data: string; dpiverName: string }>({
  dataType() { return 'vector(1536)'; },
  toDriver(value: string) { return value; },
  fromDriver(value: unknown) { return value as string; },
});

// ============================================================
// USERS (self-hosted auth)
// ============================================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// WORKSPACES
// ============================================================
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  industry: text('industry'),
  timezone: text('timezone').notNull().default('America/New_York'),
  languages: text('languages').array().notNull().default(sql`'{en}'`),
  conversation_owner_default: text('conversation_owner_default').notNull().default('internal'),
  allow_inbound_external_handoff: boolean('allow_inbound_external_handoff').notNull().default(false),
  external_inbound_webhook_url: text('external_inbound_webhook_url'),
  external_inbound_auth_secret: text('external_inbound_auth_secret'),
  external_ready_timeout_ms: integer('external_ready_timeout_ms').notNull().default(8000),
  inbound_fallback_mode: text('inbound_fallback_mode').notNull().default('fallback_to_internal'),
  inbound_auto_answer_delay_seconds: integer('inbound_auto_answer_delay_seconds').notNull().default(30),
  recording_retention_days: integer('recording_retention_days').notNull().default(90),
  transcript_retention_days: integer('transcript_retention_days').notNull().default(365),
  call_recording_disclosure: boolean('call_recording_disclosure').notNull().default(true),
  ai_disclosure: boolean('ai_disclosure').notNull().default(true),
  plan: text('plan').notNull().default('translator'), // 'translator' | 'agents' | 'agents_mcp'
  minutes_included: integer('minutes_included').notNull().default(50), // legacy, kept for backward compat
  minutes_used_this_period: integer('minutes_used_this_period').notNull().default(0), // legacy
  billing_period_start: timestamp('billing_period_start', { withTimezone: true }), // legacy
  balance_usd: numeric('balance_usd', { precision: 12, scale: 4 }).notNull().default('0'),
  stripe_customer_id: text('stripe_customer_id'),
  stripe_subscription_id: text('stripe_subscription_id'),
  subscription_status: text('subscription_status').notNull().default('none'), // 'none' | 'active' | 'past_due' | 'canceled' | 'trialing'
  subscription_current_period_end: timestamp('subscription_current_period_end', { withTimezone: true }),
  provider_config: jsonb('provider_config').notNull().default({}), // { twilio: 'platform'|'own', deepgram: ... }
  translator_defaults: jsonb('translator_defaults').notNull().default({}), // { greeting_text, tts_provider, tts_voice_id, my_language, target_language, translation_mode }
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// WORKSPACE MEMBERS
// ============================================================
export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull(),
  role: text('role').notNull().default('operator'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.workspace_id, t.user_id),
  index('idx_workspace_members_user').on(t.user_id),
  index('idx_workspace_members_workspace').on(t.workspace_id),
]);

// ============================================================
// API KEYS
// ============================================================
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  key_prefix: text('key_prefix').notNull(),
  key_hash: text('key_hash').notNull(),
  created_by: uuid('created_by'),
  last_used_at: timestamp('last_used_at', { withTimezone: true }),
  revoked_at: timestamp('revoked_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_api_keys_prefix').on(t.key_prefix),
  index('idx_api_keys_workspace').on(t.workspace_id),
]);

// ============================================================
// PROVIDER CREDENTIALS
// ============================================================
export const providerCredentials = pgTable('provider_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  credential_data: text('credential_data').notNull(),
  is_verified: boolean('is_verified').notNull().default(false),
  verified_at: timestamp('verified_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.workspace_id, t.provider),
]);

// ============================================================
// AGENT PROFILES
// ============================================================
export const agentProfiles = pgTable('agent_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  display_name: text('display_name').notNull(),
  company_name: text('company_name'),
  company_identity: text('company_identity'),
  language: text('language').notNull().default('en'),
  voice_provider: text('voice_provider').notNull().default('elevenlabs'),
  voice_id: text('voice_id'),
  voice_settings: jsonb('voice_settings').notNull().default({}),
  llm_provider: text('llm_provider').notNull().default('anthropic'),
  llm_model: text('llm_model').notNull().default('claude-sonnet-4-5-20250514'),
  llm_temperature: numeric('llm_temperature', { precision: 3, scale: 2 }).notNull().default('0.7'),
  stt_provider: text('stt_provider').notNull().default('deepgram'),
  system_prompt: text('system_prompt'),
  greeting_message: text('greeting_message'),
  escalation_rules: jsonb('escalation_rules').notNull().default([]),
  tool_policies: jsonb('tool_policies').notNull().default({}),
  supported_goals: text('supported_goals').array().notNull().default(sql`'{}'`),
  business_mode: text('business_mode'),
  business_tags: text('business_tags').array().notNull().default(sql`'{}'`),
  memory_enabled: boolean('memory_enabled').notNull().default(true),
  memory_lookback_days: integer('memory_lookback_days').notNull().default(90),
  avatar_url: text('avatar_url'),
  description: text('description'),
  is_default: boolean('is_default').notNull().default(false),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_agent_profiles_workspace').on(t.workspace_id),
]);

// ============================================================
// TELEPHONY CONNECTIONS
// ============================================================
export const telephonyConnections = pgTable('telephony_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('twilio'),
  phone_number: text('phone_number').notNull(),
  friendly_name: text('friendly_name'),
  twilio_sid: text('twilio_sid'),
  inbound_enabled: boolean('inbound_enabled').notNull().default(false),
  outbound_enabled: boolean('outbound_enabled').notNull().default(true),
  ai_answering_enabled: boolean('ai_answering_enabled').notNull().default(false),
  default_agent_profile_id: uuid('default_agent_profile_id').references(() => agentProfiles.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_telephony_workspace').on(t.workspace_id),
  index('idx_telephony_phone').on(t.phone_number),
]);

// ============================================================
// PROMPT PACKS
// ============================================================
export const promptPacks = pgTable('prompt_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  content: text('content').notNull(),
  category: text('category'),
  version: integer('version').notNull().default(1),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_prompt_packs_workspace').on(t.workspace_id),
]);

export const agentPromptPacks = pgTable('agent_prompt_packs', {
  agent_profile_id: uuid('agent_profile_id').notNull().references(() => agentProfiles.id, { onDelete: 'cascade' }),
  prompt_pack_id: uuid('prompt_pack_id').notNull().references(() => promptPacks.id, { onDelete: 'cascade' }),
  priority: integer('priority').notNull().default(0),
}, (t) => [
  unique().on(t.agent_profile_id, t.prompt_pack_id),
]);

// ============================================================
// SKILL PACKS
// ============================================================
export const skillPacks = pgTable('skill_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  intent: text('intent').notNull(),
  activation_rules: jsonb('activation_rules').notNull().default({}),
  required_data: jsonb('required_data').notNull().default([]),
  tool_sequence: jsonb('tool_sequence').notNull().default([]),
  allowed_tools: text('allowed_tools').array().notNull().default(sql`'{}'`),
  escalation_conditions: jsonb('escalation_conditions').notNull().default([]),
  completion_criteria: jsonb('completion_criteria').notNull().default({}),
  interruption_rules: jsonb('interruption_rules').notNull().default({}),
  conversation_rules: text('conversation_rules'),
  version: integer('version').notNull().default(1),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_skill_packs_workspace').on(t.workspace_id),
]);

export const agentSkillPacks = pgTable('agent_skill_packs', {
  agent_profile_id: uuid('agent_profile_id').notNull().references(() => agentProfiles.id, { onDelete: 'cascade' }),
  skill_pack_id: uuid('skill_pack_id').notNull().references(() => skillPacks.id, { onDelete: 'cascade' }),
  priority: integer('priority').notNull().default(0),
}, (t) => [
  unique().on(t.agent_profile_id, t.skill_pack_id),
]);

// ============================================================
// KNOWLEDGE BASE
// ============================================================
export const knowledgeBases = pgTable('knowledge_bases', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_knowledge_bases_workspace').on(t.workspace_id),
]);

export const agentKnowledgeBases = pgTable('agent_knowledge_bases', {
  agent_profile_id: uuid('agent_profile_id').notNull().references(() => agentProfiles.id, { onDelete: 'cascade' }),
  knowledge_base_id: uuid('knowledge_base_id').notNull().references(() => knowledgeBases.id, { onDelete: 'cascade' }),
}, (t) => [
  unique().on(t.agent_profile_id, t.knowledge_base_id),
]);

export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  knowledge_base_id: uuid('knowledge_base_id').notNull().references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content'),
  doc_type: text('doc_type').notNull().default('document'),
  source_url: text('source_url'),
  file_path: text('file_path'),
  metadata: jsonb('metadata').notNull().default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_knowledge_docs_kb').on(t.knowledge_base_id),
]);

export const knowledgeEmbeddings = pgTable('knowledge_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  document_id: uuid('document_id').notNull().references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  chunk_index: integer('chunk_index').notNull(),
  chunk_text: text('chunk_text').notNull(),
  embedding: vector('embedding'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_knowledge_embeddings_doc').on(t.document_id),
  index('idx_knowledge_embeddings_workspace').on(t.workspace_id),
]);

// ============================================================
// CALLER MEMORY
// ============================================================
export const callerProfiles = pgTable('caller_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  phone_number: text('phone_number').notNull(),
  name: text('name'),
  email: text('email'),
  company: text('company'),
  relationship: text('relationship'),
  metadata: jsonb('metadata').notNull().default({}),
  last_call_at: timestamp('last_call_at', { withTimezone: true }),
  total_calls: integer('total_calls').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.workspace_id, t.phone_number),
  index('idx_caller_profiles_phone').on(t.workspace_id, t.phone_number),
]);

export const callerMemoryFacts = pgTable('caller_memory_facts', {
  id: uuid('id').primaryKey().defaultRandom(),
  caller_profile_id: uuid('caller_profile_id').notNull().references(() => callerProfiles.id, { onDelete: 'cascade' }),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  fact_type: text('fact_type').notNull(),
  content: text('content').notNull(),
  source_call_id: uuid('source_call_id'),
  is_resolved: boolean('is_resolved').notNull().default(false),
  resolved_at: timestamp('resolved_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_caller_facts_profile').on(t.caller_profile_id),
  index('idx_caller_facts_workspace').on(t.workspace_id),
]);

// ============================================================
// CALLS & AI SESSIONS
// ============================================================
export const calls = pgTable('calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  direction: text('direction').notNull(),
  status: text('status').notNull().default('initiated'),
  from_number: text('from_number').notNull(),
  to_number: text('to_number').notNull(),
  telephony_connection_id: uuid('telephony_connection_id').references(() => telephonyConnections.id),
  twilio_call_sid: text('twilio_call_sid'),
  twilio_status: text('twilio_status'),
  conversation_owner_requested: text('conversation_owner_requested').notNull().default('internal'),
  conversation_owner_actual: text('conversation_owner_actual').notNull().default('internal'),
  external_bootstrap_status: text('external_bootstrap_status').default('not_requested'),
  external_runtime_connected_at: timestamp('external_runtime_connected_at', { withTimezone: true }),
  fallback_reason: text('fallback_reason'),
  agent_profile_id: uuid('agent_profile_id').references(() => agentProfiles.id),
  goal: text('goal'),
  goal_source: text('goal_source'),
  goal_payload: jsonb('goal_payload'),
  context: jsonb('context'),
  outcome_schema: jsonb('outcome_schema'),
  caller_profile_id: uuid('caller_profile_id').references(() => callerProfiles.id),
  metadata: jsonb('metadata').notNull().default({}),
  external_runtime_metadata: jsonb('external_runtime_metadata'),
  initiated_at: timestamp('initiated_at', { withTimezone: true }).notNull().defaultNow(),
  ringing_at: timestamp('ringing_at', { withTimezone: true }),
  connected_at: timestamp('connected_at', { withTimezone: true }),
  ended_at: timestamp('ended_at', { withTimezone: true }),
  duration_seconds: integer('duration_seconds'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_calls_workspace').on(t.workspace_id),
  index('idx_calls_status').on(t.workspace_id, t.status),
  index('idx_calls_direction').on(t.workspace_id, t.direction),
  index('idx_calls_created').on(t.workspace_id, t.created_at),
  index('idx_calls_caller').on(t.caller_profile_id),
  index('idx_calls_twilio_sid').on(t.twilio_call_sid),
]);

export const aiCallSessions = pgTable('ai_call_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  call_id: uuid('call_id').notNull().references(() => calls.id, { onDelete: 'cascade' }),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  agent_profile_id: uuid('agent_profile_id').references(() => agentProfiles.id),
  prompt_snapshot: text('prompt_snapshot'),
  skills_snapshot: jsonb('skills_snapshot'),
  conversation_owner: text('conversation_owner').notNull().default('internal'),
  recording_url: text('recording_url'),
  recording_duration_seconds: integer('recording_duration_seconds'),
  transcript: jsonb('transcript'),
  summary: text('summary'),
  action_items: jsonb('action_items').notNull().default([]),
  extracted_facts: jsonb('extracted_facts').notNull().default([]),
  outcome: jsonb('outcome'),
  sentiment: text('sentiment'),
  quality_flags: text('quality_flags').array().notNull().default(sql`'{}'`),
  qa_score: numeric('qa_score', { precision: 3, scale: 1 }),
  total_turns: integer('total_turns').notNull().default(0),
  total_tokens_in: integer('total_tokens_in').notNull().default(0),
  total_tokens_out: integer('total_tokens_out').notNull().default(0),
  avg_latency_ms: integer('avg_latency_ms'),
  cost_stt: numeric('cost_stt', { precision: 10, scale: 6 }).notNull().default('0'),
  cost_llm: numeric('cost_llm', { precision: 10, scale: 6 }).notNull().default('0'),
  cost_tts: numeric('cost_tts', { precision: 10, scale: 6 }).notNull().default('0'),
  cost_telephony: numeric('cost_telephony', { precision: 10, scale: 6 }).notNull().default('0'),
  cost_total: numeric('cost_total', { precision: 10, scale: 6 }).notNull().default('0'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_ai_sessions_call').on(t.call_id),
  index('idx_ai_sessions_workspace').on(t.workspace_id),
]);

export const callEvents = pgTable('call_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  call_id: uuid('call_id').notNull().references(() => calls.id, { onDelete: 'cascade' }),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  event_type: text('event_type').notNull(),
  event_data: jsonb('event_data').notNull().default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_call_events_call').on(t.call_id, t.created_at),
]);

// ============================================================
// DATA CONNECTORS
// ============================================================
export const dataConnectors = pgTable('data_connectors', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  connector_type: text('connector_type').notNull(),
  config: jsonb('config').notNull().default({}),
  is_active: boolean('is_active').notNull().default(true),
  last_synced_at: timestamp('last_synced_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// WEBHOOK ENDPOINTS
// ============================================================
export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  events: text('events').array().notNull().default(sql`'{}'`),
  secret: text('secret'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// AUDIT LOG
// ============================================================
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id'),
  action: text('action').notNull(),
  resource_type: text('resource_type').notNull(),
  resource_id: uuid('resource_id'),
  changes: jsonb('changes').notNull().default({}),
  ip_address: text('ip_address'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_audit_logs_workspace').on(t.workspace_id, t.created_at),
]);

// ============================================================
// OAUTH 2.0
// ============================================================
export const oauthClients = pgTable('oauth_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  client_id: text('client_id').notNull().unique(),
  client_secret_hash: text('client_secret_hash').notNull(),
  redirect_uris: text('redirect_uris').array().notNull().default(sql`'{}'`),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_oauth_clients_workspace').on(t.workspace_id),
  index('idx_oauth_clients_client_id').on(t.client_id),
]);

export const oauthCodes = pgTable('oauth_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  client_id: text('client_id').notNull(),
  code: text('code').notNull().unique(),
  redirect_uri: text('redirect_uri').notNull(),
  state: text('state'),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull().default(sql`now() + interval '10 minutes'`),
  used_at: timestamp('used_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_oauth_codes_code').on(t.code),
  index('idx_oauth_codes_expires').on(t.expires_at),
]);

// ============================================================
// QA EVALUATIONS
// ============================================================
export const qaEvaluations = pgTable('qa_evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  session_id: uuid('session_id').notNull().references(() => aiCallSessions.id, { onDelete: 'cascade' }),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  criteria: jsonb('criteria').notNull().default([]),
  overall_score: numeric('overall_score', { precision: 3, scale: 1 }),
  evaluated_at: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
  evaluated_by: text('evaluated_by').notNull().default('system'),
}, (t) => [
  index('idx_qa_evaluations_session').on(t.session_id),
]);

// ============================================================
// MISSIONS
// ============================================================
export const missions = pgTable('missions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title'),
  status: text('status').notNull().default('draft'),
  agent_profile_id: uuid('agent_profile_id').references(() => agentProfiles.id),
  target_phone: text('target_phone'),
  goal: text('goal'),
  context: jsonb('context').notNull().default({}),
  fallback_action: text('fallback_action').notNull().default('report'),
  call_id: uuid('call_id').references(() => calls.id),
  outcome: jsonb('outcome'),
  created_by: uuid('created_by').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  scheduled_at: timestamp('scheduled_at', { withTimezone: true }),
  started_at: timestamp('started_at', { withTimezone: true }),
  completed_at: timestamp('completed_at', { withTimezone: true }),
  retry_count: integer('retry_count').notNull().default(0),
  max_retries: integer('max_retries').notNull().default(3),
  retry_at: timestamp('retry_at', { withTimezone: true }),
  notification_sent: boolean('notification_sent').notNull().default(false),
}, (t) => [
  index('idx_missions_workspace').on(t.workspace_id),
  index('idx_missions_status').on(t.workspace_id, t.status),
]);

export const missionMessages = pgTable('mission_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  mission_id: uuid('mission_id').notNull().references(() => missions.id, { onDelete: 'cascade' }),
  sender_type: text('sender_type').notNull(),
  content: text('content').notNull(),
  message_type: text('message_type').notNull().default('chat'),
  metadata: jsonb('metadata').notNull().default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_mission_messages_mission').on(t.mission_id),
]);

// ─── Call Share Tokens ─────────────────────────────────────────────────────

// ============================================================
// TRANSLATOR SUBSCRIBERS (B2C live translator service)
// ============================================================
export const translatorSubscribers = pgTable('translator_subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  phone_number: text('phone_number').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  my_language: text('my_language').notNull().default('ru'),
  target_language: text('target_language').notNull().default('en'),
  mode: text('mode').notNull().default('voice'), // 'voice' | 'text' | 'both'
  who_hears: text('who_hears').notNull().default('subscriber'), // 'subscriber' | 'both'
  translation_mode: text('translation_mode').notNull().default('bidirectional'), // 'bidirectional' | 'unidirectional'
  tone: text('tone').notNull().default('neutral'), // 'neutral' | 'business' | 'friendly' | 'medical' | 'legal'
  personal_context: text('personal_context').notNull().default(''), // free-form personal info for accurate translation
  greeting_text: text('greeting_text').notNull().default('Hello, I am your live translator. I will be translating this conversation.'),
  tts_provider: text('tts_provider').notNull().default('elevenlabs'),
  tts_voice_id: text('tts_voice_id'),
  telegram_chat_id: text('telegram_chat_id'),
  stripe_customer_id: text('stripe_customer_id'),
  balance_minutes: numeric('balance_minutes', { precision: 10, scale: 2 }).notNull().default('0'),
  enabled: boolean('enabled').notNull().default(true),
  blocked: boolean('blocked').notNull().default(false),
  blocked_reason: text('blocked_reason'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_translator_subs_workspace').on(t.workspace_id),
  index('idx_translator_subs_phone').on(t.phone_number),
  unique('uq_translator_subs_phone').on(t.workspace_id, t.phone_number),
]);

export const translatorSessions = pgTable('translator_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriber_id: uuid('subscriber_id').notNull().references(() => translatorSubscribers.id, { onDelete: 'cascade' }),
  call_id: uuid('call_id').references(() => calls.id, { onDelete: 'set null' }),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  duration_seconds: integer('duration_seconds').default(0),
  minutes_used: numeric('minutes_used', { precision: 10, scale: 2 }).default('0'),
  cost_usd: numeric('cost_usd', { precision: 10, scale: 4 }).default('0'),
  transcript: jsonb('transcript').notNull().default([]),
  status: text('status').notNull().default('active'), // 'active' | 'completed'
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_translator_sess_subscriber').on(t.subscriber_id),
  index('idx_translator_sess_workspace').on(t.workspace_id),
  index('idx_translator_sess_call').on(t.call_id),
]);

// ============================================================
// PROMO CODES
// ============================================================
export const promoCodes = pgTable('promo_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  minutes: numeric('minutes', { precision: 10, scale: 2 }).notNull(),
  max_uses: integer('max_uses').notNull().default(100),
  used_count: integer('used_count').notNull().default(0),
  expires_at: timestamp('expires_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('uq_promo_code').on(t.workspace_id, t.code),
]);

export const promoRedemptions = pgTable('promo_redemptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  promo_id: uuid('promo_id').notNull().references(() => promoCodes.id, { onDelete: 'cascade' }),
  subscriber_id: uuid('subscriber_id').notNull().references(() => translatorSubscribers.id, { onDelete: 'cascade' }),
  redeemed_at: timestamp('redeemed_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// BALANCE TRANSACTIONS (audit trail for subscriber balance)
// ============================================================
export const balanceTransactions = pgTable('balance_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriber_id: uuid('subscriber_id').notNull().references(() => translatorSubscribers.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'topup' | 'usage' | 'gift' | 'promo' | 'refund'
  minutes: numeric('minutes', { precision: 10, scale: 2 }).notNull(),
  comment: text('comment'),
  admin_user_id: uuid('admin_user_id'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_balance_tx_subscriber').on(t.subscriber_id),
]);

// ============================================================
// SUBSCRIBER PORTAL TOKENS (magic link auth)
// ============================================================
export const subscriberPortalTokens = pgTable('subscriber_portal_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriber_id: uuid('subscriber_id').notNull().references(() => translatorSubscribers.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  used_at: timestamp('used_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_portal_tokens_token').on(t.token),
  index('idx_portal_tokens_subscriber').on(t.subscriber_id),
]);

// ============================================================
// PLATFORM SETTINGS (key-value store)
// ============================================================
export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// ADMIN AUDIT LOG
// ============================================================
export const adminAuditLog = pgTable('admin_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id'),
  action: text('action').notNull(),
  resource_type: text('resource_type'),
  resource_id: text('resource_id'),
  details: jsonb('details'),
  ip_address: text('ip_address'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_admin_audit_created').on(t.created_at),
]);

// ============================================================
// DEPOSIT TRANSACTIONS (workspace-level, USD-based billing)
// ============================================================
export const depositTransactions = pgTable('deposit_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'topup' | 'usage' | 'refund' | 'promo' | 'signup_bonus' | 'gift'
  amount_usd: numeric('amount_usd', { precision: 12, scale: 4 }).notNull(), // positive = credit, negative = debit
  balance_after: numeric('balance_after', { precision: 12, scale: 4 }).notNull(),
  description: text('description'),
  reference_type: text('reference_type'), // 'stripe_checkout' | 'call_session' | 'translator_session' | 'admin' | 'system' | 'subscription'
  reference_id: text('reference_id'),
  created_by: uuid('created_by'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_deposit_tx_workspace').on(t.workspace_id, t.created_at),
  index('idx_deposit_tx_type').on(t.type),
]);

// ============================================================
// MAGIC LINKS (passwordless auth)
// ============================================================
export const magicLinks = pgTable('magic_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  used_at: timestamp('used_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_magic_links_token').on(t.token),
  index('idx_magic_links_email').on(t.email),
]);

// ============================================================
// CALL SHARE TOKENS
// ============================================================
export const callShareTokens = pgTable('call_share_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  call_id: uuid('call_id').notNull().references(() => calls.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_share_tokens_token').on(t.token),
  index('idx_share_tokens_call').on(t.call_id),
]);
