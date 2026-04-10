import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, requireRole } from '../../middleware/auth.js';
import {
  createCheckoutSession,
  handleCheckoutCompleted,
  handleDepositCheckoutCompleted,
  handleSubscriptionCheckoutCompleted,
  handleSubscriptionEvent,
  handleInvoiceEvent,
  verifyWebhookSignature,
  isStripeConfigured,
} from '../../services/stripe.service.js';
import { env } from '../../config/env.js';
import { db } from '../../config/db.js';
import { stripeProcessedEvents } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import pino from 'pino';

const log = pino({ name: 'stripe-webhook' });

const stripeRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/translator/checkout — create Stripe checkout session (authenticated)
  app.post('/checkout', {
    preHandler: [authenticateUser, requireRole('owner', 'admin')],
  }, async (request, reply) => {
    // Check if Stripe is available either via env or OAuth credentials
    let stripeAvailable = isStripeConfigured();
    if (!stripeAvailable) {
      try {
        const { getProviderCredential } = await import('../../services/provider.service.js');
        const creds = await getProviderCredential(request.auth.workspaceId, 'stripe');
        stripeAvailable = !!(creds.access_token || creds.secret_key);
      } catch { /* not configured */ }
    }
    if (!stripeAvailable) {
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
      workspaceId: request.auth.workspaceId,
    });

    return { url: session.url, session_id: session.sessionId };
  });

  // POST /api/translator/webhook — Stripe webhook (no auth, uses signature)
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

    // Idempotency check — atomic INSERT to prevent race conditions (double-processing)
    const eventId = event.id as string;
    if (eventId) {
      const inserted = await db.insert(stripeProcessedEvents)
        .values({ event_id: eventId, event_type: event.type })
        .onConflictDoNothing()
        .returning({ event_id: stripeProcessedEvents.event_id });
      if (inserted.length === 0) {
        log.info({ eventId }, 'Stripe event already processed, skipping');
        reply.status(200).send({ received: true, duplicate: true });
        return;
      }
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const metaType = session.metadata?.type;
          if (metaType === 'deposit') {
            await handleDepositCheckoutCompleted(session);
          } else if (metaType === 'subscription') {
            await handleSubscriptionCheckoutCompleted(session);
          } else {
            // Legacy: translator minutes checkout (no metadata.type)
            await handleCheckoutCompleted(session);
          }
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await handleSubscriptionEvent(event);
          break;

        case 'invoice.paid':
        case 'invoice.payment_failed':
          await handleInvoiceEvent(event);
          break;

        default:
          log.info({ type: event.type }, 'Unhandled Stripe event type');
      }

      // Event was already marked as processed via atomic INSERT above
    } catch (err) {
      log.error({ err, eventId, type: event.type }, 'Stripe webhook handler error');
      reply.status(500).send({ error: 'Webhook handler failed' });
      return;
    }

    reply.status(200).send({ received: true });
  });
};

export default stripeRoutes;
