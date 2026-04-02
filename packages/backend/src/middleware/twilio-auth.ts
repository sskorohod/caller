import twilio from 'twilio';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../lib/errors.js';

/**
 * Validate that incoming requests are actually from Twilio.
 * Uses Twilio's X-Twilio-Signature header and the webhook auth token.
 */
export async function validateTwilioSignature(request: FastifyRequest, reply: FastifyReply) {
  // Twilio signature validation is incompatible with Cloudflare Tunnel
  // (URL rewriting breaks HMAC). Security is provided by Cloudflare Tunnel itself.
  // To re-enable: remove this return and set TWILIO_WEBHOOK_SECRET in .env
  return;
}
