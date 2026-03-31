# Product Functional Overview: AI Phone Agent MCP Platform

## What This Product Is
This product is a configurable AI phone-agent platform for businesses. It supports one core voice system with configurable `conversation ownership`.

Depending on settings, a call can be conducted by:

- the platform's internal AI phone agent
- an external AI agent runtime connected through MCP and real-time handoff interfaces

The platform is not just a Twilio wrapper and not just a call-analysis dashboard. It is a full system for creating smart voice agents that can speak like a company representative, use business knowledge, remember previous callers, follow instructions, and complete business tasks over the phone.

## Who It Is For
The primary audience is SMB and growing service businesses that need a smart AI operator for phone workflows. Example use cases include:

- appliance repair businesses
- local service companies
- support teams
- appointment-based businesses
- operators who want AI-assisted or AI-handled calling
- teams already using ChatGPT, Claude, or other agents that need phone-calling capabilities through MCP

## Core Product Idea
Each business configures an AI phone system using:

- company profile
- prompt packs
- skill packs
- knowledge bases
- memory
- connected business data
- voice and provider settings
- escalation rules
- conversation ownership settings

This means the AI can be taught how to behave without hardcoding business logic into the application.

For example, a business can create an appliance repair agent, upload troubleshooting and pricing documents, attach scheduling skills, define escalation rules, and choose whether calls should be run by the platform's internal phone agent or by an external agent runtime.

## How It Works End to End

### High-level flow
1. A workspace admin creates a workspace and signs into the dashboard.
2. The admin connects Twilio and AI providers such as OpenAI, xAI/Grok, and ElevenLabs.
3. The admin creates one or more agent profiles.
4. The admin adds prompts, skills, knowledge bases, and memory settings.
5. The admin chooses who owns live conversations by default.
6. The admin can optionally enable inbound handoff to an external agent.
7. External agents can connect through MCP and trigger outbound calls.
8. Every call is recorded as a telephony event and an AI session.
9. After the call, the platform stores recordings, transcripts, summaries, analytics, and updated memory.
10. Operators can review calls, listen to recordings, inspect transcripts, and improve behavior over time.

## Conversation Ownership Modes

### 1. Internal Platform Agent
This is the default and recommended mode.

In this mode, the platform's internal phone agent owns the live conversation. It uses:

- the selected agent profile
- prompt packs
- skill packs
- knowledge base retrieval
- memory
- internal tool policies

If an external MCP agent starts an outbound call in this mode, it provides:

- the task
- the goal
- the context
- optional constraints

The platform then conducts the live call and returns the final result.

### 2. External Calling Agent
In this mode, the external agent owns the live conversation logic.

The platform still provides:

- telephony
- dialing
- STT
- TTS
- recordings
- transcripts
- call events
- call control
- artifact storage

The external agent provides:

- reasoning
- dialogue decisions
- goal progression
- responses
- optional structured actions

In v1, this mode is especially important for outbound calls and optionally for inbound handoff.

## Main Runtime Scenarios

### Outbound call, internal ownership
An external MCP-capable agent asks the platform to call someone and gives it a goal. The platform's own phone agent then runs the full conversation and returns structured results afterward.

### Outbound call, external ownership
An external MCP-capable agent uses the platform mainly for telephony and voice infrastructure while the external runtime controls the dialogue itself.

### Inbound call, internal ownership
An incoming call is answered directly by the platform's configured AI phone agent.

### Inbound call, external handoff
If enabled in admin settings, the platform receives the inbound call, triggers an external agent bootstrap webhook, and then hands live dialogue control to the external agent runtime if it becomes ready in time.

## How a Customer Connects Twilio
Inside the dashboard, the workspace admin goes to the telephony settings area and connects a Twilio account.

The first version is designed for BYO Twilio, which means each customer uses their own Twilio account. In the settings flow, the admin will:

- enter Twilio credentials
- verify the connection
- configure phone numbers
- configure webhook URLs
- configure inbound and outbound permissions
- select whether AI answering is enabled for specific numbers or routes

Once connected, the platform uses Twilio for inbound call handling, outbound call initiation, and audio streaming.

## How a Customer Connects AI Providers
The dashboard includes a provider settings area where the customer can connect:

- OpenAI, used as the primary AI gateway for orchestration, reasoning, summaries, QA, and analysis
- xAI/Grok, used as an optional LLM provider
- ElevenLabs, used for voice and TTS

The customer can configure:

- API credentials
- default provider selection
- default models
- default voices
- provider-specific overrides per agent profile

This lets each business control how the AI sounds and which providers power its behavior.

## How the Customer Creates an AI Agent
In the dashboard, the customer creates an `Agent Profile`.

An agent profile defines:

- the AI's display name
- the company it represents
- the tone and identity it should use
- the supported languages
- the voice settings
- the prompt packs attached to it
- the skills attached to it
- the knowledge bases it can access
- the memory behavior
- the tools it can use
- the escalation rules

This is the main behavior object used by the platform in internal ownership mode, and it remains a key configuration object even when external ownership is enabled.

## How Prompts, Skills, Knowledge Bases, and Memory Work

### Prompt packs
Prompt packs define the general instructions and conversation behavior for the agent.

Examples:

- company introduction and tone
- greeting style
- language rules
- escalation instructions
- call closure rules
- compliance instructions

Prompt packs are used to shape how the agent speaks and makes decisions.

### Skill packs
Skill packs define how the AI handles specific tasks.

Examples:

- appliance repair intake
- reschedule existing appointment
- quote request handling
- follow-up call after service
- overdue payment reminder

Each skill pack can contain:

- the task it handles
- required information it must collect
- tool usage sequence
- business rules
- escalation conditions
- success and completion criteria

In internal mode, skills directly influence live dialogue. In external mode, they can still act as policy references or structured guidance, but the external agent owns the live reasoning loop.

### Knowledge bases
Knowledge bases contain uploaded or managed information that the AI can use during calls.

Examples:

- pricing sheets
- FAQs
- warranty rules
- repair troubleshooting guides
- company policies
- service area information

The AI can retrieve relevant information from these sources during a call.

### Memory
Memory lets the system remember prior callers and previous interactions.

Examples of memory:

- who called before
- what issue they called about
- whether they already had an appointment
- whether they were promised a callback
- prior summaries from previous calls
- unresolved issues

This allows the platform to treat callers as known contacts when appropriate and continue context rather than restarting every interaction from zero.

## How Returning Caller Memory Works
When a call starts, the platform checks caller identity using normalized phone numbers and linked history. If the caller has contacted the business before, the system can load:

- caller identity
- recent call summaries
- recent issues
- unresolved action items
- prior appointment context
- relevant memory facts

Then, after the call ends, the system updates memory by saving:

- the transcript
- a summary
- structured extracted facts
- promises made
- next steps
- unresolved items

This applies regardless of whether the internal or external agent owned the dialogue.

## How the Product Connects to MCP
The platform provides an MCP server that can be used by compatible external agents.

An external AI agent authenticates using a workspace API key and can then call platform tools. In the first version, MCP is focused mainly on runtime usage rather than full admin configuration.

The main MCP flow is:

1. The external agent connects to the MCP server.
2. It authenticates with a workspace API key.
3. It calls the main high-level tool to start a phone call.
4. The platform uses the configured conversation ownership mode for that call.
5. The external agent can later check call status and retrieve results.

## MCP Functions
The first version should support a small, clean MCP surface.

Primary functions:

- `start_call`
- `get_call_status`
- `get_call_artifacts`
- `list_recent_calls`

These functions let the external agent:

- place a call
- choose a target number
- optionally choose an agent profile
- set call objectives or instructions
- know whether internal or external ownership was used
- track progress
- retrieve recordings, transcripts, summaries, and analytics after the call

## How Inbound Calls Work
The platform supports two inbound patterns.

### Standard inbound handling
If AI answering is enabled, incoming calls can be answered by the configured internal AI phone agent.

The internal agent will:

- recognize the company identity it should represent
- load the correct agent profile
- use the correct voice
- apply the right prompts and skills
- check whether the caller is known
- retrieve memory and relevant knowledge
- conduct the conversation
- complete allowed tasks
- escalate to a human if necessary

### Inbound handoff to external agent
If the admin enables `Allow Inbound Calls To External Agent`, the inbound flow changes:

1. The platform receives the incoming call.
2. The platform sends a bootstrap webhook to the configured external orchestrator.
3. The webhook includes call metadata and a one-time session token.
4. The external orchestrator starts or selects an external agent runtime.
5. The external runtime connects back to the platform over WebSocket.
6. The platform streams real-time transcript and call events.
7. The external agent returns text responses and optional structured actions.
8. The platform converts the text into speech and plays it back into the call.

If the external agent is not ready before timeout, the platform falls back to the internal AI phone agent.

## How Outbound Calls Work
Outbound calls can be started in several ways:

- by an external MCP-capable agent
- manually from the dashboard
- from workflows or queues
- from future automation rules

For an outbound call, the platform will:

- choose the correct caller identity and phone number
- load the selected agent profile
- apply the relevant objective
- place the call through Twilio
- determine who owns the live conversation
- save all artifacts and analytics afterward

In internal mode, the platform conducts the conversation itself.

In external mode, the external agent receives transcript and event data and sends responses back while the platform manages telephony and speech synthesis.

## Realtime Protocol for External Ownership
When external ownership is active, the platform acts as the telephony and voice runtime.

Platform to external runtime:

- call lifecycle events
- caller metadata
- transcript deltas
- final transcript segments
- speaker turn changes
- silence and interruption markers
- optional memory context

External runtime to platform:

- readiness signal
- reply text
- optional structured actions
- optional control commands such as hangup or transfer
- heartbeat

In v1, the platform remains responsible for TTS. The external agent returns text, not raw audio.

## What the User Can Do in the Dashboard

### Workspace settings
This area contains overall workspace-level configuration such as name, branding, defaults, and global policies.

### Telephony settings
This area is used to connect and manage Twilio, configure phone numbers, and control inbound and outbound calling behavior.

### Conversation ownership settings
This is a key runtime settings area.

The admin can configure:

- `Default Conversation Owner`
- `Allow Inbound Calls To External Agent`
- inbound external webhook URL
- inbound external auth secret
- external readiness timeout
- fallback behavior

### AI provider settings
This area is used to connect OpenAI, xAI/Grok, and ElevenLabs, configure defaults, and test provider connections.

### Agent profiles
This area is used to create and manage AI phone agents for different purposes.

Examples:

- front desk agent
- appliance repair intake agent
- support follow-up agent
- billing reminder agent

### Prompt packs
This area is used to define how the AI should speak and behave in different contexts.

### Skill packs
This area is used to define task-specific behavior for business operations.

### Knowledge base
This area is used to upload and manage documents and reference content that the AI can use during calls.

### Memory settings
This area controls how caller and conversation memory works, how long it is retained, and what is extracted from calls.

### Data connectors
This area is used to connect internal or external business data sources the AI can reference through governed tools.

### API keys
This area is used to create and revoke MCP keys for external agents and systems.

### Calls and analytics
This area is used to review call history, listen to recordings, read transcripts, inspect summaries, analyze performance, and see which conversation ownership mode was used.

### Retention and webhooks
This area is used to control data retention and outbound event delivery to other systems.

### Audit logs
This area is used to review important changes to settings, credentials, API keys, and behavior definitions.

## How Call Review Works
Operators can open the calls list and filter by:

- date
- status
- direction
- caller
- phone number
- agent profile
- conversation ownership mode
- outcome

When they open a call detail page, they can:

- listen to the recording
- read the transcript
- read the generated summary
- view extracted action items
- inspect important call events
- review tool calls made during the conversation
- see escalation events
- inspect QA and analytics
- see prior interactions for the same caller
- see whether internal or external runtime owned the call
- see fallback reason if an inbound external handoff failed

This creates a full operational view of how the call was handled.

## How Recordings and Transcripts Are Used
Every completed call can produce:

- a recording reference
- a transcript
- a summary
- extracted facts
- QA analysis
- memory updates

Users should be able to:

- play the recording from the dashboard
- review the transcript line by line
- search for keywords
- compare recent calls from the same caller
- use analytics to improve prompts and skills
- understand whether the call was run by the internal or external agent

## Typical User Flows

### 1. New workspace onboarding
The user creates a workspace, signs in, and enters the dashboard.

### 2. Connect telephony and providers
The user connects Twilio, then adds OpenAI, xAI/Grok if desired, and ElevenLabs.

### 3. Create the first agent profile
The user creates an AI phone agent with name, company identity, voice, and language settings.

### 4. Add prompts, skills, and knowledge
The user uploads documents, adds operational instructions, and attaches skill packs such as appliance repair intake or rescheduling.

### 5. Choose conversation ownership
The user chooses whether live calls should be handled primarily by the internal platform agent or by an external calling agent.

### 6. Enable inbound external handoff if needed
The user optionally enables inbound external handoff and configures webhook, auth, timeout, and fallback settings.

### 7. Start an outbound call through MCP
The user asks ChatGPT or another MCP-capable agent to call a customer using the platform.

### 8. Review the finished call
The user opens the call detail page, listens to the recording, reads the transcript, and checks the summary and analytics.

### 9. Improve the system
If call quality was poor, the user updates prompt packs, skill packs, knowledge sources, escalation rules, or ownership settings and tries again.

## Example: Appliance Repair Usage
An appliance repair company can configure the system so the AI:

- answers as the company receptionist
- recognizes existing customers from prior calls
- asks what appliance is broken
- asks what the issue is
- references pricing and diagnostic fee policies
- checks internal knowledge about typical appliance issues
- schedules or follows up when allowed
- escalates billing complaints or complex disputes to a human

The same company can also choose:

- internal ownership for a fully platform-run receptionist
- external ownership for a custom ChatGPT or Claude-powered dialogue runtime
- inbound external handoff for advanced real-time integration

This behavior should come from configuration, not from custom code for a single vertical.

## Analytics and Quality Assurance
The platform is not only for live calls. It also analyzes them afterward.

The system should support:

- summary generation
- action item extraction
- sentiment or quality flags
- QA scorecards
- trend reporting
- review workflows for operators
- insights for improving prompts, skills, and knowledge
- visibility into internal vs external ownership performance

This helps teams continuously improve how their AI phone system performs.

## Security and SaaS Model
The product is designed as a multi-tenant SaaS.

Important behaviors:

- each workspace is isolated from others
- provider credentials are stored securely
- MCP API keys are managed per workspace
- data access is controlled by roles
- call artifacts stay within workspace boundaries
- audit logs track important changes
- external inbound handoff uses signed webhook requests and one-time session tokens

## What Makes This Product Different
- It works both as an MCP capability and as an autonomous AI phone operator.
- It supports configurable conversation ownership between internal and external agents.
- It can hand inbound calls to an external agent in real time through webhook and WebSocket.
- It is configured through prompts, skills, knowledge, and memory rather than hardcoded flows.
- It can remember prior callers and continue context.
- It supports real business workflows, not just simple voice demos.
- It gives operators a full post-call review and improvement loop.

## Pricing Model

### Free Tier
50 minutes per month for testing and setup. Does not include advanced analytics, QA, or external agent handoff.

### Paid Plans
| Plan | Price | Minutes | Best For |
|------|-------|---------|----------|
| Free | $0/mo | 50 | Testing, setup |
| Starter | $49/mo | 500 | Small business, 1-2 agents |
| Growth | $149/mo | 2000 | Growing business, analytics, QA |
| Business | $399/mo | 6000 | Scale operations, external handoff |

Overage: $0.10-0.15/min depending on plan.

All provider costs (Twilio, STT, LLM, TTS) are included in the plan price. Clients connect their own API keys (BYO keys model).

## How the Voice Pipeline Works

### Single Turn Flow
1. Caller speaks into the phone
2. Twilio streams audio to the platform via WebSocket (MediaStream)
3. Platform sends audio to STT provider (streaming)
4. STT returns recognized text (partial → final)
5. Final text is sent to LLM with context (behavior stack, memory, history)
6. LLM generates response (streaming)
7. Response text is sent to TTS provider (streaming)
8. TTS returns audio chunks
9. Platform plays audio back into the call via Twilio

### Target Latency
Full cycle from caller finishing a phrase to AI starting to speak: < 1 second (target), < 1.8 seconds (max).

If response is delayed beyond 1.5 seconds, platform auto-inserts a filler phrase ("One moment...", "Let me check...").

### Providers
- **STT**: Deepgram Nova-2 (primary), OpenAI Whisper (fallback)
- **LLM**: Claude Sonnet (primary), GPT-4o-mini (economy), xAI Grok (optional)
- **TTS**: ElevenLabs (premium), OpenAI TTS (economy fallback)

Providers are selected per Agent Profile. Each component has primary and fallback.

### Interruption Handling
When the caller starts speaking during AI response:
1. TTS playback stops immediately
2. Platform starts listening to the new speaker
3. New phrase is processed as the next turn

## How Onboarding Works

### Target
Under 15 minutes from signup to first test call.

### Steps
1. **Create Workspace** — company name, industry, languages
2. **Connect Twilio** — guided setup with step-by-step instructions
3. **Connect AI Provider** — enter OpenAI API key, verify connection
4. **Create First Agent** — pick industry template or start from scratch
5. **Test Call** — platform calls the user, they talk to the AI, see transcript and summary

### Industry Templates
When an industry is selected, the platform offers a pre-built set: prompt pack, skill packs, knowledge base template, and voice recommendations.

## FixarCRM Integration

### What It Provides
Caller connects to FixarCRM as a data connector, allowing the AI to access CRM data during calls.

During a call, the AI can:
- Look up customers by phone number
- View visit and estimate history
- Create new visits or update existing ones
- Add timeline notes
- Check payment status

### Ready-Made Appliance Repair Templates
- **Prompt Pack**: "Appliance Repair Front Desk"
- **Skill Pack**: "Intake" — collect appliance details and symptoms
- **Skill Pack**: "Scheduling" — book visits via FixarCRM
- **Skill Pack**: "Follow-Up" — post-service call
- **Skill Pack**: "Payment Reminder"
- **Knowledge Base**: common issues, pricing, service area

## Compliance

### Call Recording
- Configurable disclosure prompt per workspace (default: enabled)
- Supports two-party consent requirements
- AI discloses recording at call start

### AI Disclosure
- AI identifies itself as an AI assistant (never impersonates a human)

### Data Retention
- Configurable per workspace
- Default: recordings 90 days, transcripts 1 year
- GDPR-ready: data deletion on request

## v1 Scope and Limits
The first version is expected to focus on:

- B2B SaaS
- SMB service businesses
- inbound and outbound calling
- BYO Twilio
- OpenAI as primary AI gateway
- xAI/Grok as optional LLM
- ElevenLabs for voice
- English and Russian support
- dashboard-based configuration
- MCP runtime usage for external agents
- workspace-level conversation ownership settings
- webhook + WebSocket external inbound handoff

Items likely deferred or simplified in v1:

- advanced CRM integrations beyond webhooks
- enterprise SSO
- strict regulated-industry compliance targets
- large-scale campaign management
- very broad multilingual optimization
- mid-call ownership switching after a conversation has already started

## Summary
This product is a configurable AI phone-agent platform that lets businesses and external AI agents use phone calling as an intelligent, memory-backed, knowledge-driven capability. It combines telephony, MCP access, prompts, skills, knowledge, memory, conversation ownership controls, analytics, and operator tooling into one SaaS platform so businesses can create truly smart voice agents without hardcoded business logic.
