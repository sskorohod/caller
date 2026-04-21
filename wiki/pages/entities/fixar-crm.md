---
title: FixarCRM
type: entity
created: 2026-04-16
updated: 2026-04-16
tags: [product, crm, field-service]
sources: []
---

# FixarCRM

Field service CRM for managing customers, jobs, estimates, invoices, and technician scheduling. The original project in the ecosystem, now connected to [[caller-platform]] for AI-powered customer communication.

## Core Features

- Customer and lead management
- Job scheduling and technician dispatch
- Estimates and invoicing
- Payment processing
- SMS notifications
- Timeline and activity tracking
- Dashboard analytics

## Integration with Caller

FixarCRM has an MCP server that allows [[caller-platform]] AI agents to:
- Look up customer information during calls
- Create new leads from inbound calls
- Schedule visits and appointments
- Check estimate status
- Send SMS to customers

This integration is available as a connected MCP tool in the Caller dashboard.

## Cross-References

- [[caller-platform]] — connected via MCP for AI agent integration
- [[live-translator]] — part of the same ecosystem
- [[mcp-protocol]] — integration standard used for connection
