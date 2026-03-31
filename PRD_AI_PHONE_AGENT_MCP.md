# PRD: Configurable AI Phone Agent MCP SaaS

## Product Vision
Build a multi-tenant B2B SaaS platform that exposes a calling capability through MCP for any compatible agent and also provides a configurable AI phone agent for inbound and outbound business calls. The product is not only a telephony tool. It is a configurable voice-agent platform where each workspace can define company identity, prompts, skills, knowledge bases, memory, connected data sources, conversation ownership, and call behavior without hardcoding business logic into code.

## Product Summary
The platform has one core voice-agent system with configurable `conversation ownership`.

The admin can choose who owns the live conversation:

- `Internal Platform Agent`: the platform's own AI phone agent conducts the call
- `External Calling Agent`: an external agent runtime conducts the conversation while the platform provides telephony, STT/TTS, transcripts, recordings, and runtime events

In v1, the recommended defaults are:

- default conversation owner: `internal`
- outbound calls: support both `internal` and `external`
- inbound calls: `internal` by default
- optional inbound external handoff: available through an explicit admin setting, using `webhook + WebSocket`, with fallback to the internal agent

The product is optimized for SMB service businesses, including appliance repair, while remaining domain-agnostic through prompt policies, skills, memory, and knowledge configuration.

## Core Product Promise
A workspace admin can configure an AI phone system that:

- speaks on behalf of their company
- places and answers calls
- follows configurable instructions and business policies
- uses knowledge bases and connected business data
- remembers prior callers and prior issues
- performs structured actions through tools
- can route live dialogue to either an internal or external agent
- escalates to humans when needed
- stores recordings, transcripts, outcomes, and analytics

## Primary Use Cases
- An external MCP-capable agent asks the platform to call a customer for reminders, qualification, follow-up, support, collections, intake, or scheduling.
- A business enables AI answering for inbound calls and defines how the AI should behave for that business.
- A workspace uploads knowledge, defines prompt rules, and attaches skills so the agent can handle a domain like appliance repair without code changes.
- The AI recognizes returning callers, recalls prior issues, and continues contextually rather than treating each call as brand new.
- The platform can hand an inbound or outbound call to an external agent runtime when configured to do so.
- The platform analyzes past calls and improves quality over time.

## Product Definition

### Core Product Shift
The main product entity is not only a call. It is an `Agent Profile` plus a `Behavior Stack` plus `Conversation Ownership`.

Behavior stack:

- identity and company persona
- instructions and system prompts
- skills and tool policies
- knowledge base
- memory and caller history
- connected data sources
- voice/provider configuration
- escalation and compliance rules

Conversation ownership:

- `internal`: the platform agent owns the live conversation
- `external`: an external agent runtime owns the live conversation

Each call executes against one selected behavior stack and one selected conversation owner.

### No Hardcoded Business Logic
All business specialization should be expressed through configuration layers, not vertical-specific code.

Use a layered behavior model:

- base runtime rules
- workspace rules
- selected conversation owner
- agent profile rules
- use-case prompt pack
- skill pack
- knowledge retrieval
- runtime call objective override

Appliance repair should be a packaged configuration example, not a hardcoded feature branch.

### Memory as a First-Class Subsystem
The AI must recognize prior callers and prior issues.

Introduce three memory layers:

- Caller memory: normalized phone, identity, company relationship, prior intents, unresolved issues, last outcomes
- Conversation memory: transcripts, summaries, extracted facts, promises made, next steps, sentiment flags
- Business memory: persistent workspace-specific rules, FAQs, terminology, service boundaries, operational preferences

Memory should be queryable at call start and updated after call completion, regardless of whether the internal or external agent handled the live dialogue.

### Skills as a First-Class Subsystem
A skill is a reusable behavior package with:

- scope and purpose
- conversation rules
- allowed tools
- ordered tool sequences
- escalation conditions
- required data collection
- completion criteria
- interruption handling

Examples:

- appliance repair intake
- appointment reschedule
- invoice reminder
- payment follow-up
- lead qualification
- bilingual front desk

In v1, skills are first-class for internal ownership mode. In external ownership mode, they can optionally be exposed as structured hints, policies, or callable actions, but they do not own the dialogue loop.

### Connected Business Data
The AI should be able to use workspace data sources when authorized.

Supported source types:

- internal CRM entities stored in platform
- external APIs via connectors
- uploaded documents and knowledge bases
- structured records and search indices
- call history and prior interactions

The AI should use these sources through governed tools and retrieval, not raw database exposure.

## Public Interfaces and Important Objects

### MCP Surface
Primary MCP runtime tools:

- `start_call`
- `get_call_status`
- `get_call_artifacts`
- `list_recent_calls`

Optional management MCP tools can be added later if needed:

- `list_agent_profiles`
- `get_agent_profile`
- `get_knowledge_sources`

Admin and configuration flows stay in the dashboard for v1.

### Core SaaS Objects
- Workspace
- User
- Role
- Workspace API Key
- Provider Credential
- Telephony Connection
- Agent Profile
- Prompt Pack
- Skill Pack
- Knowledge Base
- Knowledge Document
- Memory Profile
- Data Connector
- Tool Policy
- Call
- AI Call Session
- Call Event
- Recording Artifact
- Transcript Artifact
- Analytics Report
- QA Criterion
- QA Evaluation
- Webhook Endpoint
- Audit Log Entry
- Retention Policy

### New Runtime Fields
Add first-class runtime fields:

- `conversation_owner_default`
- `allow_inbound_external_handoff`
- `external_inbound_webhook_url`
- `external_inbound_auth_secret`
- `external_ready_timeout_ms`
- `inbound_fallback_mode`

Persist on each call/session:

- `conversation_owner_requested`
- `conversation_owner_actual`
- `external_bootstrap_status`
- `external_runtime_connected_at`
- `fallback_reason`
- `goal_source`
- `goal_payload`
- `selected_agent_profile_id`
- `external_runtime_metadata`

### Agent Profile Contract
An `Agent Profile` should include:

- display identity
- company identity
- supported languages
- voice and providers
- prompt pack references
- skill pack references
- knowledge base references
- memory settings
- tool permissions
- escalation rules
- call objectives supported
- business mode tags

## System Architecture

### Conversation Ownership Model
For each call, the runtime must determine who owns the live dialogue.

#### Internal ownership
The platform agent owns:

- live conversation loop
- turn taking
- interruption handling
- prompt stack
- skill execution
- knowledge retrieval
- memory loading and updating
- tool use
- escalation
- call completion logic

The external MCP caller provides goal, task, context, and desired outcome.

#### External ownership
The external agent runtime owns:

- reasoning
- dialogue decisions
- goal progression
- response logic
- completion decisions

The platform owns:

- telephony
- audio transport
- STT
- TTS
- transcript stream
- recording
- call state
- event model
- observability
- artifact persistence

### Behavior Stack Resolution
For every call, resolve behavior in this order:

- global platform runtime rules
- workspace defaults
- selected conversation owner
- selected agent profile
- attached prompt packs
- attached skills
- attached knowledge sources
- caller memory
- runtime objective and overrides

This keeps behavior configurable while still deterministic.

### Runtime Architecture
Reuse and generalize the strongest patterns from `FixarCRM`:

- separate control plane and runtime plane
- store telephony records separately from AI session records
- keep per-call session state during execution
- persist structured tool calls, summary, and decisions
- enforce ordered tool sequence and end-call policy
- allow escalation to human
- validate stream ownership before media bridge

Runtime components:

- telephony ingress
- media bridge
- turn manager
- retrieval layer
- skill and policy engine
- tool execution engine
- session memory loader
- post-call memory updater
- analytics and QA workers
- external-agent session bridge

### External-Agent Inbound Handoff
Inbound external handoff is a dedicated runtime path.

#### Trigger model
When an inbound call arrives and `allow_inbound_external_handoff` is enabled:

1. The platform creates telephony and AI session records.
2. The platform sends a bootstrap webhook to the configured external orchestrator.
3. The webhook includes:
   - `event_type = inbound_call_requested`
   - `call_id`
   - `session_id`
   - `workspace_id`
   - `called_number`
   - `caller_number`
   - `received_at`
   - `routing_context`
   - one-time `session_token`
   - `ws_url`
   - `reply_deadline`
4. The external orchestrator starts or selects an agent runtime.
5. That runtime connects back over WebSocket using the session token.

#### Realtime protocol
Use `webhook + bidirectional WebSocket`.

Platform to external agent:

- call lifecycle events
- caller metadata
- transcript deltas
- speaker turn boundaries
- partial and final STT
- silence/interruption markers
- optional memory/context snapshot

External agent to platform:

- `agent_ready`
- `reply_text`
- optional `action`
- optional `control`
- heartbeat

#### Reply contract
In v1, the external agent returns:

- text
- optional structured actions
- optional control commands

The platform performs TTS and plays the synthesized audio into the call. External agents do not need to generate audio in v1.

#### Fallback behavior
If the external agent does not become ready within `external_ready_timeout_ms`, the platform falls back to the internal platform agent.

Important rule:

- In v1, fallback should occur before external dialogue ownership has started.
- Once the live conversation has begun under one owner, the owner should not change unless an explicit failover policy is later introduced.

### Memory Architecture
At call start:

- normalize caller identity
- look up caller by phone and linked customer records
- load recent call summaries and unresolved tasks
- load domain-relevant memory snippets
- inject only the minimal needed context into runtime

At call end:

- save transcript and summary
- extract structured facts
- update caller profile and issue history
- write follow-up tasks or unresolved intents
- mark promises and next steps

Memory writes should be structured and versioned, not only free text.

### Knowledge and Retrieval Architecture
Knowledge sources should support:

- uploaded documents
- manual notes
- FAQs
- policy pages
- service catalogs
- troubleshooting guides
- pricing references

Retrieval should be workspace-scoped and optionally profile-scoped.

The runtime chooses between:

- direct answer from prompt context
- skill-guided answer
- retrieval from knowledge base
- lookup from memory
- tool call to connected business data

### Skill System
A skill pack should define:

- when it can be activated
- what intent it handles
- what sequence of actions is allowed
- what must be collected before success
- what tools can be called
- what notes or structured outputs must be written
- when to escalate
- how to close the call correctly

Skill packs should be attachable to agent profiles and versioned.

## Dashboard and Admin Capabilities

### v1 Operations Dashboard
- Workspace settings
- Twilio BYO connection
- OpenAI gateway settings
- xAI/Grok settings
- ElevenLabs settings
- API key management
- Agent profile management
- Prompt pack editor
- Skill pack editor
- Knowledge base manager
- Memory settings and caller lookup
- Data connector settings
- Call list
- AI session list
- Call detail page with recording, transcript, tool log, memory events, QA, summary
- Webhook settings
- Retention settings
- Usage and provider health
- Audit log

### Conversation Ownership Settings
The admin panel must include a central runtime switch:

- `Default Conversation Owner`
  - `Internal Platform Agent`
  - `External Calling Agent`

And additional inbound settings:

- `Allow Inbound Calls To External Agent`
- `Inbound External Agent Webhook URL`
- `Inbound External Agent Auth Secret`
- `External Agent Ready Timeout`
- `Inbound External Fallback Mode`

User-facing explanation:

- Internal: the platform's own AI agent conducts the call using prompts, skills, memory, and knowledge.
- External: an external agent conducts the live conversation while the platform provides calling, speech synthesis, transcript streaming, recording, and runtime support.

### Agent Configuration UX
The dashboard must let admins configure:

- who the AI is
- how it speaks
- what it knows
- what it is allowed to do
- what it should remember
- how it handles escalation
- which use cases it should answer
- who owns the live conversation by default
- whether inbound calls can be handed off to an external agent runtime

## SaaS Quality Requirements

### Tenancy and Auth
- strict workspace isolation across all artifacts, memory, prompts, skills, and call data
- RBAC for admin, operator, analyst, and support
- workspace API keys for MCP clients
- encrypted provider credentials
- hashed API keys with prefix lookup and usage tracking
- signed inbound bootstrap webhooks
- one-time session tokens for external WebSocket handoff

### Reliability
- idempotent webhook processing
- append-only event log for call lifecycle
- async retries and dead-letter path
- provider failure classification
- runtime timeout and graceful fallback rules

### Safety and Governance
- tool policies per agent profile
- no raw DB access by runtime
- retrieval and actions only through governed interfaces
- audit logs for all behavior changes
- versioned prompt and skill changes
- human escalation controls
- ownership mode recorded on every call

### Analytics
- recording and transcript storage
- post-call summary
- extracted action items
- quality flags
- caller history timeline
- QA evaluations and trend reporting
- memory extraction metrics
- provider usage and call-cost instrumentation
- call classification by ownership mode

## Delivery Phases

### Phase 0: Product Spec Freeze
- Write the full PRD around a configurable AI phone agent with conversation ownership.
- Freeze canonical entities: Agent Profile, Prompt Pack, Skill Pack, Knowledge Base, Memory, AI Call Session, Conversation Ownership.
- Define the internal/external ownership model and inbound handoff behavior.

### Phase 1: SaaS Foundation
- Workspaces, auth, RBAC, audit logs, API keys, provider credentials
- telephony connection model
- agent profile base model
- tenant isolation at schema and query layers
- ownership settings model

### Phase 2: Telephony and Call Runtime
- inbound and outbound Twilio lifecycle
- call records plus AI session records
- secure media bridge
- real-time turn orchestration
- base MCP `start_call` contract
- ownership routing at call start

### Phase 3: Prompt, Skill, and Policy Engine
- prompt pack system
- skill pack system
- tool policy enforcement
- conversation flow engine
- escalation and end-call governance
- ownership-aware runtime branching

### Phase 4: Knowledge and Memory
- knowledge base ingestion and retrieval
- caller memory and conversation memory
- structured memory extraction and write-back
- returning-caller context loading

### Phase 5: External-Agent Runtime Bridge
- inbound bootstrap webhook
- external runtime WebSocket protocol
- text + optional actions reply model
- timeout and fallback to internal agent
- observability and security for handoff

### Phase 6: Analytics, QA, and Beta
- summaries, transcripts, action items, quality flags
- configurable QA subsystem
- trend reporting and improvement actions
- ownership-aware review UX
- pilot with real SMB service businesses

## Test Plan

### Core Behavior Scenarios
- external MCP agent can start an outbound call with internal ownership
- external MCP agent can start an outbound call with external ownership
- inbound call is answered by the internal platform agent when external handoff is disabled
- inbound call triggers webhook bootstrap and WebSocket handoff when external handoff is enabled
- appliance repair profile handles calls correctly using prompts, skills, and knowledge in internal mode
- returning caller is recognized and prior context is used correctly
- external runtime receives transcript deltas and returns text replies that the platform speaks via TTS
- AI updates memory after the call in both ownership modes

### Failure and Guardrail Scenarios
- missing knowledge source
- incomplete caller identity
- provider latency or outage
- repeated caller with conflicting memory facts
- tool sequence violation attempt
- disconnected caller mid-flow
- invalid stream ownership
- revoked API key
- bootstrap webhook failure
- invalid or expired external session token
- external runtime never sends `agent_ready`
- external runtime misses readiness timeout and call falls back to internal agent
- cross-workspace memory or knowledge access attempt

### Quality Scenarios
- prompt pack version change does not corrupt active calls
- skill pack updates are auditable
- memory retrieval stays workspace-scoped
- QA jobs classify internal and external ownership sessions correctly
- usage and cost metrics match provider events
- call detail page clearly shows requested owner, actual owner, and fallback reason

## Pricing Model

### Strategy
Freemium + Usage-based pricing with subscription tiers.

### Cost Structure Per Call Minute
| Component | Cost per minute |
|-----------|----------------|
| Twilio (voice) | ~$0.013 |
| STT (Deepgram Nova-2) | ~$0.0043 |
| LLM (Claude Sonnet / GPT-4o-mini) | ~$0.01-0.03 |
| TTS (ElevenLabs) | ~$0.02-0.04 |
| TTS (OpenAI, fallback) | ~$0.005 |
| Infrastructure | ~$0.005 |
| **Total (cost)** | **~$0.05-0.09/min** |

### Subscription Plans
| Plan | Price | Included Minutes | Overage |
|------|-------|-----------------|---------|
| Free | $0 | 50 min/month | N/A |
| Starter | $49/mo | 500 min | $0.15/min |
| Growth | $149/mo | 2000 min | $0.12/min |
| Business | $399/mo | 6000 min | $0.10/min |
| Enterprise | Custom | Custom | Custom |

### Premium Features (Growth+)
- Advanced analytics and QA scorecards
- External agent handoff (inbound WebSocket)
- Custom data connectors
- Priority support

### Target Gross Margin
60-70% on usage-based component.

## Latency Budget

### Criticality
In a phone conversation, pauses > 1.5 seconds feel like the system is frozen. Latency is the most critical UX factor for voice AI.

### Target Latency Budget (Single Turn)
| Component | Target | Max |
|-----------|--------|-----|
| STT (streaming, final) | 200ms | 400ms |
| LLM reasoning (first token) | 300ms | 800ms |
| TTS (streaming, first chunk) | 200ms | 400ms |
| Network + platform overhead | 100ms | 200ms |
| **Total (voice-to-voice)** | **800ms** | **1800ms** |

### Latency Optimization Strategy
- **Streaming STT**: use Deepgram Nova-2 or OpenAI Realtime instead of batch transcription
- **Streaming TTS**: start playing the first audio chunk before full text generation completes
- **LLM streaming**: stream LLM response into TTS as tokens are generated
- **Filler phrases**: auto-insert filler ("One moment...", "Let me check...") if latency exceeds 1.5s
- **Interruption detection**: detect when the caller starts speaking and immediately stop TTS playback
- **Connection pre-warming**: maintain persistent connections to STT/LLM/TTS providers
- **Alternative pipeline**: evaluate OpenAI Realtime API as a lower-latency voice-to-voice alternative

### Monitoring
- P50, P95, P99 latency per pipeline component
- Alerting when P95 > 1500ms
- Dashboard with per-component breakdown

## Voice Stack

### STT (Speech-to-Text)
| Provider | Model | Streaming | Latency | Price |
|----------|-------|-----------|---------|-------|
| **Deepgram** (primary) | Nova-2 | Yes | ~200ms | $0.0043/min |
| OpenAI (fallback) | Whisper | Yes (Realtime API) | ~300ms | $0.006/min |

### LLM (Reasoning)
| Provider | Model | Streaming | Latency (TTFT) | Price (input/output) |
|----------|-------|-----------|----------------|---------------------|
| **Anthropic** (primary) | Claude Sonnet 4.5 | Yes | ~300ms | $3/$15 per 1M tokens |
| OpenAI | GPT-4o-mini | Yes | ~200ms | $0.15/$0.60 per 1M tokens |
| xAI | Grok | Yes | ~250ms | TBD |

### TTS (Text-to-Speech)
| Provider | Quality | Streaming | Latency | Price |
|----------|---------|-----------|---------|-------|
| **ElevenLabs** (primary) | Excellent | Yes | ~200ms | $0.30/1K chars |
| OpenAI TTS (fallback) | Good | Yes | ~250ms | $0.015/1K chars |

### Voice-to-Voice Alternative
| Provider | Model | Latency | Price |
|----------|-------|---------|-------|
| OpenAI | Realtime API | ~500ms e2e | ~$0.06/min |

### Architectural Principles
- Providers are selected at the Agent Profile level
- Each component (STT, LLM, TTS) has a primary and fallback provider
- Automatic failover when primary is unavailable
- LLM-agnostic architecture: abstract interface, provider swap via config
- Post-call tasks (summary, QA, analytics) can use a cheaper model

## Competitive Analysis

### Direct Competitors
| Product | Type | Strengths | Weaknesses |
|---------|------|-----------|------------|
| **Vapi.ai** | Voice AI API | Good latency, developer-friendly | No MCP, no memory, no skill system |
| **Bland.ai** | Enterprise voice AI | Scale, enterprise features | Closed, expensive, no MCP |
| **Retell.ai** | Low-latency voice agents | Excellent latency, good DX | No configurable behavior stack |
| **Air.ai** | Autonomous phone agent | Fully autonomous calls | No external agent integration |
| **Synthflow** | No-code voice AI | Simplicity, no-code | Limited customization, no MCP |

### Unique Advantages (Competitive Moats)
1. **MCP-first** — the only platform that gives Claude/ChatGPT/any MCP agent calling capability
2. **Conversation Ownership** — flexible internal/external agent model
3. **Memory System** — three-level memory, returning caller recognition
4. **Configurable Behavior Stack** — domain-agnostic via prompt/skill/knowledge packs
5. **FixarCRM Synergy** — built-in CRM connector, ready-made appliance repair templates
6. **Post-call Intelligence** — analytics, QA, improvement loop built into the platform

## Infrastructure and Technology Stack

### Backend
- **Runtime**: Node.js (TypeScript) — tight Twilio SDK integration, excellent WebSocket support
- **Framework**: Fastify
- **MCP Server**: @modelcontextprotocol/sdk

### Frontend (Dashboard)
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui

### Database and Storage
- **Primary DB**: PostgreSQL 16 (Supabase)
- **Vector Search**: pgvector (for knowledge base RAG)
- **Queue**: Redis + BullMQ (async post-call processing)
- **File Storage**: S3-compatible (recordings)

### Auth and Security
- **Auth**: Supabase Auth
- **API Keys**: hashed with prefix lookup
- **Secrets**: encrypted provider credentials

### Hosting (v1)
- **Backend**: Railway or Fly.io
- **Frontend**: Vercel
- **Database**: Supabase
- **Monitoring**: Sentry + Axiom

## Onboarding Flow

### Target
Time-to-value: < 15 minutes from signup to first test call.

### Wizard Steps
1. **Workspace** — company name, industry, timezone, languages
2. **Telephony** — guided Twilio setup with step-by-step instructions
3. **AI Provider** — enter OpenAI API key, verify connection, select voice
4. **First Agent** — industry template or custom, set name and greeting
5. **Test Call** — platform calls the user, they talk to the AI, see transcript and summary

## FixarCRM Integration Strategy

### Data Connector
- Built-in connector to FixarCRM via MCP
- Read customers, visits, estimates, notes during calls
- Create visits, update leads, add timeline notes from calls

### Ready-Made Templates for Appliance Repair
- **Prompt Pack**: "Appliance Repair Front Desk"
- **Skill Pack**: "Intake" — collect appliance type, brand, model, symptoms
- **Skill Pack**: "Scheduling" — book visits through FixarCRM
- **Skill Pack**: "Follow-Up" — post-service call
- **Skill Pack**: "Payment Reminder"
- **Knowledge Base Template**: common issues, pricing, service area

## Compliance

### Call Recording
- Two-party consent states require disclosure prompt
- Configurable per workspace, default: enabled
- AI discloses recording at the start of every call

### AI Disclosure
- AI must identify itself as an AI assistant
- Platform does not allow AI to impersonate humans

### Data Retention
- Configurable retention policies per workspace
- Default: recordings 90 days, transcripts 1 year
- GDPR-ready: data deletion on request

## Assumptions and Defaults
- v1 is a configurable AI phone agent SaaS, not only a raw calling API.
- Default conversation owner is `internal`.
- Outbound supports both `internal` and `external`.
- Inbound is `internal` by default.
- Inbound external handoff is optional and must be explicitly enabled.
- Inbound external handoff uses `webhook + WebSocket`.
- External agents return `text + optional actions`; platform owns TTS in v1.
- Fallback for inbound external handoff is `internal`.
- Business specialization is configuration-driven through prompts, skills, knowledge, and memory.
- Appliance repair is a flagship configuration example, not hardcoded product logic.

## Notes from Existing Research
The architecture should preserve the strongest ideas already observed in `FixarCRM`:

- stateful AI session handling during calls
- structured tool execution with ordered call sequences
- configurable prompt and policy layers
- workspace-scoped knowledge base and QA subsystem
- call logs separated from AI session logs
- strict tenant isolation
- secure MCP API key authentication
- safe Twilio media stream validation before voice bridging
