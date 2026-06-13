import twilio from 'twilio';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../lib/errors.js';

/**
 * Validate that incoming requests are actually from Twilio.
 * Uses Twilio's X-Twilio-Signature header and the webhook auth token.
 */
export async function validateTwilioSignature(request: FastifyRequest, reply: FastifyReply) {
  // When TWILIO_WEBHOOK_SECRET is not set, skip validation but warn loudly.
  // (An earlier fail-closed version rejected ALL Twilio webhooks on deployments
  // without the secret — taking the translator down. The secret must be the
  // Twilio AUTH TOKEN; enable it deliberately and verify with a live call.)
  if (!env.TWILIO_WEBHOOK_SECRET) {
    // Fail CLOSED in production: an unset secret there means every Twilio
    // webhook (/inbound, /status, /recording) is forgeable. Only tolerate the
    // warn-and-skip path in development. (Prod sets the secret via .env, so this
    // branch is not normally reached.)
    if (env.NODE_ENV === 'production') {
      request.log.error('TWILIO_WEBHOOK_SECRET not set in production — rejecting Twilio webhook');
      throw new UnauthorizedError('Twilio webhook authentication is not configured');
    }
    request.log.warn('TWILIO_WEBHOOK_SECRET not set — Twilio webhook signature validation is OFF (dev only)');
    return;
  }

  // Skip validation for voice-client (called by Twilio Client SDK from browser, not Twilio servers).
  // Match the route path exactly after stripping the query string. A substring
  // check on the full URL was a signature-validation bypass: an attacker could
  // forge any Twilio webhook (e.g. /status?x=/voice-client) to skip the check.
  if (request.url.split('?')[0].endsWith('/voice-client')) return;

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
