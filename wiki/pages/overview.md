---
title: Knowledge Base Overview
type: overview
created: 2026-04-16
updated: 2026-04-16
tags: [overview, meta]
---

# Knowledge Base Overview

This wiki is a personal knowledge base for the Caller ecosystem — a suite of AI-powered voice communication products. It tracks architecture decisions, product evolution, competitive landscape, and accumulated technical knowledge.

## The Ecosystem

The core product is [[caller-platform]] — a B2B SaaS platform that lets businesses deploy AI phone agents. Built on a [[voice-ai-pipeline]] (STT + LLM + TTS), it integrates with telephony via Twilio and exposes capabilities through the [[mcp-protocol]].

Alongside it, [[live-translator]] is a B2C service offering real-time phone translation — a human calls in, and the system translates the conversation in real time using the same voice pipeline.

Both products share infrastructure with [[fixar-crm]], a field service CRM that was the original project in the ecosystem.

## Technical Stack

- **Backend**: Fastify 5, TypeScript, PostgreSQL (Drizzle ORM), Redis + BullMQ
- **Frontend**: Next.js 15, React 19, Tailwind CSS 4
- **Telephony**: Twilio (BYO model)
- **STT**: Deepgram Nova-2 (primary), OpenAI Whisper (fallback)
- **LLM**: Claude Sonnet (primary), GPT-4o-mini (economy)
- **TTS**: xAI Grok TTS (primary), OpenAI TTS, ElevenLabs
- **MCP**: @modelcontextprotocol/sdk

## Design

The admin panel uses the [[anthropic-design-system]] — warm parchment tones, terracotta accents, Georgia serif headlines. The user dashboard uses a separate indigo-based design.

## Deployment

Production runs on UGREEN NAS via Docker Compose, fronted by Cloudflare Tunnel at `caller.n8nskorx.top`. GitHub repo: `sskorohod/caller.git`.

## Cross-References

- [[caller-platform]] — the core B2B product
- [[live-translator]] — the B2C translation service
- [[fixar-crm]] — connected CRM
- [[mcp-protocol]] — integration standard
- [[voice-ai-pipeline]] — core technical architecture
- [[anthropic-design-system]] — admin UI design system
