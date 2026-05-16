# Caller — AI Phone Agent MCP Platform

B2B SaaS for deploying configurable AI phone agents over Twilio, with two sibling products
running on the same infra: a translator service (live phone interpretation) and an MCP
server that lets external AI agents place calls. Deployed as a Docker Compose stack on a
self-hosted UGREEN NAS, fronted by Cloudflare Tunnel.

## Project Structure

```
packages/
  backend/                Fastify API + Twilio + Grok + workers
    src/
      config/             env, db, redis, pricing, languages
      db/schema.ts        Drizzle schema (single source of truth)
      lib/                crypto, phone, errors, error-tracker
      middleware/         JWT auth (user + API-key), Twilio signature
      models/types.ts     shared TS types
      realtime/           Socket.IO server + io accessor + call event bus
      routes/             Fastify route plugins (one dir per resource)
      services/           business logic (36 modules)
      workers/            BullMQ background workers
      server.ts           bootstrap
  frontend/               Next.js 15 dashboard + public pages
    src/app/              App Router — landing, dashboard, admin, translate
  mcp-server/             stdio MCP server for external agents (@modelcontextprotocol/sdk)
supabase/migrations/      raw SQL migrations (00001 → 00027)
nginx/                    nginx reverse-proxy config used in docker-compose
docs/                     PRDs (RU + EN)
docker-compose.yml        postgres + redis + minio + backend + frontend + nginx
```

## Tech Stack (verified against package.json — Apr 2026)

**Backend** — Node 20+, TypeScript 5.7
- `fastify@5.2` + `@fastify/websocket` + `@fastify/cors` + `@fastify/helmet` + `@fastify/rate-limit` + `@fastify/multipart`
- `pg@8.20` (raw connection) + `drizzle-orm@0.45` (queries — never use raw `pool.query()`)
- `ioredis@5.6` + `bullmq@5.40` (background jobs)
- `socket.io@4.8` (real-time push to dashboard / live translate page)
- `minio@8.0` (call recording storage)
- `twilio@5.5` (telephony)
- `@anthropic-ai/sdk@0.39`, `openai@4.85` (Anthropic + OpenAI; xAI Grok via the OpenAI-compatible endpoint)
- `tinyld@1.3` (language detection — used by the translator for direction)
- `zod@3.24` (input validation on every route)
- `jose@6.2` (JWT)

**Frontend** — Node 20+, Next.js 15.2, React 19
- Tailwind CSS 4 (PostCSS-based, no shadcn/ui despite older docs)
- `@twilio/voice-sdk` (browser softphone for the dialer)
- `socket.io-client@4.8`

**MCP server** — `@modelcontextprotocol/sdk@1.7`, stdio transport.

## Three Call Modes (key mental model)

The codebase has three independent call paths. They share Twilio + recording + post-call
analytics, but the live audio handling is completely different in each. Knowing which path
a piece of code lives in saves hours.

### 1. AI Agent calls (most of the platform)
Inbound or outbound business calls handled by an AI agent.
- **Pipeline:** Deepgram STT → Claude/GPT LLM → xAI Grok / OpenAI TTS, orchestrated turn-by-turn
- **Entry:** `routes/webhooks/twilio.ts` (inbound) / `services/mission.service.ts` (outbound)
- **Core:** `services/call-orchestrator.ts` (turn loop, barge-in, filler handling)
- **Audio:** `routes/webhooks/media-stream.ts` (Twilio Media Stream WebSocket)

### 2. Translator (Live Translator product)
Real-time phone interpretation. **Single-leg speakerphone model — see section below.**
- **Pipeline:** Grok Voice Agent realtime API (single WS does STT + LLM + TTS)
- **Entry:** `routes/webhooks/twilio.ts` inbound handler when caller's number matches a
  workspace's translator phone
- **Core:** `services/conference-translator.ts` (`ConferenceTranslator` class)

### 3. Dialer voice-translate / copilot
Operator at the dashboard dials out to a callee; live captions + suggestions in the UI.
- **Pipeline:** Deepgram STT per leg, OpenAI/Claude for translation/suggestions
- **Entry:** dashboard dialer triggers an outbound call; second leg dialed via Twilio
- **Core:** `services/live-translate.service.ts`
- **Audio:** has TWO real Twilio legs (`operatorSocket` / `calleeSocket` in
  `routes/webhooks/media-stream.ts`) — actual per-leg streams, unlike the Translator product

Don't conflate Translator (#2) and Dialer voice-translate (#3) — same Russian word
"переводчик", completely different code paths.

## Backend Layout

**Services (`src/services/`)** — most logic lives here.

| Group | Modules |
|---|---|
| Calls | `call.service`, `call-orchestrator`, `session-finalizer.service` |
| Translator | `conference-translator`, `live-translate.service`, `grok-realtime.service` |
| Voice providers | `stt.service` (Deepgram, Whisper), `tts.service` (xAI Grok, OpenAI, Twilio), `llm.service` (Anthropic, OpenAI, xAI) |
| Telephony | `telephony.service` (Twilio client, outbound dial, AMD), `prompt-builder.service` |
| Missions | `mission.service`, `mission-failure.service` |
| Memory + KB | `memory.service`, `knowledge.service` (RAG) |
| Workspace | `workspace.service`, `agent.service`, `api-key.service`, `provider.service`, `credential-resolver.service` |
| Billing | `billing.service`, `stripe.service`, `stripe-connect.service` |
| Integrations | `telegram.service`, `telegram-commands.service`, `sms.service`, `email.service`, `webhook.service`, `connector.service`, `external-handoff.service` |
| Admin / ops | `audit.service`, `recording-storage.service` (MinIO), `upload.service`, `resource-limits.service`, `active-sessions.service` |

**Routes (`src/routes/`)** — Fastify plugins, mounted under `/api/<resource>`.
20 groups: `admin`, `agents`, `audit`, `auth`, `billing`, `calls`, `connectors`,
`contact`, `knowledge`, `memory`, `missions`, `oauth`, `prompt-packs`, `skill-packs`,
`support`, `telephony`, `translator`, `webhook-endpoints`, `webhooks`, `workspaces`.

The `/webhooks/*` group is special: receives Twilio + Telegram callbacks, no
auth middleware (signed by source).

**Workers (`src/workers/`)** — BullMQ jobs on Redis.
- `post-call.worker.ts` — runs after each call: summary, action items, sentiment, QA
  scoring, mission-status update, Telegram report
- `mission-scheduled.worker.ts` — fires postponed mission calls at their scheduled time
  (replaced an in-memory `setTimeout` map that lost jobs on restart)

**Realtime (`src/realtime/`)** — Socket.IO server.
- `socket-server.ts` — auth (JWT or share token), room joins (workspace, call, translate)
- `io.ts` — global accessor (`getIo()`), used across services to push events
- `call-events.ts` — internal EventEmitter for transcript / call-ended events

**Important:** Socket.IO transport is **forced to long-polling only** because Cloudflare
Tunnel breaks WebSocket frames. Avoid `.volatile.emit()` for any user-visible event —
volatile messages are silently dropped between polls. Volatile is fine for raw audio
buffers and rapidly-updated stats.

## Frontend Layout

Next.js 15 App Router. Public pages: `_landing`, `pricing`, `docs`, `blog`, `terms`,
`privacy`, `acceptable-use`, `login`, `oauth`, `onboarding`. Authenticated:
`dashboard/*`, `admin/*`. Special: `translate/[token]/page.tsx` (public live-translate
viewer accessed via share token, no JWT).

Dashboard has 14 pages: agents, audit, billing, calls, connectors, dialer, help,
knowledge, missions, prompts, settings, skills, translator. Plus per-call live
(`calls/[id]/live`) and translate (`calls/[id]/translate`) views.

Tailwind 4 with custom CSS variables (`--th-*`) for theming.

## Database

PostgreSQL 16 with `pgvector` (image: `pgvector/pgvector:pg16`).

- **Schema:** `packages/backend/src/db/schema.ts` — single source of truth, Drizzle
  table definitions. Migrations in `supabase/migrations/*.sql` are raw SQL applied at
  deploy time via `node dist/migrate.js`. JSONB column changes (e.g. extending
  `mission.outcome`) don't need a migration — extend by convention with TypeScript types.
- **Migration runner:** `dist/migrate.js` is a built step from `src/migrate.ts`. Run
  inside the backend container: `docker compose exec -T backend node dist/migrate.js`.
- **Connection:** `config/db.ts` exports `db` (Drizzle instance) and `pool` (raw pg pool
  for migrations / transactional needs).

## Key Conventions

- **All DB access goes through Drizzle** (`db` from `config/db.ts`). Never use raw
  `pool.query()` in business code.
- **Workspace isolation:** every query must be scoped to `workspace_id`. The
  `authenticateAny` / `authenticateUser` middleware sets `request.auth.workspaceId` —
  always include it in `where(eq(table.workspace_id, request.auth.workspaceId))`.
- **API keys** are SHA-256-hashed; lookups use a `mcp_xxxxxxxx...` prefix index.
- **Provider credentials** are AES-256-GCM encrypted at rest (`lib/crypto.ts`).
- **Input validation:** every route body/params/query goes through Zod.
- **No raw secrets in code.** Twilio / xAI / OpenAI / Anthropic / Telegram credentials
  live in `provider_credentials` (encrypted) and are fetched via `provider.service.ts`
  or `credential-resolver.service.ts`.

## Translator Architecture (important — easy to get wrong)

The Translator product (`ConferenceTranslator`) is a **single-leg speakerphone**
model, not a 3-way conference bridge:

- Translator user dials their workspace's Twilio number → `<Connect><Stream/>` ships
  their mic to the backend WS. There is **no** outbound `client.calls.create` to a
  second party in this flow.
- Both speakers must be physically near the same phone (speakerphone). Both voices
  arrive mixed on a single audio stream.
- Direction (who said what) is detected from the transcript via `tinyld`, not from
  per-leg streams. Family-aware mapping handles ru↔uk, es↔gl/ca, etc.
- The class name `ConferenceTranslator` is historical, not literal. The original
  product spec called for a 3-way merge but it was never built that way.

Single Grok WebSocket session does STT + LLM + TTS together (`services/grok-realtime.service.ts`
helpers; main loop in `services/conference-translator.ts`).

**Known upstream issue (May 2026):** xAI's Grok Voice Agent realtime endpoint may
return `response.done` with `status_details: "unimplemented"` and zero output
tokens — i.e. it accepts audio input but generates nothing. When the diagnostic log
`grok_event` shows `*.done` events without preceding `*.delta` events, that's the
symptom. Check xAI console for billing / Voice Agent activation status before
debugging code.

## Operations

**Deploy:** `git push` → `ssh ugreen` → `cd ~/caller && git pull && docker compose build <service> && docker compose up -d`. 
New migrations: `docker compose exec -T backend node dist/migrate.js`.

**Gotcha:** UGREEN may be checked out on a feature branch. Verify
`git rev-parse HEAD` on the server matches `origin/main` before assuming a deploy is
current. If wrong: `git checkout main && git pull` first.

**Translator debug — common SQL:**
```bash
# Latest 5 sessions
ssh ugreen 'cd ~/caller && docker compose exec -T postgres psql -U caller -d caller -c "
  SELECT id, call_id, created_at, duration_seconds, status, jsonb_array_length(transcript) AS turns
  FROM translator_sessions ORDER BY created_at DESC LIMIT 5;"'

# Untranslated turns (silent-drop tracking — see conference-translator.ts response.done)
ssh ugreen 'cd ~/caller && docker compose exec -T postgres psql -U caller -d caller -c "
  SELECT s.id, s.call_id, s.created_at, turn->>'\''text'\'' AS untranslated_text
  FROM translator_sessions s, jsonb_array_elements(s.transcript) turn
  WHERE (turn->>'\''untranslated'\'')::boolean = true
    AND s.created_at > NOW() - INTERVAL '\''1 day'\'';"'
```

**Translator debug — useful log markers:**
- `Translation dropped: empty output from Grok` — Grok returned `response.done` with no
  audio (often upstream issue; check the logged `status_details`)
- `Same-language echo detected` — Grok output matched input language, retranslation triggered
- `Greeting response timed out` — greeting didn't complete within 15 s
- `Grok Voice Agent error` — provider-side error
- `translator_turn_metrics` — per-turn timing (speech→first-interim, speech→done) for ad-hoc analysis
- `grok_event` (when verbose logging enabled) — every event Grok sends, useful for
  diagnosing upstream API changes

**Infra layout (UGREEN NAS):**
- Containers: `postgres` (pgvector), `redis`, `minio`, `backend`, `frontend`, `nginx`
- Cloudflare Tunnel `n8n-tunnel` routes `caller.n8nskorx.top` → `localhost:8880` → nginx → backend/frontend
- Ports 80, 8080, 8082 are taken on the NAS — Caller binds to 8880
- **Do not edit** Caddy or Cloudflare Tunnel configs — they're shared across all
  projects on the NAS. Only `docker-compose.yml` and code changes belong to Caller.

## Commands

- `npm run dev:backend` — start backend dev server (`tsx watch`)
- `npm run dev:frontend` — start Next.js dev server
- `npm run dev:mcp` — start MCP server in stdio mode
- `npm run build` — build all three packages
- `npm run lint` — lint backend + frontend
