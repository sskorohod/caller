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
    // Fail OPEN when the secret is unset: a prior fail-closed version (incl. a
    // production-only variant) took the translator down on deployments that run
    // without the secret. To actually enable validation, set TWILIO_WEBHOOK_SECRET
    // (the Twilio Auth Token) in .env and verify with a live call.
    request.log.warn('TWILIO_WEBHOOK_SECRET not set — Twilio webhook signature validation is OFF');
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
