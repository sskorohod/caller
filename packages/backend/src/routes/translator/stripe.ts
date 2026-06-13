import type { FastifyPluginAsync } from 'fastify';
import {
  handleDepositCheckoutCompleted,
  handleSubscriptionCheckoutCompleted,
  handleSubscriptionEvent,
  handleInvoiceEvent,
  verifyWebhookSignature,
  getPlatformWebhookSecret,
} from '../../services/stripe.service.js';
import { db } from '../../config/db.js';
import { stripeProcessedEvents } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import pino from 'pino';

const log = pino({ name: 'stripe-webhook' });

const stripeRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/translator/webhook — Stripe webhook (no auth, uses signature)
  app.post('/webhook', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const signature = request.headers['stripe-signature'] as string;
    const rawBody = (request as any).rawBody || JSON.stringify(request.body);

    const webhookSecret = await getPlatformWebhookSecret();
    if (!verifyWebhookSignature(rawBody, signature ?? '', webhookSecret)) {
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
            log.info({ sessionId: session.id }, 'Ignoring checkout.session.completed with no recognized metadata.type');
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
      // Roll back the idempotency claim so Stripe's automatic retry actually
      // re-runs the handler. Without this, the event id stays marked
      // "processed" and the retry is short-circuited as a duplicate — silently
      // dropping a paid customer's credit/subscription on any transient failure.
      if (eventId) {
        await db.delete(stripeProcessedEvents)
          .where(eq(stripeProcessedEvents.event_id, eventId))
          .catch((delErr) => log.error({ delErr, eventId }, 'Failed to roll back processed-event claim'));
      }
      reply.status(500).send({ error: 'Webhook handler failed' });
      return;
    }

    reply.status(200).send({ received: true });
  });
};

export default stripeRoutes;
