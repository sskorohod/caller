import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import { createCheckoutSession, handleCheckoutCompleted, verifyWebhookSignature, isStripeConfigured } from '../../services/stripe.service.js';
import { env } from '../../config/env.js';

const stripeRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/translator/checkout — create Stripe checkout session (authenticated)
  app.post('/checkout', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request, reply) => {
    if (!isStripeConfigured()) {
      reply.status(503).send({ error: 'Stripe not configured' });
      return;
    }

    const body = z.object({
      subscriber_id: z.string().uuid(),
      minutes: z.number().int().min(1).max(10000),
      price_per_minute: z.number().min(0.01).max(10).default(0.15),
    }).parse(request.body);

    const session = await createCheckoutSession({
      subscriberId: body.subscriber_id,
      minutes: body.minutes,
      pricePerMinute: body.price_per_minute,
      successUrl: `https://${env.API_DOMAIN}/dashboard/translator?checkout=success`,
      cancelUrl: `https://${env.API_DOMAIN}/dashboard/translator?checkout=canceled`,
    });

    return { url: session.url, session_id: session.sessionId };
  });

  // POST /webhooks/stripe — Stripe webhook (no auth, uses signature)
  app.post('/webhook', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const signature = request.headers['stripe-signature'] as string;
    const rawBody = (request as any).rawBody || JSON.stringify(request.body);

    if (!verifyWebhookSignature(rawBody, signature ?? '')) {
      reply.status(400).send({ error: 'Invalid signature' });
      return;
    }

    const event = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object);
    }

    reply.status(200).send({ received: true });
  });
};

export default stripeRoutes;
