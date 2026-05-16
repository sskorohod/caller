# Caller - AI Phone Agent MCP Platform

## Project Structure
- `packages/backend` — Fastify API server (TypeScript, Node.js)
- `packages/frontend` — Next.js 15 dashboard (App Router, Tailwind 4, shadcn/ui)
- `packages/mcp-server` — MCP server for external agents (@modelcontextprotocol/sdk)
- `supabase/migrations` — PostgreSQL migrations
- `docs/` — PRD and specs (RU + EN)

## Tech Stack
- **Backend**: Fastify 5, TypeScript, PostgreSQL (Drizzle ORM + pg), Redis + BullMQ
- **Frontend**: Next.js 15, React 19, Tailwind CSS 4
- **MCP**: @modelcontextprotocol/sdk
- **Telephony**: Twilio (BYO model)
- **STT**: Deepgram Nova-2 (primary), OpenAI Whisper (fallback)
- **LLM**: Claude Sonnet (primary), GPT-4o-mini (economy)
- **TTS**: xAI Grok TTS (primary), OpenAI TTS, ElevenLabs

## Commands
- `npm run dev:backend` — start backend dev server
- `npm run dev:frontend` — start frontend dev server
- `npm run dev:mcp` — start MCP server in dev mode
- `npm run db:migrate` — push migrations to Supabase

## Key Conventions
- All database access goes through Drizzle ORM (`db` from `config/db.ts`), never raw `pool.query()`
- Workspace isolation: every query must be scoped to workspace_id
- API keys are hashed (SHA-256) with prefix lookup (mcp_xxxx...)
- Provider credentials are AES-256-GCM encrypted at rest
- All routes use Zod for input validation

## Translator Architecture (important — easy to get wrong)

The conference translator is a **single-leg speakerphone** model, not a 3-way bridge:
- Translator user dials their Twilio number → `<Connect><Stream/>` ships their mic to our WS
- There is **no** outbound `client.calls.create` to a second party in this flow
- Both speakers must be physically present near the same phone (speakerphone) — both voices come in mixed on one stream
- Direction (who said what) is detected from the transcript via `tinyld`, not from per-leg streams
- The class name `ConferenceTranslator` is historical, not literal

The dialer voice-translate flow (operator dialing out from the dashboard) is a separate code path with two real Twilio legs (`operatorSocket` / `calleeSocket` in `media-stream.ts`). Don't conflate them.

## Operations

**Deploy:** `git push` → `ssh ugreen` → `cd ~/caller && git pull && docker compose build <service> && docker compose up -d`. Migrations: `docker compose exec -T backend node dist/migrate.js`.

**Gotcha:** UGREEN may be checked out on a feature branch. Verify `git rev-parse HEAD` matches `origin/main` before assuming a deploy is current. If wrong branch: `git checkout main && git pull` first.

**Translator debug — common SQL:**
```bash
# Latest 5 sessions
ssh ugreen 'cd ~/caller && docker compose exec -T postgres psql -U caller -d caller -c "
  SELECT id, call_id, created_at, duration_seconds, status, jsonb_array_length(transcript) AS turns
  FROM translator_sessions ORDER BY created_at DESC LIMIT 5;"'

# Untranslated turns (silent-drop tracking)
ssh ugreen 'cd ~/caller && docker compose exec -T postgres psql -U caller -d caller -c "
  SELECT s.id, s.call_id, s.created_at, turn->>'\''text'\'' AS untranslated_text
  FROM translator_sessions s, jsonb_array_elements(s.transcript) turn
  WHERE (turn->>'\''untranslated'\'')::boolean = true
    AND s.created_at > NOW() - INTERVAL '\''1 day'\'';"'
```

**Translator debug — useful log markers:**
- `Translation dropped: empty output from Grok` — Grok returned `response.done` with no audio (often upstream issue; check the logged `status_details`)
- `Same-language echo detected` — Grok returned the input language as output, retranslation triggered
- `Greeting response timed out` — greeting didn't complete within 15s
- `Grok Voice Agent error` — provider-side error
- `translator_turn_metrics` — per-turn timing (speech-to-first-interim, speech-to-done) for ad-hoc dashboards
- `grok_event` (when verbose logging enabled) — every event Grok sends, useful for diagnosing API changes
