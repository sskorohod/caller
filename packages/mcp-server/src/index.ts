#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const PLATFORM_API_URL = process.env.CALLER_API_URL || 'http://localhost:3001';
const API_KEY = process.env.CALLER_API_KEY || '';

const server = new McpServer({
  name: 'caller',
  version: '0.1.0',
});

async function apiRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`${PLATFORM_API_URL}${path}`, {
    ...options,
    signal: AbortSignal.timeout(30_000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`API error ${res.status}: ${(body as any).message || res.statusText}`);
  }

  return res.json();
}

// Tool: start_call
server.tool(
  'start_call',
  'Start an outbound phone call. The platform will either use its internal AI agent or connect an external agent to conduct the conversation.',
  {
    to: z.string().describe('Destination phone number in E.164 format (e.g., +15551234567)'),
    agent_profile_id: z.string().optional().describe('Agent profile ID to use for this call'),
    goal: z.string().describe('High-level objective for the call'),
    context: z.record(z.unknown()).optional().describe('Structured context for the runtime'),
    language: z.enum(['en', 'ru']).optional().describe('Preferred language'),
    conversation_owner: z.enum(['internal', 'external']).optional().describe('Who should own the live conversation'),
    outcome_schema: z.record(z.unknown()).optional().describe('Expected structured result shape'),
    metadata: z.record(z.unknown()).optional().describe('Client-defined metadata persisted with the call'),
  },
  async (params) => {
    const result = await apiRequest('/api/calls/start', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
);

// Tool: get_call_status
server.tool(
  'get_call_status',
  'Get current status of a phone call.',
  {
    call_id: z.string().describe('The call ID to check'),
  },
  async ({ call_id }) => {
    const result = await apiRequest(`/api/calls/${call_id}/status`);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
);

// Tool: get_call_artifacts
server.tool(
  'get_call_artifacts',
  'Get post-call artifacts including recording, transcript, summary, and structured outcomes.',
  {
    call_id: z.string().describe('The call ID to get artifacts for'),
  },
  async ({ call_id }) => {
    const result = await apiRequest(`/api/calls/${call_id}/artifacts`);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
);

// Tool: list_recent_calls
server.tool(
  'list_recent_calls',
  'List recent calls in the workspace.',
  {
    limit: z.number().min(1).max(100).optional().describe('Max number of calls to return (default: 20)'),
    direction: z.enum(['inbound', 'outbound']).optional().describe('Filter by call direction'),
    status: z.enum(['initiated', 'ringing', 'in_progress', 'completed', 'failed', 'canceled']).optional().describe('Filter by call status'),
  },
  async (params) => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.direction) query.set('direction', params.direction);
    if (params.status) query.set('status', params.status);

    const result = await apiRequest(`/api/calls?${query.toString()}`);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
);

// Tool: list_agents
server.tool(
  'list_agents',
  'List all AI phone agents in the workspace with their descriptions, skills, and configuration. Use this to find the right agent for a specific task.',
  {},
  async () => {
    const result = await apiRequest('/api/agents') as { agents: any[] };
    const agents = (result.agents ?? []).map((a: any) => ({
      id: a.id,
      name: a.name,
      display_name: a.display_name,
      description: a.description,
      is_active: a.is_active,
      language: a.language,
      llm_model: a.llm_model,
      voice_provider: a.voice_provider,
    }));

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(agents, null, 2) }],
    };
  },
);

// Start server
async function main() {
  if (!API_KEY) {
    console.error('CALLER_API_KEY environment variable is required');
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
