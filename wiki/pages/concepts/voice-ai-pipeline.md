---
title: Voice AI Pipeline
type: concept
created: 2026-04-16
updated: 2026-04-16
tags: [architecture, voice, stt, tts, llm, real-time]
sources: []
---

# Voice AI Pipeline

The core technical architecture powering both [[caller-platform]] and [[live-translator]]. A real-time STT + LLM + TTS pipeline that enables natural voice conversations with AI agents or live translation between speakers.

## Pipeline Stages

```
Phone Call (Twilio)
    |
    v
WebSocket Audio Stream
    |
    v
STT (Speech-to-Text)
  - Primary: Deepgram Nova-2
  - Fallback: OpenAI Whisper
    |
    v
LLM (Language Model)
  - Primary: Claude Sonnet (Anthropic)
  - Economy: GPT-4o-mini (OpenAI)
    |
    v
TTS (Text-to-Speech)
  - Primary: xAI Grok TTS
  - Alt: OpenAI TTS
  - Alt: ElevenLabs
    |
    v
WebSocket Audio Stream
    |
    v
Phone Call (Twilio)
```

## Two Modes

### Agent Mode (Caller Platform)

The LLM acts as a conversational AI agent with a system prompt, tools, and knowledge base. Used for customer service, outbound campaigns, appointment scheduling, etc.

### Translation Mode (Live Translator)

The LLM acts as a real-time translator between two speakers in a conference call. The system detects which speaker is talking, translates their speech, and delivers the translation via TTS to the other party.

## Key Technical Decisions

- **Deepgram over Whisper** for primary STT: lower latency for real-time streaming
- **xAI Grok TTS** as primary: good quality, competitive pricing
- **ElevenLabs** for translator subscribers who want higher-quality voices
- **Claude Sonnet over GPT-4o** for primary LLM: better instruction following and tool use
- **BullMQ** for async job processing (call queuing, transcription jobs)

## Latency Considerations

Real-time voice requires sub-second response times. The pipeline optimizes for:
- Streaming STT (partial results before utterance complete)
- LLM streaming (token-by-token generation)
- TTS streaming (audio starts before full text is generated)
- WebSocket transport (minimal overhead vs HTTP)

## Cross-References

- [[caller-platform]] — uses pipeline in agent mode
- [[live-translator]] — uses pipeline in translation mode
- [[mcp-protocol]] — external calls initiated via MCP use this pipeline
