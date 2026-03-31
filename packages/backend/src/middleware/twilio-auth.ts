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

  const signature = request.headers['x-twilio-signature'] as string | undefined;
  if (!signature) throw new UnauthorizedError('Missing Twilio signature');

  const protocol = request.headers['x-forwarded-proto'] ?? 'https';
  const host = env.API_DOMAIN;
  const url = `${protocol}://${host}${request.url}`;

  const isValid = twilio.validateRequest(
    env.TWILIO_WEBHOOK_SECRET,
    signature,
    url,
    request.body as Record<string, string>,
  );

  if (!isValid) throw new UnauthorizedError('Invalid Twilio signature');
}
