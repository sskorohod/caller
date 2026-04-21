---
title: Live Translator
type: entity
created: 2026-04-16
updated: 2026-04-21
tags: [product, b2c, translation, voice-ai]
sources: []
---

# Live Translator

B2C service providing real-time phone translation. A subscriber gets a dedicated phone number; when someone calls it, the system joins both parties in a conference call with live AI translation.

## How It Works

1. Caller dials the subscriber's Twilio number
2. System plays a greeting in the target language
3. System calls the subscriber, creating a 3-way conference
4. AI translates speech in real time between both parties
5. Translation is delivered via TTS to both sides

Uses the same [[voice-ai-pipeline]] as [[caller-platform]], but in translation mode rather than agent mode.

## Features

- **Per-subscriber configuration** — language pair, TTS provider, greeting text, translation mode (voice, text, or both)
- **Balance system** — prepaid minutes, admin top-up and gifting
- **Telegram notifications** — optional transcript delivery via Telegram bot
- **Stripe integration** — pay-per-use billing for subscribers
- **Admin management** — full subscriber CRUD in the admin panel

## Translation Modes

- **Voice** — both parties hear translated speech
- **Text** — translation sent as text (via Telegram)
- **Both** — voice + text simultaneously

## Who Hears Translation

Configurable per subscriber:
- **Subscriber only** — only the subscriber hears the translation
- **Both parties** — everyone hears the translated version

## Cross-References

- [[caller-platform]] — sibling product, shared infrastructure
- [[voice-ai-pipeline]] — core technical architecture
- [[live-translator-debugging]] — runbook: где логи, известные точки потери фразы, типовые симптомы → фиксы
- [[fixar-crm]] — ecosystem connection
