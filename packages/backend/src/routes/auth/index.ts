import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import twilio from 'twilio';
import { authenticateUser } from '../../middleware/auth.js';
import * as apiKeyService from '../../services/api-key.service.js';
import * as providerService from '../../services/provider.service.js';
import * as auditService from '../../services/audit.service.js';
import { requireRole } from '../../middleware/auth.js';

const authRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // ============================================================
  // API Keys
  // ============================================================

  // GET /api/auth/api-keys
  app.get('/api-keys', async (request) => {
    const keys = await apiKeyService.listApiKeys(request.auth.workspaceId);
    // Never return hashes to the client
    return keys.map(k => ({
      id: k.id,
      name: k.name,
      key_prefix: k.key_prefix,
      last_used_at: k.last_used_at,
      revoked_at: k.revoked_at,
      created_at: k.created_at,
    }));
  });

  // POST /api/auth/api-keys
  app.post('/api-keys', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const body = z.object({ name: z.string().min(1).max(100) }).parse(request.body);

    const { apiKey, plainKey } = await apiKeyService.createApiKey({
      workspaceId: request.auth.workspaceId,
      name: body.name,
      createdBy: request.auth.userId,
    });

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'api_key.created',
      resourceType: 'api_key',
      resourceId: apiKey.id,
      changes: { name: body.name },
    });

    reply.status(201);
    return {
      id: apiKey.id,
      name: apiKey.name,
      key_prefix: apiKey.key_prefix,
      key: plainKey, // Only returned once at creation
      created_at: apiKey.created_at,
    };
  });

  // DELETE /api/auth/api-keys/:id
  app.delete('/api-keys/:id', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const key = await apiKeyService.revokeApiKey(request.auth.workspaceId, id);

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'api_key.revoked',
      resourceType: 'api_key',
      resourceId: id,
    });

    return { id: key.id, revoked_at: key.revoked_at };
  });

  // ============================================================
  // Provider Credentials
  // ============================================================

  // GET /api/auth/providers
  app.get('/providers', async (request) => {
    const rows = await providerService.listProviderCredentials(request.auth.workspaceId);
    // Add updated_at from provider_credentials table
    const { db } = await import('../../config/db.js');
    const { providerCredentials } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');
    const full = await db
      .select({ provider: providerCredentials.provider, updated_at: providerCredentials.updated_at })
      .from(providerCredentials)
      .where(eq(providerCredentials.workspace_id, request.auth.workspaceId));
    const updatedMap = Object.fromEntries(full.map(r => [r.provider, r.updated_at]));
    return rows.map(r => ({ ...r, updated_at: updatedMap[r.provider] ?? null }));
  });

  // PUT /api/auth/providers/:provider
  app.put('/providers/:provider', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { provider } = z.object({
      provider: z.enum(['twilio', 'openai', 'anthropic', 'elevenlabs', 'deepgram', 'xai']),
    }).parse(request.params);

    const body = z.object({
      credentials: z.record(z.string()),
    }).parse(request.body);

    const credential = await providerService.saveProviderCredential({
      workspaceId: request.auth.workspaceId,
      provider,
      credentials: body.credentials,
    });

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'provider_credential.updated',
      resourceType: 'provider_credential',
      resourceId: credential.id,
      changes: { provider },
    });

    // For Twilio: verify credentials immediately by fetching account info
    let twilioNumbers: Array<{ sid: string; phone_number: string; friendly_name: string }> = [];
    let verifyError: string | null = null;
    if (provider === 'twilio' && body.credentials.account_sid && body.credentials.auth_token) {
      try {
        const client = twilio(body.credentials.account_sid, body.credentials.auth_token);
        const numbers = await client.incomingPhoneNumbers.list({ limit: 50 });
        twilioNumbers = numbers.map(n => ({
          sid: n.sid,
          phone_number: n.phoneNumber,
          friendly_name: n.friendlyName || n.phoneNumber,
        }));
        await providerService.markProviderVerified(request.auth.workspaceId, 'twilio');
      } catch (e: any) {
        verifyError = e.message || 'Invalid Twilio credentials';
      }
    }

    return {
      provider: credential.provider,
      is_verified: provider === 'twilio' ? !verifyError : credential.is_verified,
      updated_at: credential.updated_at,
      ...(provider === 'twilio' ? { phone_numbers: twilioNumbers, verify_error: verifyError } : {}),
    };
  });

  // DELETE /api/auth/providers/:provider
  app.delete('/providers/:provider', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { provider } = z.object({
      provider: z.enum(['twilio', 'openai', 'anthropic', 'elevenlabs', 'deepgram', 'xai']),
    }).parse(request.params);

    await providerService.deleteProviderCredential(request.auth.workspaceId, provider);

    await auditService.writeAuditLog({
      workspaceId: request.auth.workspaceId,
      userId: request.auth.userId,
      action: 'provider_credential.deleted',
      resourceType: 'provider_credential',
      changes: { provider },
    });

    return { deleted: true };
  });
};

export default authRoutes;
