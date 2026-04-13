import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { db } from '../../config/db.js';
import { supportTickets, supportMessages, users, workspaces } from '../../db/schema.js';
import { eq, and, desc, count, sql } from 'drizzle-orm';

// ── User-facing routes ──────────────────────────────────────

const supportRoutes: FastifyPluginAsync = async (app) => {
  // List my tickets
  app.get('/', {
    preHandler: [authenticateUser],
  }, async (request) => {
    const tickets = await db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        status: supportTickets.status,
        created_at: supportTickets.created_at,
        updated_at: supportTickets.updated_at,
        message_count: sql<number>`(SELECT count(*) FROM support_messages WHERE ticket_id = ${supportTickets.id})`.as('message_count'),
      })
      .from(supportTickets)
      .where(and(
        eq(supportTickets.workspace_id, request.auth.workspaceId),
        eq(supportTickets.user_id, request.auth.userId),
      ))
      .orderBy(desc(supportTickets.updated_at));
    return tickets;
  });

  // Create ticket + first message
  app.post('/', {
    preHandler: [authenticateUser],
  }, async (request, reply) => {
    const body = z.object({
      subject: z.string().min(1).max(200),
      message: z.string().min(1).max(5000),
    }).parse(request.body);

    const [ticket] = await db.insert(supportTickets).values({
      workspace_id: request.auth.workspaceId,
      user_id: request.auth.userId,
      subject: body.subject,
    }).returning();

    await db.insert(supportMessages).values({
      ticket_id: ticket.id,
      sender_role: 'user',
      sender_id: request.auth.userId,
      body: body.message,
    });

    return reply.status(201).send(ticket);
  });

  // Get ticket with messages
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticateUser],
  }, async (request, reply) => {
    const { id } = request.params;

    const [ticket] = await db.select().from(supportTickets).where(and(
      eq(supportTickets.id, id),
      eq(supportTickets.workspace_id, request.auth.workspaceId),
      eq(supportTickets.user_id, request.auth.userId),
    ));

    if (!ticket) return reply.status(404).send({ message: 'Ticket not found' });

    const messages = await db
      .select({
        id: supportMessages.id,
        sender_role: supportMessages.sender_role,
        body: supportMessages.body,
        created_at: supportMessages.created_at,
      })
      .from(supportMessages)
      .where(eq(supportMessages.ticket_id, id))
      .orderBy(supportMessages.created_at);

    return { ...ticket, messages };
  });

  // Send message to ticket
  app.post<{ Params: { id: string } }>('/:id/messages', {
    preHandler: [authenticateUser],
  }, async (request, reply) => {
    const { id } = request.params;
    const body = z.object({ message: z.string().min(1).max(5000) }).parse(request.body);

    const [ticket] = await db.select().from(supportTickets).where(and(
      eq(supportTickets.id, id),
      eq(supportTickets.workspace_id, request.auth.workspaceId),
      eq(supportTickets.user_id, request.auth.userId),
    ));

    if (!ticket) return reply.status(404).send({ message: 'Ticket not found' });
    if (ticket.status === 'closed') return reply.status(400).send({ message: 'Ticket is closed' });

    const [msg] = await db.insert(supportMessages).values({
      ticket_id: id,
      sender_role: 'user',
      sender_id: request.auth.userId,
      body: body.message,
    }).returning();

    await db.update(supportTickets)
      .set({ status: 'open', updated_at: new Date() })
      .where(eq(supportTickets.id, id));

    return reply.status(201).send(msg);
  });

  // ── Admin routes ────────────────────────────────────────────

  // List all tickets (admin)
  app.get('/admin/all', {
    preHandler: [authenticateUser, requireRole('owner')],
  }, async (request) => {
    const query = z.object({
      status: z.enum(['open', 'replied', 'closed']).optional(),
      limit: z.coerce.number().min(1).max(100).optional(),
      offset: z.coerce.number().min(0).optional(),
    }).parse(request.query);

    const conditions = [];
    if (query.status) conditions.push(eq(supportTickets.status, query.status));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [countResult] = await db.select({ total: count() }).from(supportTickets).where(whereClause);

    const tickets = await db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        status: supportTickets.status,
        created_at: supportTickets.created_at,
        updated_at: supportTickets.updated_at,
        workspace_id: supportTickets.workspace_id,
        user_email: users.email,
        workspace_name: workspaces.name,
        message_count: sql<number>`(SELECT count(*) FROM support_messages WHERE ticket_id = ${supportTickets.id})`.as('message_count'),
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.user_id, users.id))
      .leftJoin(workspaces, eq(supportTickets.workspace_id, workspaces.id))
      .where(whereClause)
      .orderBy(desc(supportTickets.updated_at))
      .limit(query.limit ?? 50)
      .offset(query.offset ?? 0);

    return { tickets, total: countResult?.total ?? 0 };
  });

  // Get ticket detail (admin)
  app.get<{ Params: { id: string } }>('/admin/:id', {
    preHandler: [authenticateUser, requireRole('owner')],
  }, async (request, reply) => {
    const { id } = request.params;

    const [ticket] = await db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        status: supportTickets.status,
        created_at: supportTickets.created_at,
        updated_at: supportTickets.updated_at,
        workspace_id: supportTickets.workspace_id,
        user_id: supportTickets.user_id,
        user_email: users.email,
        workspace_name: workspaces.name,
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.user_id, users.id))
      .leftJoin(workspaces, eq(supportTickets.workspace_id, workspaces.id))
      .where(eq(supportTickets.id, id));

    if (!ticket) return reply.status(404).send({ message: 'Ticket not found' });

    const messages = await db
      .select({
        id: supportMessages.id,
        sender_role: supportMessages.sender_role,
        sender_id: supportMessages.sender_id,
        body: supportMessages.body,
        created_at: supportMessages.created_at,
        sender_email: users.email,
      })
      .from(supportMessages)
      .leftJoin(users, eq(supportMessages.sender_id, users.id))
      .where(eq(supportMessages.ticket_id, id))
      .orderBy(supportMessages.created_at);

    return { ...ticket, messages };
  });

  // Admin reply to ticket
  app.post<{ Params: { id: string } }>('/admin/:id/reply', {
    preHandler: [authenticateUser, requireRole('owner')],
  }, async (request, reply) => {
    const { id } = request.params;
    const body = z.object({ message: z.string().min(1).max(5000) }).parse(request.body);

    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    if (!ticket) return reply.status(404).send({ message: 'Ticket not found' });

    const [msg] = await db.insert(supportMessages).values({
      ticket_id: id,
      sender_role: 'admin',
      sender_id: request.auth.userId,
      body: body.message,
    }).returning();

    await db.update(supportTickets)
      .set({ status: 'replied', updated_at: new Date() })
      .where(eq(supportTickets.id, id));

    return reply.status(201).send(msg);
  });

  // Admin close ticket
  app.patch<{ Params: { id: string } }>('/admin/:id/close', {
    preHandler: [authenticateUser, requireRole('owner')],
  }, async (request, reply) => {
    const { id } = request.params;
    const [ticket] = await db.update(supportTickets)
      .set({ status: 'closed', updated_at: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    if (!ticket) return reply.status(404).send({ message: 'Ticket not found' });
    return ticket;
  });

  // Admin reopen ticket
  app.patch<{ Params: { id: string } }>('/admin/:id/reopen', {
    preHandler: [authenticateUser, requireRole('owner')],
  }, async (request, reply) => {
    const { id } = request.params;
    const [ticket] = await db.update(supportTickets)
      .set({ status: 'open', updated_at: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    if (!ticket) return reply.status(404).send({ message: 'Ticket not found' });
    return ticket;
  });
};

export default supportRoutes;
