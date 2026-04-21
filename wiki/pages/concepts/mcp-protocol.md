---
title: Model Context Protocol (MCP)
type: concept
created: 2026-04-16
updated: 2026-04-16
tags: [protocol, integration, llm, standard]
sources: []
---

# Model Context Protocol (MCP)

Open standard developed by Anthropic for connecting LLMs to external tools and data sources. It provides a unified interface for LLMs to discover and invoke tools, read resources, and receive prompts from external servers.

## How It Works

MCP follows a client-server architecture:
- **MCP Server** — exposes tools, resources, and prompts via the protocol
- **MCP Client** — the LLM host (Claude Desktop, Claude Code, etc.) that connects to servers
- **Transport** — stdio (local) or SSE/HTTP (remote)

## Role in the Caller Ecosystem

### Caller as MCP Server

[[caller-platform]] exposes an MCP server (`packages/mcp-server/`) that allows external AI agents to:
- Initiate outbound phone calls
- Check call status
- Retrieve call transcripts
- Manage agent configurations

This means any MCP-compatible AI tool (Claude Desktop, Cursor, etc.) can make phone calls through Caller.

### FixarCRM as MCP Server

[[fixar-crm]] also has an MCP server that Caller agents can connect to for CRM operations during calls.

## SDK

Built on `@modelcontextprotocol/sdk` — the official TypeScript SDK for building MCP servers and clients.

## Security

- API keys are hashed (SHA-256) with prefix lookup (`mcp_xxxx...`)
- Workspace-scoped: each API key is tied to a specific workspace
- Rate limiting on the MCP endpoints

## Cross-References

- [[caller-platform]] — primary MCP server implementation
- [[fixar-crm]] — CRM MCP server for agent tools
- [[voice-ai-pipeline]] — the pipeline that MCP-initiated calls use
