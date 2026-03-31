import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import * as knowledgeService from '../../services/knowledge.service.js';

const knowledgeRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', authenticateUser);

  // GET /api/knowledge
  app.get('/', async (request) => {
    return knowledgeService.listKnowledgeBases(request.auth.workspaceId);
  });

  // POST /api/knowledge
  app.post('/', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
    }).parse(request.body);

    const kb = await knowledgeService.createKnowledgeBase(request.auth.workspaceId, body);
    reply.status(201);
    return kb;
  });

  // GET /api/knowledge/:kbId/documents
  app.get('/:kbId/documents', async (request) => {
    const { kbId } = z.object({ kbId: z.string().uuid() }).parse(request.params);
    return knowledgeService.listDocuments(request.auth.workspaceId, kbId);
  });

  // POST /api/knowledge/:kbId/documents
  app.post('/:kbId/documents', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const { kbId } = z.object({ kbId: z.string().uuid() }).parse(request.params);
    const body = z.object({
      title: z.string().min(1).max(200),
      content: z.string().min(1),
      doc_type: z.enum(['document', 'faq', 'policy', 'pricing', 'troubleshooting']).optional(),
      metadata: z.record(z.unknown()).optional(),
    }).parse(request.body);

    const doc = await knowledgeService.addDocument({
      knowledgeBaseId: kbId,
      workspaceId: request.auth.workspaceId,
      ...body,
      docType: body.doc_type,
    });

    reply.status(201);
    return doc;
  });

  // DELETE /api/knowledge/documents/:docId
  app.delete('/documents/:docId', {
    preHandler: [requireRole('owner', 'admin')],
  }, async (request) => {
    const { docId } = z.object({ docId: z.string().uuid() }).parse(request.params);
    await knowledgeService.deleteDocument(request.auth.workspaceId, docId);
    return { deleted: true };
  });

  // POST /api/knowledge/search
  app.post('/search', async (request) => {
    const body = z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(20).optional(),
    }).parse(request.body);

    return knowledgeService.searchKnowledge(request.auth.workspaceId, body.query, body.limit);
  });
};

export default knowledgeRoutes;
