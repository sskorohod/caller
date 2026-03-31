-- ============================================================
-- Caller Platform: Foundation Schema
-- Workspaces, Users, RBAC, API Keys, Provider Credentials
-- ============================================================

-- Enable required extensions
create extension if not exists "pgvector";
create extension if not exists "pg_trgm";

-- ============================================================
-- WORKSPACES
-- ============================================================
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  industry text, -- 'appliance_repair', 'general_service', 'support', etc.
  timezone text not null default 'America/New_York',
  languages text[] not null default '{en}',

  -- Conversation ownership defaults
  conversation_owner_default text not null default 'internal'
    check (conversation_owner_default in ('internal', 'external')),
  allow_inbound_external_handoff boolean not null default false,
  external_inbound_webhook_url text,
  external_inbound_auth_secret text, -- encrypted
  external_ready_timeout_ms integer not null default 8000,
  inbound_fallback_mode text not null default 'fallback_to_internal',

  -- Retention defaults
  recording_retention_days integer not null default 90,
  transcript_retention_days integer not null default 365,

  -- Compliance
  call_recording_disclosure boolean not null default true,
  ai_disclosure boolean not null default true,

  -- Billing
  plan text not null default 'free'
    check (plan in ('free', 'starter', 'growth', 'business', 'enterprise')),
  minutes_included integer not null default 50,
  minutes_used_this_period integer not null default 0,
  billing_period_start timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- WORKSPACE MEMBERS (RBAC)
-- ============================================================
create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null, -- references auth.users
  role text not null default 'operator'
    check (role in ('owner', 'admin', 'operator', 'analyst')),
  created_at timestamptz not null default now(),

  unique (workspace_id, user_id)
);

create index idx_workspace_members_user on workspace_members(user_id);
create index idx_workspace_members_workspace on workspace_members(workspace_id);

-- ============================================================
-- API KEYS (for MCP clients)
-- ============================================================
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  key_prefix text not null, -- first 12 chars for lookup (mcp_xxxxxxx)
  key_hash text not null, -- SHA-256 hash of full key
  created_by uuid, -- user who created it
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_api_keys_prefix on api_keys(key_prefix) where revoked_at is null;
create index idx_api_keys_workspace on api_keys(workspace_id);

-- ============================================================
-- PROVIDER CREDENTIALS (encrypted at rest)
-- ============================================================
create table provider_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null, -- 'twilio', 'openai', 'anthropic', 'elevenlabs', 'deepgram', 'xai'
  credential_data text not null, -- AES-256-GCM encrypted JSON
  is_verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workspace_id, provider)
);

-- ============================================================
-- TELEPHONY CONNECTIONS
-- ============================================================
create table telephony_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null default 'twilio',
  phone_number text not null, -- E.164 format
  friendly_name text,
  twilio_sid text, -- Twilio phone number SID
  inbound_enabled boolean not null default false,
  outbound_enabled boolean not null default true,
  ai_answering_enabled boolean not null default false,
  default_agent_profile_id uuid, -- references agent_profiles(id), added after that table
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_telephony_workspace on telephony_connections(workspace_id);
create index idx_telephony_phone on telephony_connections(phone_number);

-- ============================================================
-- AGENT PROFILES
-- ============================================================
create table agent_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  display_name text not null, -- how AI introduces itself
  company_name text,
  company_identity text, -- description of the company for the AI

  -- Voice & Language
  language text not null default 'en',
  voice_provider text not null default 'elevenlabs', -- 'elevenlabs', 'openai'
  voice_id text, -- provider-specific voice ID
  voice_settings jsonb not null default '{}',

  -- LLM
  llm_provider text not null default 'anthropic', -- 'anthropic', 'openai', 'xai'
  llm_model text not null default 'claude-sonnet-4-5-20250514',
  llm_temperature numeric(3,2) not null default 0.7,

  -- STT
  stt_provider text not null default 'deepgram', -- 'deepgram', 'openai'

  -- Behavior
  system_prompt text, -- base system prompt for this agent
  greeting_message text, -- what AI says when answering
  escalation_rules jsonb not null default '[]',
  tool_policies jsonb not null default '{}',
  supported_goals text[] not null default '{}',
  business_mode text, -- 'appliance_repair', etc.
  business_tags text[] not null default '{}',

  -- Memory settings
  memory_enabled boolean not null default true,
  memory_lookback_days integer not null default 90,

  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_agent_profiles_workspace on agent_profiles(workspace_id);

-- Add FK from telephony_connections to agent_profiles
alter table telephony_connections
  add constraint fk_telephony_default_agent
  foreign key (default_agent_profile_id) references agent_profiles(id) on delete set null;

-- ============================================================
-- PROMPT PACKS
-- ============================================================
create table prompt_packs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  content text not null, -- the actual prompt text
  category text, -- 'greeting', 'escalation', 'compliance', 'closing', etc.
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_prompt_packs_workspace on prompt_packs(workspace_id);

-- Junction: agent_profiles <-> prompt_packs
create table agent_prompt_packs (
  agent_profile_id uuid not null references agent_profiles(id) on delete cascade,
  prompt_pack_id uuid not null references prompt_packs(id) on delete cascade,
  priority integer not null default 0, -- ordering
  primary key (agent_profile_id, prompt_pack_id)
);

-- ============================================================
-- SKILL PACKS
-- ============================================================
create table skill_packs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  intent text not null, -- 'intake', 'scheduling', 'follow_up', 'payment_reminder', etc.

  -- Skill behavior definition
  activation_rules jsonb not null default '{}', -- when this skill activates
  required_data jsonb not null default '[]', -- what must be collected
  tool_sequence jsonb not null default '[]', -- ordered tool usage
  allowed_tools text[] not null default '{}',
  escalation_conditions jsonb not null default '[]',
  completion_criteria jsonb not null default '{}',
  interruption_rules jsonb not null default '{}',
  conversation_rules text, -- free-form instructions

  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_skill_packs_workspace on skill_packs(workspace_id);

-- Junction: agent_profiles <-> skill_packs
create table agent_skill_packs (
  agent_profile_id uuid not null references agent_profiles(id) on delete cascade,
  skill_pack_id uuid not null references skill_packs(id) on delete cascade,
  priority integer not null default 0,
  primary key (agent_profile_id, skill_pack_id)
);

-- ============================================================
-- KNOWLEDGE BASE
-- ============================================================
create table knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_knowledge_bases_workspace on knowledge_bases(workspace_id);

-- Junction: agent_profiles <-> knowledge_bases
create table agent_knowledge_bases (
  agent_profile_id uuid not null references agent_profiles(id) on delete cascade,
  knowledge_base_id uuid not null references knowledge_bases(id) on delete cascade,
  primary key (agent_profile_id, knowledge_base_id)
);

create table knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid not null references knowledge_bases(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  content text, -- raw text content
  doc_type text not null default 'document', -- 'document', 'faq', 'policy', 'pricing', 'troubleshooting'
  source_url text,
  file_path text, -- S3 path if uploaded file
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_knowledge_docs_kb on knowledge_documents(knowledge_base_id);

-- Knowledge embeddings for RAG
create table knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  embedding vector(1536), -- OpenAI ada-002 dimensions
  created_at timestamptz not null default now()
);

create index idx_knowledge_embeddings_doc on knowledge_embeddings(document_id);
create index idx_knowledge_embeddings_workspace on knowledge_embeddings(workspace_id);

-- ============================================================
-- CALLER MEMORY
-- ============================================================
create table caller_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  phone_number text not null, -- normalized E.164
  name text,
  email text,
  company text,
  relationship text, -- 'customer', 'lead', 'vendor', etc.
  metadata jsonb not null default '{}',
  last_call_at timestamptz,
  total_calls integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workspace_id, phone_number)
);

create index idx_caller_profiles_phone on caller_profiles(workspace_id, phone_number);

create table caller_memory_facts (
  id uuid primary key default gen_random_uuid(),
  caller_profile_id uuid not null references caller_profiles(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  fact_type text not null, -- 'issue', 'preference', 'promise', 'follow_up', 'appointment', 'general'
  content text not null,
  source_call_id uuid, -- references calls(id), added after that table
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_caller_facts_profile on caller_memory_facts(caller_profile_id);
create index idx_caller_facts_workspace on caller_memory_facts(workspace_id);

-- ============================================================
-- CALLS & AI SESSIONS
-- ============================================================
create table calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  status text not null default 'initiated'
    check (status in ('initiated', 'ringing', 'in_progress', 'completed', 'failed', 'canceled', 'fallback_to_internal')),

  -- Phone numbers
  from_number text not null,
  to_number text not null,
  telephony_connection_id uuid references telephony_connections(id),

  -- Twilio data
  twilio_call_sid text,
  twilio_status text,

  -- Conversation ownership
  conversation_owner_requested text not null default 'internal'
    check (conversation_owner_requested in ('internal', 'external')),
  conversation_owner_actual text not null default 'internal'
    check (conversation_owner_actual in ('internal', 'external')),
  external_bootstrap_status text default 'not_requested'
    check (external_bootstrap_status in ('not_requested', 'requested', 'accepted', 'runtime_connecting', 'ready', 'timed_out', 'failed')),
  external_runtime_connected_at timestamptz,
  fallback_reason text,

  -- Agent
  agent_profile_id uuid references agent_profiles(id),

  -- Goal (for outbound)
  goal text,
  goal_source text, -- 'mcp', 'dashboard', 'workflow'
  goal_payload jsonb,
  context jsonb,
  outcome_schema jsonb,

  -- Caller info
  caller_profile_id uuid references caller_profiles(id),

  -- Metadata
  metadata jsonb not null default '{}',
  external_runtime_metadata jsonb,

  -- Timing
  initiated_at timestamptz not null default now(),
  ringing_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_calls_workspace on calls(workspace_id);
create index idx_calls_status on calls(workspace_id, status);
create index idx_calls_direction on calls(workspace_id, direction);
create index idx_calls_created on calls(workspace_id, created_at desc);
create index idx_calls_caller on calls(caller_profile_id);
create index idx_calls_twilio_sid on calls(twilio_call_sid);

-- Add FK from caller_memory_facts to calls
alter table caller_memory_facts
  add constraint fk_memory_facts_call
  foreign key (source_call_id) references calls(id) on delete set null;

-- ============================================================
-- AI CALL SESSIONS
-- ============================================================
create table ai_call_sessions (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,

  -- Agent config snapshot
  agent_profile_id uuid references agent_profiles(id),
  prompt_snapshot text, -- frozen system prompt at call time
  skills_snapshot jsonb, -- frozen skill config at call time

  -- Conversation ownership
  conversation_owner text not null default 'internal',

  -- Artifacts
  recording_url text,
  recording_duration_seconds integer,
  transcript jsonb, -- array of {speaker, text, timestamp}
  summary text,
  action_items jsonb not null default '[]',
  extracted_facts jsonb not null default '[]',
  outcome jsonb, -- structured result matching outcome_schema

  -- Quality
  sentiment text, -- 'positive', 'neutral', 'negative'
  quality_flags text[] not null default '{}',
  qa_score numeric(3,1),

  -- Stats
  total_turns integer not null default 0,
  total_tokens_in integer not null default 0,
  total_tokens_out integer not null default 0,
  avg_latency_ms integer,

  -- Cost tracking
  cost_stt numeric(10,6) not null default 0,
  cost_llm numeric(10,6) not null default 0,
  cost_tts numeric(10,6) not null default 0,
  cost_telephony numeric(10,6) not null default 0,
  cost_total numeric(10,6) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ai_sessions_call on ai_call_sessions(call_id);
create index idx_ai_sessions_workspace on ai_call_sessions(workspace_id);

-- ============================================================
-- CALL EVENTS (append-only log)
-- ============================================================
create table call_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event_type text not null, -- 'call_initiated', 'call_ringing', 'call_connected', 'turn_start', 'turn_end', 'tool_call', 'escalation', 'call_ended', etc.
  event_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_call_events_call on call_events(call_id, created_at);

-- ============================================================
-- DATA CONNECTORS
-- ============================================================
create table data_connectors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  connector_type text not null, -- 'fixarcrm', 'webhook', 'rest_api', etc.
  config jsonb not null default '{}', -- encrypted connection details
  is_active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- WEBHOOK ENDPOINTS
-- ============================================================
create table webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  url text not null,
  events text[] not null default '{}', -- which events to send
  secret text, -- for signature verification
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid,
  action text not null, -- 'agent_profile.created', 'api_key.revoked', etc.
  resource_type text not null,
  resource_id uuid,
  changes jsonb not null default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_workspace on audit_logs(workspace_id, created_at desc);

-- ============================================================
-- QA EVALUATIONS
-- ============================================================
create table qa_evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references ai_call_sessions(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  criteria jsonb not null default '[]', -- [{name, passed, score, notes}]
  overall_score numeric(3,1),
  evaluated_at timestamptz not null default now(),
  evaluated_by text not null default 'system' -- 'system' or user_id
);

create index idx_qa_evaluations_session on qa_evaluations(session_id);

-- ============================================================
-- Updated_at trigger function
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at
create trigger trg_workspaces_updated before update on workspaces for each row execute function update_updated_at();
create trigger trg_provider_credentials_updated before update on provider_credentials for each row execute function update_updated_at();
create trigger trg_telephony_connections_updated before update on telephony_connections for each row execute function update_updated_at();
create trigger trg_agent_profiles_updated before update on agent_profiles for each row execute function update_updated_at();
create trigger trg_prompt_packs_updated before update on prompt_packs for each row execute function update_updated_at();
create trigger trg_skill_packs_updated before update on skill_packs for each row execute function update_updated_at();
create trigger trg_knowledge_bases_updated before update on knowledge_bases for each row execute function update_updated_at();
create trigger trg_knowledge_documents_updated before update on knowledge_documents for each row execute function update_updated_at();
create trigger trg_caller_profiles_updated before update on caller_profiles for each row execute function update_updated_at();
create trigger trg_caller_memory_facts_updated before update on caller_memory_facts for each row execute function update_updated_at();
create trigger trg_calls_updated before update on calls for each row execute function update_updated_at();
create trigger trg_ai_call_sessions_updated before update on ai_call_sessions for each row execute function update_updated_at();
create trigger trg_data_connectors_updated before update on data_connectors for each row execute function update_updated_at();
create trigger trg_webhook_endpoints_updated before update on webhook_endpoints for each row execute function update_updated_at();

-- ============================================================
-- RLS Policies (to be configured per Supabase setup)
-- ============================================================
-- Note: RLS will be configured after Supabase project setup.
-- All tables should enforce workspace_id isolation.
