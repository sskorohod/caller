---
title: Wiki Log
type: log
---

# Wiki Log

Chronological record of all wiki operations. Each entry is parseable: `grep "^## \[" log.md | tail -10`

---

## [2026-04-16] init | Wiki created

- Created: directory structure, schema (`WIKI.md`), index, log
- Created: `pages/overview.md` — high-level knowledge base overview
- Created: `pages/entities/caller-platform.md` — core platform entity
- Created: `pages/entities/live-translator.md` — B2C translator service
- Created: `pages/entities/fixar-crm.md` — connected CRM
- Created: `pages/concepts/mcp-protocol.md` — MCP standard
- Created: `pages/concepts/voice-ai-pipeline.md` — voice AI architecture
- Created: `pages/concepts/anthropic-design-system.md` — admin panel design system
- Notes: Initial wiki seeded from project knowledge. No raw sources ingested yet.

## [2026-04-21] query | Live Translator debugging runbook

- Triggered by user report: "в предпоследнем звонке фраза про 30 минут не переведена"
- Investigation: pulled session `48829987-...` and callId `3c08aa8b-...` from UGREEN — turn 6 was translated correctly; root cause likely audio-side (Twilio playback), not the LLM
- Created: `pages/concepts/live-translator-debugging.md` — full runbook (architecture, storage, copy-paste diagnostics, 8 known drop points, symptom→fix table, deploy flow, invariants, case log)
- Updated: `pages/entities/live-translator.md` — added cross-reference to the debugging page
- Updated: `index.md` — registered the new concept page
- Related code change: `packages/backend/src/services/conference-translator.ts` now logs silent-drops as warn and writes them to transcript with `untranslated: true`; VAD `silence_duration_ms` bumped 1000→1400ms
- Notes: Before today, empty-translation turns were silently dropped — no trace in DB or logs. Post-fix, they are visible and queryable (SQL example in the runbook).
