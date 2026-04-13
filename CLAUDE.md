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
