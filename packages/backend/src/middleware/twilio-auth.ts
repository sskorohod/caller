import twilio from 'twilio';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../lib/errors.js';

/**
 * Validate that incoming requests are actually from Twilio.
 * Uses Twilio's X-Twilio-Signature header and the webhook auth token.
 */
export async function validateTwilioSignature(request: FastifyRequest, reply: FastifyReply) {
  // When TWILIO_WEBHOOK_SECRET is not set, skip validation
  // (Cloudflare Tunnel rewrites URLs which breaks HMAC — tunnel itself provides security)
  if (!env.TWILIO_WEBHOOK_SECRET) return;

  const signature = request.headers['x-twilio-signature'] as string | undefined;
  const url = `https://${env.API_DOMAIN}${request.url}`;
  const params = (request.body as Record<string, string>) ?? {};

  const isValid = twilio.validateRequest(
    env.TWILIO_WEBHOOK_SECRET,
    signature ?? '',
    url,
    params,
  );

  if (!isValid) {
    throw new UnauthorizedError('Invalid Twilio signature');
  }
}
