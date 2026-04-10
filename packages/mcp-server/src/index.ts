#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const PLATFORM_API_URL = process.env.CALLER_API_URL || 'http://localhost:3001';
const API_KEY = process.env.CALLER_API_KEY || '';

const server = new McpServer({
  name: 'caller',
  version: '0.2.0',
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

function jsonResponse(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

// ============================================================
// CALL TOOLS
// ============================================================

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
    return jsonResponse(result);
  },
);

server.tool(
  'get_call_status',
  'Get current status of a phone call including timing and ownership details.',
  { call_id: z.string().describe('The call ID (UUID)') },
  async ({ call_id }) => {
    const result = await apiRequest(`/api/calls/${call_id}/status`);
    return jsonResponse(result);
  },
);

server.tool(
  'get_call_artifacts',
  'Get post-call artifacts including recording URL, transcript, summary, structured outcomes, action items, and sentiment analysis.',
  { call_id: z.string().describe('The call ID (UUID)') },
  async ({ call_id }) => {
    const result = await apiRequest(`/api/calls/${call_id}/artifacts`);
    return jsonResponse(result);
  },
);

server.tool(
  'list_recent_calls',
  'List recent calls in the workspace with optional filters by direction and status.',
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
    return jsonResponse(result);
  },
);

// ============================================================
// AGENT TOOLS
// ============================================================

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
    return jsonResponse(agents);
  },
);

server.tool(
  'get_agent',
  'Get detailed information about a specific AI agent including attached prompt packs, skill packs, and knowledge bases.',
  { agent_id: z.string().describe('Agent profile ID (UUID)') },
  async ({ agent_id }) => {
    const result = await apiRequest(`/api/agents/${agent_id}`);
    return jsonResponse(result);
  },
);

// ============================================================
// KNOWLEDGE BASE TOOLS
// ============================================================

server.tool(
  'list_knowledge_bases',
  'List all knowledge bases in the workspace. Knowledge bases contain documents that agents can reference during calls.',
  {},
  async () => {
    const result = await apiRequest('/api/knowledge');
    return jsonResponse(result);
  },
);

server.tool(
  'search_knowledge',
  'Search across all knowledge bases for relevant information. Uses semantic search to find the most relevant documents and passages.',
  {
    query: z.string().describe('Search query text'),
    limit: z.number().min(1).max(20).optional().describe('Max results (default: 5)'),
  },
  async (params) => {
    const result = await apiRequest('/api/knowledge/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return jsonResponse(result);
  },
);

// ============================================================
// MISSION TOOLS
// ============================================================

server.tool(
  'list_missions',
  'List missions (call tasks) in the workspace. Missions are pre-configured call plans that can be executed on demand.',
  {
    status: z.string().optional().describe('Filter by status (draft, ready, executing, completed, failed)'),
    limit: z.number().min(1).max(100).optional().describe('Max results'),
  },
  async (params) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.limit) query.set('limit', String(params.limit));
    const result = await apiRequest(`/api/missions?${query.toString()}`);
    return jsonResponse(result);
  },
);

server.tool(
  'get_mission',
  'Get detailed information about a specific mission including its messages and execution history.',
  { mission_id: z.string().describe('Mission ID (UUID)') },
  async ({ mission_id }) => {
    const result = await apiRequest(`/api/missions/${mission_id}`);
    return jsonResponse(result);
  },
);

server.tool(
  'execute_mission',
  'Execute a mission — start the planned phone call. The mission must be in "ready" status with a target phone number and agent assigned.',
  { mission_id: z.string().describe('Mission ID (UUID)') },
  async ({ mission_id }) => {
    const result = await apiRequest(`/api/missions/${mission_id}/execute`, { method: 'POST' });
    return jsonResponse(result);
  },
);

// ============================================================
// WORKSPACE & BILLING TOOLS
// ============================================================

server.tool(
  'get_workspace',
  'Get current workspace configuration including name, settings, plan, and telephony configuration.',
  {},
  async () => {
    const result = await apiRequest('/api/workspaces/current');
    return jsonResponse(result);
  },
);

server.tool(
  'get_balance',
  'Get workspace billing information including current USD balance, plan, subscription status, and feature availability.',
  {},
  async () => {
    const result = await apiRequest('/api/billing/balance');
    return jsonResponse(result);
  },
);

// ============================================================
// START SERVER
// ============================================================

async function main() {
  if (!API_KEY) {
    console.error('CALLER_API_KEY environment variable is required');
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
