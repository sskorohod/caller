export interface DocSection {
  id: string;
  title: string;
  icon: string;
  articles: DocArticle[];
}

export interface DocArticle {
  id: string;
  title: string;
  content: string;
}

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'rocket_launch',
    articles: [
      {
        id: 'quick-start',
        title: 'Quick Start',
        content: `# Quick Start

Welcome to **Caller** — the AI phone agent platform built for modern businesses. In minutes you can deploy voice agents that handle inbound and outbound calls, and a live translator that joins any phone conversation to bridge language barriers.

## What Caller Does

Caller combines two products in one platform:

- **AI Phone Agents** — Autonomous voice agents powered by Claude, GPT-4o, or Grok. They answer calls, follow your scripts, access your knowledge base, and hand off to humans when needed.
- **Live Translator** — A real-time voice translation service that merges into any active phone call and translates speech between language pairs with sub-second latency.

## Quick Start in 3 Steps

1. **Sign up** — Create your account at caller.n8nskorx.top. You'll receive free trial credit — no credit card required.
2. **Create your first agent** — Go to **Agents → New Agent**. Give it a name, write a system prompt, pick a voice, and assign a phone number.
3. **Make your first call** — Navigate to **Calls → New Call**, select your agent, enter a phone number, and click **Call**. Within seconds your agent is live.

## Two Products, One Platform

### AI Phone Agents

Configure autonomous voice agents for any scenario:

- Customer support and FAQ answering
- Sales outreach and lead qualification
- Appointment reminders and scheduling
- Receptionist and call routing

### Live Translator

Bridge language gaps on any call:

- Merge the translator into an active call via conference
- Choose from 15+ language pairs
- Select tone: professional, friendly, medical, legal, and more
- Works with any existing phone number — no setup required

> **Tip:** Start with the AI Agents product to automate routine calls, then add Live Translator for international customer interactions.
`,
      },
      {
        id: 'creating-your-account',
        title: 'Creating Your Account',
        content: `# Creating Your Account

Getting started with Caller takes less than two minutes.

## Sign Up Process

1. Go to [caller.n8nskorx.top/login](https://caller.n8nskorx.top/login?mode=register)
2. Click **Create account**
3. Enter your email address and choose a secure password
4. Check your inbox for the verification email and click the link
5. You're in — your workspace is created automatically

## Email Verification

After registering, you'll receive a verification email from Caller. Click the link within 24 hours to activate your account. If you don't see it, check your spam folder or use the **Resend verification** option on the login screen.

## Choosing a Plan

Caller offers three subscription tiers:

| Plan | AI Agents | MCP API | Live Translator | Best For |
|---|---|---|---|---|
| **Translator** | — | — | Yes | Teams needing real-time interpretation |
| **Agents** | Yes | — | — | Businesses automating phone workflows |
| **Agents + MCP** | Yes | Yes | — | Developers integrating via Claude Desktop |

All plans include:
- Free trial credit on signup
- Access to the dashboard
- Call recording and transcription
- Bring Your Own Keys (BYOK) support

## Trial Period

Every new account receives **free deposit credit** to explore the platform:

- Make real calls with AI agents
- Test the live translator
- Try different voices and models

No credit card is required during the trial. When your credit runs out, simply add a deposit to continue.

> **Note:** Trial credit does not expire. Take your time exploring the platform before committing to a paid plan.
`,
      },
      {
        id: 'your-first-agent',
        title: 'Your First Agent',
        content: `# Your First Agent

This guide walks you through creating and configuring your first AI phone agent.

## Step 1 — Create a New Agent

1. In the dashboard, go to **Agents** in the sidebar
2. Click **New Agent** (top right)
3. Enter a descriptive name — e.g., "Support Agent" or "Sales Bot"

## Step 2 — Write the System Prompt

The system prompt defines your agent's personality, knowledge, and behavior. Think of it as your agent's instruction manual.

**Good system prompt example:**

\`\`\`
You are a friendly customer support agent for Acme Corp. Your job is to help customers with order questions, returns, and product information.

Always greet the caller by name if they provide it. Keep responses concise — this is a phone call, not a chat. If you don't know the answer, offer to connect the caller with a human agent.

Business hours: Monday–Friday, 9am–6pm EST.
Return policy: 30 days, receipt required.
\`\`\`

## Step 3 — Choose a Voice

Select the voice your agent will use:

- **xAI Grok TTS** (recommended) — Natural, expressive voice with low latency
- **OpenAI TTS** — Multiple voice options (alloy, echo, fable, onyx, nova, shimmer)
- **ElevenLabs** — Ultra-realistic cloned voices, requires your own ElevenLabs API key

## Step 4 — Select an LLM Model

| Model | Best For | Speed | Cost |
|---|---|---|---|
| **Claude Sonnet** | Complex reasoning, nuanced conversations | Fast | Moderate |
| **GPT-4o-mini** | High-volume, simple queries | Very fast | Low |
| **GPT-4o** | Advanced tasks, longer context | Moderate | Higher |

## Step 5 — Assign a Phone Number

1. Go to **Settings → Phone Numbers**
2. Connect your Twilio account (or use a platform number)
3. Return to your agent settings and assign the number
4. Set whether the number handles **inbound**, **outbound**, or **both**

## Step 6 — Save and Test

Click **Save Agent**. Your agent is now live. Test it by calling the assigned number or using the **Test Call** button in the dashboard.

> **Tip:** Start with a simple greeting and FAQ setup. Add complexity (knowledge base, skills) once the basics are working.
`,
      },
      {
        id: 'your-first-call',
        title: 'Your First Call',
        content: `# Your First Call

Once your agent is configured, it's time to make your first call.

## Making an Outbound Call

1. Navigate to **Calls → New Call** in the dashboard
2. Select the agent you want to use
3. Enter the destination phone number in E.164 format (e.g., \`+14155552671\`)
4. Add an optional call note — this is passed to the agent as context
5. Click **Start Call**

The call will appear in your call list with status **In Progress**. Click on it to watch the live transcript as the conversation unfolds.

## Setting Up Inbound Calls

For your agent to receive inbound calls:

1. Go to **Settings → Phone Numbers**
2. Select the number you want to use
3. Set **Direction** to **Inbound** or **Both**
4. Assign your agent to that number
5. Twilio will route all incoming calls to your agent automatically

## Testing Your Agent

Use the **Test Call** feature to call your own phone number:

1. Open the agent detail page
2. Click **Test Call**
3. Enter your phone number
4. Your phone will ring — answer it to hear the agent

This lets you experience exactly what your customers will hear.

## Understanding Call Logs

Every call creates a detailed record in **Calls → History**:

| Field | Description |
|---|---|
| **Duration** | Total call length in seconds |
| **Status** | Completed, Failed, No Answer, Busy |
| **Transcript** | Full word-by-word conversation log |
| **Summary** | AI-generated call summary |
| **Cost** | Exact cost billed to your account |
| **Recording** | Audio playback (if recording enabled) |

## Reading Transcripts

Transcripts show speaker labels:

\`\`\`
[Agent]  Hello, thank you for calling Acme Support. How can I help you today?
[Caller] Hi, I have a question about my order.
[Agent]  Of course! Could you share your order number?
\`\`\`

Transcripts are searchable and exportable from the call detail page.

> **Tip:** Enable **Call Recording** in agent settings to capture audio alongside transcripts. Recordings are stored securely and accessible from the call history.
`,
      },
    ],
  },
  {
    id: 'user-guide',
    title: 'User Guide',
    icon: 'menu_book',
    articles: [
      {
        id: 'agent-configuration',
        title: 'Agent Configuration',
        content: `# Agent Configuration

A deep dive into every setting available for your AI phone agents.

## Basic Settings

| Setting | Description |
|---|---|
| **Name** | Internal identifier for the agent. Not spoken aloud. |
| **Description** | Optional note for your team about this agent's purpose. |
| **Active** | Toggle to enable/disable the agent without deleting it. |

## System Prompt

The system prompt is the core of your agent's behavior. It runs before every conversation.

**Best practices:**

- State the agent's role and company clearly
- Define what topics it can and cannot discuss
- Include key business info (hours, policies, contacts)
- Specify tone: formal, friendly, empathetic, etc.
- Tell the agent what to do when it can't answer

**Example prompt structure:**
\`\`\`
You are [Name], a [role] for [Company].

Your responsibilities:
- [Task 1]
- [Task 2]

Important policies:
- [Policy 1]
- [Policy 2]

If you cannot help, say: "[Handoff phrase]"
\`\`\`

## Greeting Message

The greeting is spoken immediately when a call connects, before the agent listens for input.

- Keep it under 15 seconds when read aloud
- Include the company name and agent identity
- Example: *"Thank you for calling Acme Support. I'm an AI assistant. How can I help you today?"*

## Voice Selection

### xAI Grok TTS (Primary)
Ultra-low latency, natural-sounding synthesis. Best for real-time conversations.

### OpenAI TTS
Six voice options available:

| Voice | Character |
|---|---|
| alloy | Neutral, versatile |
| echo | Male, clear |
| fable | Warm, storytelling |
| onyx | Deep, authoritative |
| nova | Female, energetic |
| shimmer | Soft, friendly |

### ElevenLabs
Requires your own ElevenLabs API key in Settings → Providers. Supports cloned and custom voices.

## LLM Model

| Model | Context Window | Best For |
|---|---|---|
| **Claude Sonnet** | 200K tokens | Complex reasoning, long calls |
| **GPT-4o** | 128K tokens | Advanced tasks |
| **GPT-4o-mini** | 128K tokens | High volume, simple queries |

### Advanced LLM Settings

- **Temperature** (0.0–1.0): Controls randomness. Lower values (0.2–0.4) make responses more predictable. Higher values (0.7–0.9) make them more creative.
- **Max Tokens**: Maximum length of each agent response. 150–300 is appropriate for phone calls.
- **Top P**: Nucleus sampling parameter. Leave at default (1.0) unless you have specific tuning needs.

## Silence Timeout

How long the agent waits for the caller to speak before prompting again. Default: 3 seconds.

## Max Call Duration

Hard limit on call length to prevent runaway costs. Default: 30 minutes. Set to 0 for unlimited.
`,
      },
      {
        id: 'knowledge-base',
        title: 'Knowledge Base',
        content: `# Knowledge Base

The Knowledge Base lets your agents access company-specific information during calls using Retrieval-Augmented Generation (RAG).

## Supported File Formats

| Format | Max Size | Notes |
|---|---|---|
| **PDF** | 25 MB | Text extracted automatically |
| **TXT** | 5 MB | Plain text, UTF-8 |
| **MD** | 5 MB | Markdown formatting preserved |
| **DOCX** | 10 MB | Microsoft Word documents |

## Uploading Documents

1. Navigate to **Knowledge Base** in the sidebar
2. Click **Upload Document**
3. Select your file(s) — multiple files supported
4. Add an optional description for each document
5. Click **Process** — indexing takes 10–60 seconds depending on file size

## How RAG Works

When a caller asks a question, the system:

1. Converts the caller's query into a semantic embedding
2. Searches your knowledge base for the most relevant passages (top 5 by default)
3. Injects those passages into the agent's context window
4. The agent uses that context to answer accurately

This means your agent always has access to your latest documentation without retraining.

## Managing Knowledge Base Entries

From the Knowledge Base page you can:

- **View** — See all uploaded documents with status and last updated date
- **Preview** — Read the extracted text to verify it was parsed correctly
- **Re-index** — Force re-processing if the document content changed
- **Delete** — Remove documents that are no longer relevant

## Per-Agent Knowledge Base

By default, all agents in a workspace share the same knowledge base. You can restrict access:

1. Open an agent's settings
2. Under **Knowledge Base**, select **Custom selection**
3. Choose which documents this agent can access

## Tips for Better Results

- Keep documents focused — separate product docs from support docs
- Use clear headings and section titles — they help with retrieval accuracy
- Update documents when policies change — stale info will be cited incorrectly
- Test by asking your agent questions and checking the transcript for accuracy

> **Tip:** For FAQs, format them as question-answer pairs. The similarity search works best when document chunks closely match how callers phrase their questions.
`,
      },
      {
        id: 'skills-and-prompt-packs',
        title: 'Skills & Prompt Packs',
        content: `# Skills & Prompt Packs

Skills and Prompt Packs are pre-built configurations that extend your agent's capabilities without manual setup.

## What Are Skills?

Skills give your agent the ability to take specific actions during a call.

| Skill | Description |
|---|---|
| **Transfer Call** | Warm or cold transfer to another phone number or agent |
| **Take Message** | Collect caller name, phone number, and message; send summary via webhook |
| **Schedule Appointment** | Integrate with calendar to book slots (requires calendar webhook) |
| **Collect Information** | Structured data collection with validation (name, email, order number) |
| **Send SMS** | Send a follow-up text to the caller after the call |
| **Escalate to Human** | Detect escalation intent and connect to a live agent queue |

## Assigning Skills to an Agent

1. Open your agent in the dashboard
2. Go to the **Skills** tab
3. Toggle on the skills you want to enable
4. Configure each skill's parameters (e.g., transfer destination number)
5. Save the agent

## What Are Prompt Packs?

Prompt Packs are curated system prompt templates for common business scenarios. Instead of writing a prompt from scratch, start with a pack and customize it.

| Pack | Use Case |
|---|---|
| **Customer Support** | FAQ handling, ticket creation, escalation |
| **Sales Outreach** | Lead qualification, product presentation, objection handling |
| **Receptionist** | Call routing, message taking, company information |
| **Appointment Reminder** | Automated reminders, confirmation, rescheduling |
| **Debt Collection** | Compliant outreach, payment plans, dispute handling |
| **Healthcare Intake** | Patient information collection, appointment booking |
| **Survey** | Multi-step questionnaire with response logging |

## Applying a Prompt Pack

1. Create a new agent or open an existing one
2. Click **Load Prompt Pack**
3. Browse the pack library and preview the system prompt
4. Click **Apply** — the prompt is loaded into the system prompt editor
5. Customize for your specific business before saving

> **Note:** Prompt Packs provide a starting point. Always review and tailor the prompt to include your company name, specific policies, and contact details before going live.
`,
      },
      {
        id: 'phone-numbers',
        title: 'Phone Numbers',
        content: `# Phone Numbers

Caller uses Twilio for telephony. You can connect your own Twilio account or use platform-managed numbers.

## Connecting Your Twilio Account

1. Go to **Settings → Providers**
2. Under **Telephony**, click **Connect Twilio**
3. Enter your Twilio **Account SID** and **Auth Token**
4. Click **Verify** — Caller will test the connection
5. Your Twilio numbers will appear in **Settings → Phone Numbers** automatically

> **Security:** Your credentials are encrypted with AES-256-GCM and never stored in plaintext.

## Buying a New Number

1. Go to **Settings → Phone Numbers → Buy Number**
2. Select country and area code
3. Filter by capability: Voice, SMS, or both
4. Click **Buy** — the number is provisioned instantly via Twilio
5. Cost is charged to your Twilio account (not your Caller deposit)

## Porting an Existing Number

Number porting is handled through Twilio directly:

1. Submit a port request in your Twilio console
2. Once the number appears in your Twilio account, it will sync to Caller
3. Assign it to an agent from **Settings → Phone Numbers**

## Assigning Numbers to Agents

1. Navigate to **Settings → Phone Numbers**
2. Click on a number to open its settings
3. Set **Direction**: Inbound / Outbound / Both
4. Assign an **Agent** from the dropdown
5. Save

For **inbound** numbers, Caller automatically configures the Twilio webhook to route calls to the assigned agent.

## Inbound Call Routing

When a call comes in to an assigned number:

1. Twilio sends a webhook to Caller
2. Caller identifies the agent assigned to that number
3. A WebSocket stream is opened between Twilio and Caller's voice pipeline
4. The agent's greeting plays immediately
5. The conversation begins

## Multiple Numbers, One Agent

An agent can be assigned to multiple phone numbers. This is useful for regional numbers routing to the same support agent.

## Number Status

| Status | Meaning |
|---|---|
| **Active** | Number is assigned and ready |
| **Unassigned** | Number exists but no agent is set |
| **Inactive** | Agent is disabled or number is suspended |
`,
      },
      {
        id: 'live-translator',
        title: 'Live Translator',
        content: `# Live Translator

Live Translator merges into an active phone call and translates speech in real time between two parties speaking different languages.

## How It Works

1. You're on a phone call with a caller who speaks a different language
2. Open the Caller dashboard on your phone or computer
3. Tap **Start Translation** — Caller creates a conference call bridge
4. Both you and the original caller are merged into the conference
5. Caller's AI translates each speaker's words and plays the translation to the other party in real time

The caller hears your translated words in their language. You hear their words translated into yours. The latency is typically under 1 second.

## Language Pairs

Caller supports 15+ language pairs including:

- English ↔ Spanish
- English ↔ French
- English ↔ German
- English ↔ Portuguese
- English ↔ Italian
- English ↔ Japanese
- English ↔ Chinese (Mandarin)
- English ↔ Korean
- English ↔ Arabic
- English ↔ Russian
- Spanish ↔ French
- Spanish ↔ Portuguese

Language detection is automatic — Caller identifies the speaker's language and routes to the correct translation model.

## Tones of Voice

Configure the translation tone to match your business context:

| Tone | Best For |
|---|---|
| **Professional** | Business calls, client meetings |
| **Friendly** | Customer support, retail |
| **Casual** | Informal conversations |
| **Formal** | Legal, government, contracts |
| **Medical** | Healthcare, clinical settings |
| **Legal** | Legal consultations, depositions |

## Voice Selection for Translation

Choose the voice used to speak translations:

- **xAI Grok TTS** — Natural, low-latency (recommended)
- **OpenAI TTS** — Multiple character options
- **ElevenLabs** — Ultra-realistic (requires your ElevenLabs key)

## Telegram Integration

Caller can send translation session summaries to a Telegram bot:

1. Go to **Settings → Integrations → Telegram**
2. Create a bot via [@BotFather](https://t.me/BotFather) and paste the token
3. Enter your chat ID
4. Enable **Send session summary after each translation**

After each translation session you'll receive a message with the full transcript, duration, and detected language pair.

## Billing

Live Translator usage is billed per minute of active translation:

- Platform TTS and STT costs deducted from your deposit
- If you use your own API keys for Deepgram and xAI, those costs go directly to your accounts
- Session logs show exact cost breakdown per call
`,
      },
      {
        id: 'billing-and-deposits',
        title: 'Billing & Deposits',
        content: `# Billing & Deposits

Caller uses a deposit-based billing model. You pre-load credits that are consumed as you use the platform.

## How Deposits Work

1. Go to **Settings → Billing**
2. Click **Add Deposit**
3. Enter an amount (minimum $10) and complete payment via Stripe
4. Credits appear in your account immediately

Usage costs are deducted from your deposit in real time as calls are made.

## BYOK vs Platform Credentials

You can mix and match your own API keys with platform-managed providers:

### Bring Your Own Keys (BYOK)

Connect your own API keys for any provider in **Settings → Providers**:

| Provider | Key Used For | Cost Impact |
|---|---|---|
| **Twilio** | Phone calls, SMS | Pay Twilio directly, $0 to Caller |
| **Anthropic** | Claude LLM | Pay Anthropic directly |
| **OpenAI** | GPT models, TTS, Whisper | Pay OpenAI directly |
| **Deepgram** | Speech-to-text | Pay Deepgram directly |
| **ElevenLabs** | TTS voices | Pay ElevenLabs directly |
| **xAI** | Grok TTS | Pay xAI directly |

### Platform Credentials

If you don't connect your own keys, Caller uses its pooled credentials and bills the usage to your deposit at transparent rates.

You can mix: use your own Twilio but platform Claude, for example.

## Usage Dashboard

Navigate to **Settings → Billing → Usage** to see:

- Cost per call (itemized: STT, LLM, TTS, telephony)
- Daily and monthly spend breakdown
- Provider-level cost attribution
- Estimated remaining credit at current usage rate

## Subscription Plans

| Feature | Translator | Agents | Agents + MCP |
|---|---|---|---|
| Monthly fee | $29 | $49 | $79 |
| AI Agents | — | Unlimited | Unlimited |
| MCP API access | — | — | Yes |
| Live Translator | Yes | — | Yes |
| Support | Email | Email | Priority |

## Low Balance Alerts

Enable email alerts when your deposit drops below a threshold:

1. Go to **Settings → Billing → Alerts**
2. Set a minimum balance threshold (e.g., $10)
3. Caller sends an email when balance falls below that amount

> **Tip:** Enable auto-recharge to automatically top up your deposit when it runs low, ensuring uninterrupted service.
`,
      },
    ],
  },
  {
    id: 'api-reference',
    title: 'API Reference',
    icon: 'code',
    articles: [
      {
        id: 'authentication',
        title: 'Authentication',
        content: `# Authentication

Caller uses API keys for all API and MCP access. Keys are created per-workspace and scoped to specific permissions.

## Creating an API Key

1. Go to **Settings → API Keys**
2. Click **Create New Key**
3. Enter a name (e.g., "Production", "n8n Integration")
4. Select permissions: Read, Write, or Admin
5. Copy the key immediately — it is only shown once

API keys follow the format: \`mcp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\`

## Using API Keys

Include the key in the \`Authorization\` header of every request:

\`\`\`
Authorization: Bearer mcp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
\`\`\`

**Example with curl:**
\`\`\`
curl https://caller.n8nskorx.top/api/agents \\
  -H "Authorization: Bearer mcp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json"
\`\`\`

## Key Permissions

| Permission | Can Do |
|---|---|
| **Read** | List and view agents, calls, transcripts, knowledge base |
| **Write** | Create/update agents, initiate calls, upload documents |
| **Admin** | All of the above + manage API keys, billing, providers |

## Rate Limits

| Endpoint Group | Limit |
|---|---|
| GET requests | 120 requests/minute |
| POST /calls/outbound | 30 calls/minute |
| POST /knowledge/upload | 10 uploads/minute |
| All other POST/PUT/DELETE | 60 requests/minute |

Rate limit headers are included in every response:

\`\`\`
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 1712345678
\`\`\`

## Error Codes

| Code | Meaning |
|---|---|
| \`401\` | Missing or invalid API key |
| \`403\` | Insufficient permissions |
| \`422\` | Validation error — check request body |
| \`429\` | Rate limit exceeded |
| \`500\` | Internal server error |

All errors return a JSON body:

\`\`\`
{
  "error": "unauthorized",
  "message": "Invalid or expired API key"
}
\`\`\`

## Security

- API keys are stored as SHA-256 hashes. The plaintext key cannot be recovered if lost.
- Keys can be revoked at any time from **Settings → API Keys → Revoke**.
- All API traffic is encrypted via TLS 1.3.
`,
      },
      {
        id: 'agents-api',
        title: 'Agents API',
        content: `# Agents API

Manage your AI phone agents programmatically.

## List Agents

\`\`\`
GET /api/agents
\`\`\`

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| \`page\` | number | Page number (default: 1) |
| \`limit\` | number | Results per page (default: 20, max: 100) |
| \`active\` | boolean | Filter by active status |

**Response:**
\`\`\`
{
  "data": [
    {
      "id": "agt_01hx8k3m9p2q4r5s6t7u8v9w",
      "name": "Support Agent",
      "description": "Handles tier-1 customer support",
      "active": true,
      "voice_provider": "xai",
      "voice_id": "grok-tts-1",
      "llm_model": "claude-sonnet-4-5",
      "phone_numbers": ["+14155552671"],
      "created_at": "2025-03-15T10:23:00Z",
      "updated_at": "2025-04-01T08:00:00Z"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 20
}
\`\`\`

## Create Agent

\`\`\`
POST /api/agents
\`\`\`

**Request body:**
\`\`\`
{
  "name": "Sales Agent",
  "description": "Outbound sales qualification agent",
  "system_prompt": "You are a sales development representative for Acme Corp...",
  "greeting": "Hi, this is Alex calling from Acme. Is now a good time?",
  "voice_provider": "openai",
  "voice_id": "nova",
  "llm_model": "gpt-4o-mini",
  "temperature": 0.4,
  "max_tokens": 200,
  "active": true
}
\`\`\`

**Response:** \`201 Created\`
\`\`\`
{
  "id": "agt_02ix9l4n0q3r5s6t7u8v9w0x",
  "name": "Sales Agent",
  "active": true,
  "created_at": "2025-04-12T14:30:00Z"
}
\`\`\`

## Get Agent

\`\`\`
GET /api/agents/:id
\`\`\`

Returns the full agent object including system prompt and all settings.

## Update Agent

\`\`\`
PUT /api/agents/:id
\`\`\`

Send only the fields you want to update (partial update supported):

\`\`\`
{
  "active": false,
  "temperature": 0.3
}
\`\`\`

**Response:** \`200 OK\` with the updated agent object.

## Delete Agent

\`\`\`
DELETE /api/agents/:id
\`\`\`

**Response:** \`204 No Content\`

> **Warning:** Deleting an agent is permanent. Call history is preserved, but the agent cannot be recovered.

## Agent Object Reference

| Field | Type | Description |
|---|---|---|
| \`id\` | string | Unique agent identifier |
| \`name\` | string | Display name |
| \`system_prompt\` | string | LLM instruction prompt |
| \`greeting\` | string | First words spoken on call |
| \`voice_provider\` | string | \`xai\`, \`openai\`, \`elevenlabs\` |
| \`voice_id\` | string | Provider-specific voice identifier |
| \`llm_model\` | string | LLM model slug |
| \`temperature\` | number | 0.0–1.0 |
| \`max_tokens\` | number | Max response length |
| \`active\` | boolean | Whether agent accepts calls |
`,
      },
      {
        id: 'calls-api',
        title: 'Calls API',
        content: `# Calls API

Initiate outbound calls and retrieve call history and transcripts.

## Initiate Outbound Call

\`\`\`
POST /api/calls/outbound
\`\`\`

**Request body:**
\`\`\`
{
  "agent_id": "agt_01hx8k3m9p2q4r5s6t7u8v9w",
  "to": "+14155552671",
  "from": "+12025551234",
  "metadata": {
    "customer_id": "cust_789",
    "campaign": "Q2-outreach"
  },
  "context": "Caller is a returning customer who purchased the Pro plan in January."
}
\`\`\`

| Field | Required | Description |
|---|---|---|
| \`agent_id\` | Yes | ID of the agent to handle the call |
| \`to\` | Yes | Destination phone number (E.164) |
| \`from\` | No | Caller ID to display (must be a verified Twilio number) |
| \`metadata\` | No | Arbitrary key-value pairs attached to call record |
| \`context\` | No | Additional context injected into the agent's prompt |

**Response:** \`202 Accepted\`
\`\`\`
{
  "call_id": "cal_03jy0m5o1r4s6t7u8v9w0x1y",
  "status": "queued",
  "agent_id": "agt_01hx8k3m9p2q4r5s6t7u8v9w",
  "to": "+14155552671",
  "created_at": "2025-04-12T14:45:00Z"
}
\`\`\`

## List Calls

\`\`\`
GET /api/calls
\`\`\`

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| \`agent_id\` | string | Filter by agent |
| \`status\` | string | \`completed\`, \`failed\`, \`in-progress\` |
| \`from_date\` | ISO 8601 | Start of date range |
| \`to_date\` | ISO 8601 | End of date range |
| \`page\` | number | Page number |
| \`limit\` | number | Results per page (max: 100) |

**Response:**
\`\`\`
{
  "data": [
    {
      "id": "cal_03jy0m5o1r4s6t7u8v9w0x1y",
      "agent_id": "agt_01hx8k3m9p2q4r5s6t7u8v9w",
      "direction": "outbound",
      "status": "completed",
      "to": "+14155552671",
      "duration_seconds": 147,
      "cost_usd": 0.0412,
      "created_at": "2025-04-12T14:45:00Z",
      "ended_at": "2025-04-12T14:47:27Z"
    }
  ],
  "total": 248,
  "page": 1,
  "limit": 20
}
\`\`\`

## Get Call Details

\`\`\`
GET /api/calls/:id
\`\`\`

Returns full call record including transcript:

\`\`\`
{
  "id": "cal_03jy0m5o1r4s6t7u8v9w0x1y",
  "status": "completed",
  "duration_seconds": 147,
  "cost_usd": 0.0412,
  "transcript": [
    {
      "speaker": "agent",
      "text": "Hello, this is Alex from Acme. Is now a good time?",
      "timestamp_ms": 1200
    },
    {
      "speaker": "caller",
      "text": "Sure, what's this about?",
      "timestamp_ms": 4800
    }
  ],
  "summary": "Caller expressed interest in upgrading from Starter to Pro plan. Follow-up scheduled for Thursday.",
  "recording_url": "https://api.twilio.com/recordings/RE...",
  "metadata": {
    "customer_id": "cust_789",
    "campaign": "Q2-outreach"
  }
}
\`\`\`

## Call Statuses

| Status | Description |
|---|---|
| \`queued\` | Call accepted, waiting to dial |
| \`ringing\` | Destination phone is ringing |
| \`in-progress\` | Call connected, agent is active |
| \`completed\` | Call ended normally |
| \`no-answer\` | Destination did not answer |
| \`busy\` | Destination line is busy |
| \`failed\` | Call could not be placed |
`,
      },
      {
        id: 'knowledge-base-api',
        title: 'Knowledge Base API',
        content: `# Knowledge Base API

Upload and manage documents in your agent's knowledge base.

## Upload Document

\`\`\`
POST /api/knowledge/upload
Content-Type: multipart/form-data
\`\`\`

Use multipart form upload to send the file:

\`\`\`
curl https://caller.n8nskorx.top/api/knowledge/upload \\
  -H "Authorization: Bearer mcp_xxxx..." \\
  -F "file=@product-manual.pdf" \\
  -F "name=Product Manual v3" \\
  -F "description=Complete product documentation for support agents"
\`\`\`

**Form fields:**

| Field | Required | Description |
|---|---|---|
| \`file\` | Yes | File to upload (PDF, TXT, MD, DOCX) |
| \`name\` | No | Display name (defaults to filename) |
| \`description\` | No | Optional description for team reference |

**Response:** \`202 Accepted\`
\`\`\`
{
  "id": "kb_04kz1n6p2s5t7u8v9w0x1y2z",
  "name": "Product Manual v3",
  "status": "processing",
  "file_size_bytes": 1248302,
  "created_at": "2025-04-12T15:00:00Z"
}
\`\`\`

Processing typically completes within 30–60 seconds. Poll the GET endpoint to check status.

## List Documents

\`\`\`
GET /api/knowledge
\`\`\`

**Response:**
\`\`\`
{
  "data": [
    {
      "id": "kb_04kz1n6p2s5t7u8v9w0x1y2z",
      "name": "Product Manual v3",
      "description": "Complete product documentation",
      "status": "ready",
      "file_type": "pdf",
      "file_size_bytes": 1248302,
      "chunk_count": 142,
      "created_at": "2025-04-12T15:00:00Z",
      "updated_at": "2025-04-12T15:01:03Z"
    }
  ],
  "total": 8
}
\`\`\`

## Document Status

| Status | Description |
|---|---|
| \`processing\` | File is being parsed and indexed |
| \`ready\` | Document is indexed and available to agents |
| \`failed\` | Processing failed — check the \`error\` field |

## Delete Document

\`\`\`
DELETE /api/knowledge/:id
\`\`\`

**Response:** \`204 No Content\`

The document is removed from the index immediately. Active calls are not affected, but subsequent calls will no longer have access to the deleted content.

## Get Document

\`\`\`
GET /api/knowledge/:id
\`\`\`

Returns the full document record including extracted text preview and chunk count.
`,
      },
      {
        id: 'webhooks',
        title: 'Webhooks',
        content: `# Webhooks

Caller can send real-time event notifications to your server as calls progress and translator sessions run.

## Setting Up Webhooks

1. Go to **Settings → Webhooks**
2. Click **Add Endpoint**
3. Enter your server URL (must be publicly accessible HTTPS)
4. Select the events you want to receive
5. Copy the **Signing Secret** — use it to verify payloads

## Available Events

### Call Events

| Event | Triggered When |
|---|---|
| \`call.started\` | A call connects and the agent begins |
| \`call.ended\` | A call disconnects (any reason) |
| \`call.transcription\` | A transcript segment is ready (near real-time) |
| \`call.failed\` | A call could not be placed or dropped unexpectedly |
| \`call.no_answer\` | Destination did not answer within timeout |

### Translator Events

| Event | Triggered When |
|---|---|
| \`translator.session.started\` | A translation session begins |
| \`translator.session.ended\` | A translation session ends |
| \`translator.utterance\` | A translated utterance is ready |

## Payload Format

All webhook payloads share this envelope:

\`\`\`
{
  "id": "evt_05la2o7q3t6u8v9w0x1y2z3a",
  "event": "call.ended",
  "workspace_id": "ws_abc123",
  "created_at": "2025-04-12T14:47:27Z",
  "data": {
    ...event-specific fields...
  }
}
\`\`\`

**Example: call.ended payload**
\`\`\`
{
  "id": "evt_05la2o7q3t6u8v9w0x1y2z3a",
  "event": "call.ended",
  "workspace_id": "ws_abc123",
  "created_at": "2025-04-12T14:47:27Z",
  "data": {
    "call_id": "cal_03jy0m5o1r4s6t7u8v9w0x1y",
    "agent_id": "agt_01hx8k3m9p2q4r5s6t7u8v9w",
    "direction": "outbound",
    "status": "completed",
    "duration_seconds": 147,
    "cost_usd": 0.0412,
    "to": "+14155552671"
  }
}
\`\`\`

## Verifying Signatures

Each webhook request includes a signature header for security:

\`\`\`
Caller-Signature: sha256=a4f2e8c1d9b7...
\`\`\`

Verify it server-side:

\`\`\`
const crypto = require('crypto');

function verifyWebhook(body, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return \`sha256=\${expected}\` === signature;
}
\`\`\`

## Retry Policy

If your endpoint returns a non-2xx status or times out (>10s):

- Retry at 1 minute, 5 minutes, 30 minutes, 2 hours, 24 hours
- After 5 failed attempts, the event is marked as **failed**
- View failed deliveries in **Settings → Webhooks → Delivery Log**

> **Tip:** Always return a 200 immediately and process the event asynchronously to avoid timeouts.
`,
      },
      {
        id: 'mcp-server',
        title: 'MCP Server',
        content: `# MCP Server

Caller exposes an MCP (Model Context Protocol) server that lets AI assistants like Claude Desktop control your phone agent platform directly.

## What Is MCP?

Model Context Protocol is an open standard from Anthropic that allows AI assistants to connect to external tools and services. When you connect Caller as an MCP server, Claude (or any MCP client) can make calls, manage agents, and retrieve transcripts — all via natural language.

## Connecting to Claude Desktop

1. Ensure you have an **Agents + MCP** subscription
2. Go to **Settings → API Keys** and create a key with **Write** permission
3. Open your Claude Desktop config file:

**macOS:** \`~/Library/Application Support/Claude/claude_desktop_config.json\`
**Windows:** \`%APPDATA%\\Claude\\claude_desktop_config.json\`

4. Add the Caller MCP server:

\`\`\`
{
  "mcpServers": {
    "caller": {
      "command": "npx",
      "args": ["-y", "@caller/mcp-server"],
      "env": {
        "CALLER_API_KEY": "mcp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "CALLER_API_URL": "https://caller.n8nskorx.top"
      }
    }
  }
}
\`\`\`

5. Restart Claude Desktop — you'll see Caller in the tools panel

## Available MCP Tools

### make_call

Initiate an outbound call with a specified agent.

\`\`\`
{
  "tool": "make_call",
  "input": {
    "agent_id": "agt_01hx8k3m9p2q4r5s6t7u8v9w",
    "to": "+14155552671",
    "context": "Customer is interested in the Pro plan upgrade"
  }
}
\`\`\`

### list_agents

Returns all active agents in your workspace.

### get_call_history

Retrieve recent calls with optional filters.

\`\`\`
{
  "tool": "get_call_history",
  "input": {
    "limit": 10,
    "status": "completed"
  }
}
\`\`\`

### get_call_transcript

Get the full transcript for a specific call.

### start_translation

Start a live translation session.

\`\`\`
{
  "tool": "start_translation",
  "input": {
    "from_language": "en",
    "to_language": "es",
    "tone": "professional"
  }
}
\`\`\`

## Example Claude Interaction

Once connected, you can ask Claude:

- *"Call +14155552671 using my Support Agent and ask if they're happy with the service"*
- *"Show me the last 5 calls and summarize any complaints"*
- *"What did the customer say in call cal_03jy..."*
- *"Start a Spanish translation session in professional tone"*

Claude will use the Caller MCP tools to execute these actions and report back.

> **Security:** MCP connections use the same API key authentication as the REST API. Keys can be scoped to Read-only if you want Claude to only retrieve information without making calls.
`,
      },
    ],
  },
  {
    id: 'architecture',
    title: 'Architecture',
    icon: 'architecture',
    articles: [
      {
        id: 'platform-overview',
        title: 'Platform Overview',
        content: `# Platform Overview

Caller is a multi-tenant SaaS platform built for low-latency voice AI workloads. This document describes the high-level architecture.

## System Components

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    Caller Platform                       │
│                                                         │
│  ┌────────────┐    ┌────────────┐    ┌───────────────┐ │
│  │ Next.js 15 │    │  Fastify 5 │    │  MCP Server   │ │
│  │ Frontend   │───▶│  Backend   │◀───│  (stdio)      │ │
│  │ (React 19) │    │  REST API  │    │               │ │
│  └────────────┘    └─────┬──────┘    └───────────────┘ │
│                          │                              │
│           ┌──────────────┼───────────────┐             │
│           │              │               │             │
│     ┌─────▼──────┐ ┌─────▼──────┐ ┌────▼──────┐      │
│     │ PostgreSQL │ │   Redis    │ │  BullMQ   │      │
│     │ (Supabase) │ │  Cache/WS  │ │  Queues   │      │
│     └────────────┘ └────────────┘ └───────────┘      │
└─────────────────────────────────────────────────────────┘
\`\`\`

## Backend (Fastify 5)

The core API server handles:

- **REST API** — Agent CRUD, call management, knowledge base, billing
- **WebSocket** — Real-time voice stream relay between Twilio and the voice pipeline
- **Webhook Processing** — Inbound Twilio call events and status callbacks
- **Queue Workers** — Background jobs for transcription, indexing, and notifications

**Key technology choices:**

| Choice | Reason |
|---|---|
| **Fastify 5** | ~3x faster than Express, schema-based validation, TypeScript-native |
| **Drizzle ORM** | Type-safe SQL without the overhead of heavy ORMs |
| **BullMQ + Redis** | Reliable job queues for async tasks, concurrency control |
| **Zod** | Runtime validation of all API inputs and webhook payloads |

## Frontend (Next.js 15)

The dashboard is a server-rendered Next.js app with:

- **App Router** — File-based routing with React Server Components
- **Tailwind CSS 4** — Utility-first styling with native cascade layers
- **shadcn/ui** — Accessible, composable UI primitives
- **React 19** — Concurrent rendering, optimistic updates

## Database (PostgreSQL via Supabase)

All persistent data lives in PostgreSQL:

- Agents, configurations, phone numbers
- Call records, transcripts, recordings metadata
- Knowledge base documents and vector embeddings
- Workspace settings, API keys (hashed), provider credentials (encrypted)
- Billing: deposits, usage events, subscription status

## Real-Time Communication

- **Redis Pub/Sub** — Distributes WebSocket messages across backend instances
- **Server-Sent Events (SSE)** — Dashboard live call monitoring
- **BullMQ** — Delayed jobs for retry logic, scheduled calls

## Deployment

Caller runs on a self-hosted Docker environment with:

- Docker Compose for service orchestration
- Cloudflare Tunnel for secure ingress (no exposed ports)
- Supabase Cloud for managed PostgreSQL and Auth
- Redis for caching and queues
`,
      },
      {
        id: 'voice-pipeline',
        title: 'Voice Pipeline',
        content: `# Voice Pipeline

Every phone call goes through a real-time voice pipeline designed for minimal latency. Here's the complete flow from ring to response.

## End-to-End Call Flow

\`\`\`
Caller dials number
        │
        ▼
    Twilio PSTN
        │
        │  WebSocket stream (raw audio, μ-law 8kHz)
        ▼
  Caller Backend (Fastify WebSocket handler)
        │
        │  Audio chunks (20ms frames)
        ▼
  Deepgram Nova-2 (STT)
        │ Interim + final transcripts via WebSocket
        ▼
  Voice Activity Detection (VAD)
        │ Detects end of utterance
        ▼
  LLM (Claude Sonnet / GPT-4o-mini)
        │ Streamed token generation
        ▼
  TTS (xAI Grok TTS / OpenAI TTS / ElevenLabs)
        │ Audio chunks streamed back
        ▼
  Audio buffer → Twilio WebSocket
        │
        ▼
    Caller hears response
\`\`\`

## Latency Optimization

Target latency from end of caller speech to first audio byte: **< 800ms**

### Techniques Used

- **Streaming STT** — Deepgram streams partial transcripts. We begin LLM inference before the utterance is fully transcribed.
- **Streaming LLM** — Claude and GPT-4o support streaming. We begin TTS as soon as the first complete sentence is generated.
- **Streaming TTS** — xAI Grok TTS returns audio chunks as they're generated, not as a single file.
- **Audio pipelining** — Audio chunks flow through the pipeline without waiting for the full response.
- **WebSocket persistence** — All connections stay open for the duration of the call. No reconnection overhead.

## Speech-to-Text (STT)

**Primary:** Deepgram Nova-2
- Real-time streaming transcription
- Speaker diarization (agent vs. caller)
- Smart endpointing (detects end of utterance)
- Supports 30+ languages

**Fallback:** OpenAI Whisper
- Used when Deepgram is unavailable
- Higher latency but comparable accuracy

## Large Language Model (LLM)

The STT transcript is assembled with:
1. The agent's system prompt
2. Relevant knowledge base passages (RAG)
3. Full conversation history
4. Current caller utterance

Streamed to the configured model (Claude, GPT-4o, or GPT-4o-mini).

## Text-to-Speech (TTS)

| Provider | Latency | Quality | Notes |
|---|---|---|---|
| **xAI Grok TTS** | ~200ms | Excellent | Streaming, primary |
| **OpenAI TTS** | ~300ms | Very good | 6 voices, streaming |
| **ElevenLabs** | ~400ms | Outstanding | BYOK required |

## Interruption Handling

If a caller speaks while the agent is talking (barge-in):

1. VAD detects the caller's speech
2. TTS playback is immediately cancelled
3. The partial response is discarded
4. STT begins capturing the new utterance
5. Agent responds to the interruption

This makes conversations feel natural rather than robotic.

## Recording

Call recording is done at the Twilio layer. Dual-channel recordings (agent audio + caller audio separately) are available for quality analysis. Recording URLs are stored in the call record and accessible for 90 days.
`,
      },
      {
        id: 'provider-model-byok',
        title: 'Provider Model (BYOK)',
        content: `# Provider Model (BYOK)

Caller's Bring Your Own Keys architecture lets users connect their own API credentials for every external service, giving full cost transparency and control.

## How It Works

Every API call Caller makes to an external provider (Twilio, Anthropic, OpenAI, etc.) can use either:

1. **Your credentials** — Fetched from the encrypted credential store and used directly. Billing goes to your accounts.
2. **Platform credentials** — Caller's pooled accounts, usage deducted from your deposit.

The choice is per-provider and can be switched at any time.

## Credential Storage

Provider credentials are stored with multiple layers of security:

\`\`\`
User enters API key
        │
        ▼
AES-256-GCM encryption (per-workspace key)
        │
        ▼
Encrypted blob stored in PostgreSQL
        │
        ▼
At runtime: decrypt → use → discard from memory
\`\`\`

- Keys are never logged or stored in plaintext
- Encryption key material is derived from workspace ID + server secret
- Credentials are decrypted on-demand and held in memory for the minimum required time

## Supported Providers

| Provider | Used For | Required If |
|---|---|---|
| **Twilio** | Voice calls, SMS, phone numbers | You want to use your own numbers |
| **Anthropic** | Claude Sonnet | Using Claude as LLM |
| **OpenAI** | GPT-4o, GPT-4o-mini, Whisper, TTS | Using OpenAI models or voices |
| **Deepgram** | Nova-2 STT | Using Deepgram for transcription |
| **ElevenLabs** | Premium TTS voices | Using ElevenLabs voices |
| **xAI** | Grok TTS, Grok LLM | Using xAI products |

## Mixed Configuration

A common setup is:

\`\`\`
Twilio:       Your own account (phone numbers you own)
Claude:       Platform credentials (no Anthropic account needed)
Deepgram:     Platform credentials
xAI TTS:      Your own key (pay xAI directly)
\`\`\`

Configure this in **Settings → Providers** by toggling each service between "My keys" and "Platform".

## Cost Attribution

When using your own keys:
- Costs appear on your provider invoices directly
- Caller records call metadata but does not track provider costs
- Your deposit is not charged for BYOK provider usage

When using platform credentials:
- Costs are calculated based on usage (tokens, minutes, characters)
- Deducted from your Caller deposit in real time
- Itemized in **Settings → Billing → Usage**

## Provider Failover

If a provider API returns an error or timeout:

1. Caller retries up to 3 times with exponential backoff
2. For STT: falls back from Deepgram to OpenAI Whisper
3. For TTS: falls back to OpenAI TTS if primary provider fails
4. For LLM: no automatic fallback — the call will fail gracefully

Configure fallback preferences in **Settings → Providers → Failover**.
`,
      },
      {
        id: 'security',
        title: 'Security',
        content: `# Security

Security is built into every layer of the Caller platform. This document explains the key security mechanisms.

## API Key Security

### Hashing

API keys are stored as SHA-256 hashes. The plaintext key is only shown once at creation time and cannot be recovered by Caller staff.

\`\`\`
User's key:     mcp_a1b2c3d4e5f6g7h8i9j0...
Stored hash:    sha256(key) = 9f4a2b1e8c3d...
Prefix stored:  mcp_a1b2 (for fast lookup)
\`\`\`

On each request:
1. Extract the prefix from the Authorization header
2. Query the database for keys matching that prefix (typically 1 result)
3. Hash the provided key and compare to stored hash
4. If match: proceed; if not: return 401

### Key Scoping

Keys are scoped to Read / Write / Admin permissions. A key cannot exceed the permissions of the user who created it.

## Provider Credential Encryption

All third-party API keys (Twilio, Anthropic, OpenAI, etc.) stored by Caller are encrypted:

| Mechanism | Detail |
|---|---|
| **Algorithm** | AES-256-GCM |
| **Key derivation** | Per-workspace key, never reused |
| **IV** | Random 96-bit per encryption operation |
| **Authentication tag** | 128-bit GCM tag verifies integrity |

Decryption only occurs in the backend process at runtime, and decrypted values are never persisted to disk or logs.

## Workspace Isolation

Every data model in Caller includes a \`workspace_id\` column. Every database query is scoped:

\`\`\`
-- Every query looks like this:
SELECT * FROM agents
WHERE workspace_id = $1  -- always present
AND id = $2;
\`\`\`

Even if an API key is compromised, it can only access data within its own workspace. Cross-workspace data access is architecturally impossible through the API.

## Input Validation

All API endpoints use Zod schemas for strict input validation:

- Request bodies are validated before reaching any business logic
- Unknown fields are stripped (not passed through)
- Type coercion is explicit and audited
- SQL injection is prevented by Drizzle ORM's parameterized queries

## Row Level Security (RLS)

Supabase Row Level Security policies enforce workspace isolation at the database level, providing a second layer of isolation independent of application code:

\`\`\`
-- Example RLS policy
CREATE POLICY workspace_isolation ON agents
  USING (workspace_id = current_setting('app.workspace_id')::uuid);
\`\`\`

## Transport Security

- All traffic to and from the API uses TLS 1.3
- WebSocket connections (Twilio voice streams) use WSS
- Cloudflare Tunnel handles certificate management and DDoS protection
- No ports are exposed directly to the internet

## Data Retention

| Data Type | Retention |
|---|---|
| Call transcripts | 2 years |
| Call recordings (audio) | 90 days |
| Usage logs | 1 year |
| API request logs | 30 days |
| Deleted workspace data | Purged within 30 days |

## Reporting Security Issues

If you discover a security vulnerability in Caller, please email security@caller.ai with a detailed description. We respond to all reports within 48 hours.
`,
      },
    ],
  },
];
