---
title: Caller Platform
type: entity
created: 2026-04-16
updated: 2026-04-16
tags: [product, b2b, saas, voice-ai]
sources: []
---

# Caller Platform

B2B SaaS platform for deploying AI phone agents. Businesses create agents with custom prompts, knowledge bases, and skills, then deploy them on real phone numbers via Twilio.

## Core Features

- **AI Agents** — configurable voice agents with custom system prompts, tools, and personalities
- **Knowledge Bases** — RAG-powered document collections that agents can query during calls
- **Skills** — reusable tool definitions (API calls, CRM lookups, calendar bookings)
- **Missions** — scheduled outbound call campaigns
- **Live Monitoring** — real-time call transcripts and agent behavior observation
- **MCP Server** — external AI agents can initiate calls via [[mcp-protocol]]
- **Multi-workspace** — tenant isolation with workspace-scoped API keys

## Architecture

Built on the [[voice-ai-pipeline]]:
1. Incoming call hits Twilio webhook
2. Audio streams via WebSocket to the backend
3. STT (Deepgram) converts speech to text in real time
4. LLM (Claude Sonnet) generates agent response
5. TTS (xAI Grok) converts response to speech
6. Audio streams back to caller

## Business Model

- Subscription tiers: Free, Starter, Pro, Enterprise
- Usage-based billing: per-minute charges with configurable markup
- Provider BYO: customers can bring their own API keys

## Admin Panel

Full admin panel at `/admin` with [[anthropic-design-system]] styling. 13 pages covering dashboard, workspaces, sessions, finance, billing, tickets, contacts, settings, providers, audit, promo codes, and subscriber management.

## Deployment

Docker Compose on UGREEN NAS. Cloudflare Tunnel routes `caller.n8nskorx.top` to the frontend. Backend, PostgreSQL, Redis, and MinIO (file storage) as separate containers.

## Cross-References

- [[live-translator]] — sibling product using the same infrastructure
- [[fixar-crm]] — connected CRM in the ecosystem
- [[voice-ai-pipeline]] — core technical architecture
- [[mcp-protocol]] — external integration standard
- [[anthropic-design-system]] — admin panel design
