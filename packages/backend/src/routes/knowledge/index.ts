import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, authenticateAny, requireRole } from '../../middleware/auth.js';
import * as knowledgeService from '../../services/knowledge.service.js';

const knowledgeRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/knowledge — supports both JWT (dashboard) and API key (MCP)
  app.get('/', { preHandler: [authenticateAny] }, async (request) => {
    const rows = await knowledgeService.listKnowledgeBases(request.auth.workspaceId);
    return { knowledge_bases: rows };
  });

  // POST /api/knowledge
  app.post('/', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
    }).parse(request.body);

    const kb = await knowledgeService.createKnowledgeBase(request.auth.workspaceId, body);
    reply.status(201);
    return kb;
  });

  // DELETE /api/knowledge/:kbId
  app.delete('/:kbId', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const { kbId } = z.object({ kbId: z.string().uuid() }).parse(request.params);
    await knowledgeService.deleteKnowledgeBase(request.auth.workspaceId, kbId);
    return { deleted: true };
  });

  // GET /api/knowledge/:kbId/documents
  app.get('/:kbId/documents', { preHandler: [authenticateAny] }, async (request) => {
    const { kbId } = z.object({ kbId: z.string().uuid() }).parse(request.params);
    const rows = await knowledgeService.listDocuments(request.auth.workspaceId, kbId);
    return { documents: rows };
  });

  // POST /api/knowledge/:kbId/documents
  app.post('/:kbId/documents', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
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

  // GET /api/knowledge/documents/:docId
  app.get('/documents/:docId', { preHandler: [authenticateAny] }, async (request) => {
    const { docId } = z.object({ docId: z.string().uuid() }).parse(request.params);
    return knowledgeService.getDocument(request.auth.workspaceId, docId);
  });

  // PATCH /api/knowledge/documents/:docId
  app.patch('/documents/:docId', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const { docId } = z.object({ docId: z.string().uuid() }).parse(request.params);
    const body = z.object({
      title: z.string().min(1).max(200).optional(),
      content: z.string().min(1).optional(),
      doc_type: z.enum(['document', 'faq', 'policy', 'pricing', 'troubleshooting']).optional(),
    }).parse(request.body);

    return knowledgeService.updateDocument(request.auth.workspaceId, docId, body);
  });

  // DELETE /api/knowledge/documents/:docId
  app.delete('/documents/:docId', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const { docId } = z.object({ docId: z.string().uuid() }).parse(request.params);
    await knowledgeService.deleteDocument(request.auth.workspaceId, docId);
    return { deleted: true };
  });

  // POST /api/knowledge/enhance — AI-assisted content formatting
  app.post('/enhance', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request) => {
    const body = z.object({
      content: z.string().min(1).max(50000),
      doc_type: z.enum(['document', 'faq', 'policy', 'pricing', 'troubleshooting']).optional(),
    }).parse(request.body);

    return knowledgeService.enhanceContent(request.auth.workspaceId, body.content, body.doc_type);
  });

  // POST /api/knowledge/search
  app.post('/search', { preHandler: [authenticateAny] }, async (request) => {
    const body = z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(20).optional(),
    }).parse(request.body);

    return knowledgeService.searchKnowledge(request.auth.workspaceId, body.query, body.limit);
  });
};

export default knowledgeRoutes;
