import twilio from 'twilio';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../config/db.js';
import { providerCredentials, telephonyConnections, workspaces, workspaceMembers } from '../db/schema.js';
import { decrypt, encrypt } from '../lib/crypto.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { env } from '../config/env.js';
import type { TelephonyConnection, ProviderName } from '../models/types.js';
import pino from 'pino';

const logger = pino({ name: 'telephony' });

interface TwilioCredentials {
  account_sid: string;
  auth_token: string;
  api_key_sid?: string;
  api_key_secret?: string;
  twiml_app_sid?: string;
}

async function resolveTwilioWorkspaceId(workspaceId: string): Promise<string> {
  const { resolveCredentialWorkspaceId } = await import('./credential-resolver.service.js');
  return resolveCredentialWorkspaceId(workspaceId, 'twilio');
}

export async function getTwilioCreds(workspaceId: string): Promise<TwilioCredentials> {
  const { resolveCredentials } = await import('./credential-resolver.service.js');
  return resolveCredentials<TwilioCredentials>(workspaceId, 'twilio');
}

async function saveTwilioCreds(workspaceId: string, creds: TwilioCredentials): Promise<void> {
  const resolvedId = await resolveTwilioWorkspaceId(workspaceId);
  await db.update(providerCredentials)
    .set({ credential_data: encrypt(JSON.stringify(creds)) })
    .where(
      and(
        eq(providerCredentials.workspace_id, resolvedId),
        eq(providerCredentials.provider, 'twilio'),
      ),
    );
}

async function getTwilioClient(workspaceId: string): Promise<twilio.Twilio> {
  const creds = await getTwilioCreds(workspaceId);
  return twilio(creds.account_sid, creds.auth_token);
}

export async function getOutboundConnection(workspaceId: string): Promise<TelephonyConnection> {
  // Try own connections first
  const [row] = await db
    .select()
    .from(telephonyConnections)
    .where(
      and(
        eq(telephonyConnections.workspace_id, workspaceId),
        eq(telephonyConnections.outbound_enabled, true),
      ),
    )
    .limit(1);

  if (row) return row as unknown as TelephonyConnection;

  // Fallback — use owner workspace connections (platform shared Twilio)
  // Always try fallback if no own connection found
  {
    const [ownerRow] = await db
      .select({ workspace_id: workspaceMembers.workspace_id })
      .from(workspaceMembers)
      .innerJoin(providerCredentials, and(
        eq(providerCredentials.workspace_id, workspaceMembers.workspace_id),
        eq(providerCredentials.provider, 'twilio'),
      ))
      .where(eq(workspaceMembers.role, 'owner'))
      .limit(1);

    if (ownerRow) {
      const [platformConn] = await db.select()
        .from(telephonyConnections)
        .where(and(
          eq(telephonyConnections.workspace_id, ownerRow.workspace_id),
          eq(telephonyConnections.outbound_enabled, true),
        ))
        .limit(1);
      if (platformConn) return platformConn as unknown as TelephonyConnection;
    }
  }

  throw new ValidationError('No outbound telephony connection configured');
}

export async function getConnectionByNumber(workspaceId: string, phoneNumber: string): Promise<TelephonyConnection | null> {
  const [row] = await db
    .select()
    .from(telephonyConnections)
    .where(
      and(
        eq(telephonyConnections.workspace_id, workspaceId),
        eq(telephonyConnections.phone_number, phoneNumber),
      ),
    );

  return row ? (row as unknown as TelephonyConnection) : null;
}

export async function initiateOutboundCall(params: {
  workspaceId: string;
  to: string;
  from: string;
  callId: string;
  statusCallbackUrl: string;
  streamUrl: string;
}): Promise<string> {
  const client = await getTwilioClient(params.workspaceId);

  const twiml = new twilio.twiml.VoiceResponse();
  const connect = twiml.connect();
  connect.stream({
    url: params.streamUrl,
    name: `call-${params.callId}`,
  });

  const call = await client.calls.create({
    twiml: twiml.toString(),
    to: params.to,
    from: params.from,
    record: true,
    recordingStatusCallback: `https://${env.API_DOMAIN}/webhooks/twilio/recording`,
    recordingStatusCallbackMethod: 'POST',
    statusCallback: params.statusCallbackUrl,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
  });

  return call.sid;
}

/** Generate TwiML for inbound call — connects to MediaStream + enables recording */
export function generateInboundTwiml(params: {
  callId: string;
  streamUrl: string;
  disclosureMessage?: string;
}): string {
  const twiml = new twilio.twiml.VoiceResponse();

  // Optional recording disclosure
  if (params.disclosureMessage) {
    twiml.say({ voice: 'Polly.Joanna' }, params.disclosureMessage);
  }

  const connect = twiml.connect();
  connect.stream({
    url: params.streamUrl,
    name: `call-${params.callId}`,
  });

  return twiml.toString();
}

export async function listTelephonyConnections(workspaceId: string): Promise<TelephonyConnection[]> {
  const rows = await db
    .select()
    .from(telephonyConnections)
    .where(eq(telephonyConnections.workspace_id, workspaceId))
    .orderBy(asc(telephonyConnections.created_at));

  return rows as unknown as TelephonyConnection[];
}

export async function updateActiveCall(workspaceId: string, callSid: string, twiml: string): Promise<void> {
  const client = await getTwilioClient(workspaceId);
  await client.calls(callSid).update({ twiml });
}

export async function hangupCall(workspaceId: string, callSid: string): Promise<void> {
  const client = await getTwilioClient(workspaceId);
  await client.calls(callSid).update({ status: 'completed' });
}

/** Start recording on an already-connected call (used for inbound calls). */
export async function startCallRecording(workspaceId: string, callSid: string): Promise<void> {
  const client = await getTwilioClient(workspaceId);
  await client.calls(callSid).recordings.create({
    recordingStatusCallback: `https://${env.API_DOMAIN}/webhooks/twilio/recording`,
    recordingStatusCallbackMethod: 'POST',
  });
  logger.info({ workspaceId, callSid }, 'Started call recording via REST API');
}

export async function createTelephonyConnection(params: {
  workspaceId: string;
  phoneNumber: string;
  friendlyName?: string;
  twilioSid?: string;
  inboundEnabled?: boolean;
  outboundEnabled?: boolean;
  aiAnsweringEnabled?: boolean;
  defaultAgentProfileId?: string;
}): Promise<TelephonyConnection> {
  const [created] = await db
    .insert(telephonyConnections)
    .values({
      workspace_id: params.workspaceId,
      phone_number: params.phoneNumber,
      friendly_name: params.friendlyName ?? null,
      twilio_sid: params.twilioSid ?? null,
      inbound_enabled: params.inboundEnabled ?? false,
      outbound_enabled: params.outboundEnabled ?? true,
      ai_answering_enabled: params.aiAnsweringEnabled ?? false,
      default_agent_profile_id: params.defaultAgentProfileId ?? null,
    })
    .returning();

  if (!created) throw new Error('Failed to create connection');

  // Auto-configure Twilio webhook if AI answering enabled
  if (params.aiAnsweringEnabled && params.twilioSid) {
    configureTwilioInboundWebhook(params.workspaceId, params.twilioSid, true)
      .catch(err => logger.warn({ err, workspaceId: params.workspaceId }, 'Failed to auto-configure Twilio webhook on creation'));
  }

  return created as unknown as TelephonyConnection;
}

/**
 * Configure Twilio phone number Voice URL for inbound call handling.
 * Called when ai_answering_enabled is toggled.
 */
export async function configureTwilioInboundWebhook(workspaceId: string, twilioSid: string, enabled: boolean): Promise<void> {
  const creds = await getTwilioCreds(workspaceId);
  const client = twilio(creds.account_sid, creds.auth_token);

  if (enabled) {
    await client.incomingPhoneNumbers(twilioSid).update({
      voiceUrl: `https://${env.API_DOMAIN}/webhooks/twilio/inbound`,
      voiceMethod: 'POST',
      statusCallback: `https://${env.API_DOMAIN}/webhooks/twilio/status`,
      statusCallbackMethod: 'POST',
    });
    logger.info({ workspaceId, twilioSid }, 'Configured Twilio inbound webhook');
  } else {
    await client.incomingPhoneNumbers(twilioSid).update({
      voiceUrl: '',
      statusCallback: '',
    });
    logger.info({ workspaceId, twilioSid }, 'Cleared Twilio inbound webhook');
  }
}

// ─── Twilio Voice SDK (Browser) ─────────────────────────────────────────────

/**
 * Auto-provision API Key for Twilio Voice SDK.
 * Stores key alongside existing credentials.
 */
async function getOrCreateApiKey(workspaceId: string): Promise<{ accountSid: string; apiKeySid: string; apiKeySecret: string }> {
  const creds = await getTwilioCreds(workspaceId);

  if (creds.api_key_sid && creds.api_key_secret) {
    return { accountSid: creds.account_sid, apiKeySid: creds.api_key_sid, apiKeySecret: creds.api_key_secret };
  }

  // Create new API Key
  const client = twilio(creds.account_sid, creds.auth_token);
  const key = await client.newKeys.create({ friendlyName: 'Caller Browser Voice' });

  creds.api_key_sid = key.sid;
  creds.api_key_secret = key.secret;
  await saveTwilioCreds(workspaceId, creds);

  logger.info({ workspaceId, keySid: key.sid }, 'Auto-provisioned Twilio API Key for Voice SDK');
  return { accountSid: creds.account_sid, apiKeySid: key.sid, apiKeySecret: key.secret };
}

/**
 * Auto-provision TwiML App for browser-based calls.
 */
async function getOrCreateTwimlApp(workspaceId: string): Promise<string> {
  const creds = await getTwilioCreds(workspaceId);

  if (creds.twiml_app_sid) {
    return creds.twiml_app_sid;
  }

  const client = twilio(creds.account_sid, creds.auth_token);
  const app = await client.applications.create({
    voiceUrl: `https://${env.API_DOMAIN}/webhooks/twilio/voice-client`,
    voiceMethod: 'POST',
    friendlyName: 'Caller Browser Voice',
  });

  creds.twiml_app_sid = app.sid;
  await saveTwilioCreds(workspaceId, creds);

  logger.info({ workspaceId, appSid: app.sid }, 'Auto-provisioned TwiML App for Voice SDK');
  return app.sid;
}

/**
 * Generate a Twilio AccessToken with VoiceGrant for browser-based calling.
 */
export async function generateVoiceToken(workspaceId: string, userId: string): Promise<{ token: string; identity: string }> {
  const { accountSid, apiKeySid, apiKeySecret } = await getOrCreateApiKey(workspaceId);
  const twimlAppSid = await getOrCreateTwimlApp(workspaceId);

  const identity = `operator_${userId}`;

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity,
    ttl: 3600,
  });

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  token.addGrant(voiceGrant);

  return { token: token.toJwt(), identity };
}
