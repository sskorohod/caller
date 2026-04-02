import twilio from 'twilio';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../lib/errors.js';

/**
 * Validate that incoming requests are actually from Twilio.
 * Uses Twilio's X-Twilio-Signature header and the webhook auth token.
 */
export async function validateTwilioSignature(request: FastifyRequest, reply: FastifyReply) {
  if (env.NODE_ENV === 'development') return; // Skip in dev
  if (!env.TWILIO_WEBHOOK_SECRET) return; // Skip if no secret configured

  const signature = request.headers['x-twilio-signature'] as string | undefined;
  if (!signature) throw new UnauthorizedError('Missing Twilio signature');

  // Try both http and https — Cloudflare Tunnel terminates SSL
  const host = env.API_DOMAIN;
  const body = request.body as Record<string, string>;

  for (const proto of ['https', 'http']) {
    const url = `${proto}://${host}${request.url}`;
    if (twilio.validateRequest(env.TWILIO_WEBHOOK_SECRET, signature, url, body)) {
      return; // Valid
    }
  }

  throw new UnauthorizedError('Invalid Twilio signature');
}
