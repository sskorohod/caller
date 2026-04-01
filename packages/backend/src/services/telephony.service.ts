import twilio from 'twilio';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../config/db.js';
import { providerCredentials, telephonyConnections } from '../db/schema.js';
import { decrypt } from '../lib/crypto.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { env } from '../config/env.js';
import type { TelephonyConnection, ProviderName } from '../models/types.js';

interface TwilioCredentials {
  account_sid: string;
  auth_token: string;
}

async function getTwilioClient(workspaceId: string): Promise<twilio.Twilio> {
  const [row] = await db
    .select({ credential_data: providerCredentials.credential_data })
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.workspace_id, workspaceId),
        eq(providerCredentials.provider, 'twilio'),
      ),
    );

  if (!row) throw new ValidationError('Twilio credentials not configured');

  const creds: TwilioCredentials = JSON.parse(decrypt(row.credential_data));
  return twilio(creds.account_sid, creds.auth_token);
}

export async function getOutboundConnection(workspaceId: string): Promise<TelephonyConnection> {
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

  if (!row) throw new ValidationError('No outbound telephony connection configured');
  return row as unknown as TelephonyConnection;
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

  // Start recording
  twiml.record({
    recordingStatusCallback: `https://${env.API_DOMAIN}/webhooks/twilio/recording`,
    recordingStatusCallbackMethod: 'POST',
    trim: 'trim-silence',
  });

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
  return created as unknown as TelephonyConnection;
}
