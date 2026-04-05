import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { providerCredentials } from '../db/schema.js';
import { decrypt } from '../lib/crypto.js';
import pino from 'pino';

const log = pino({ name: 'sms' });

/**
 * Send SMS via Twilio.
 * Uses workspace Twilio credentials from provider_credentials table.
 */
export async function sendSms(
  workspaceId: string,
  to: string,
  body: string,
  from?: string,
): Promise<boolean> {
  try {
    const [row] = await db.select()
      .from(providerCredentials)
      .where(and(
        eq(providerCredentials.workspace_id, workspaceId),
        eq(providerCredentials.provider, 'twilio'),
      ));

    if (!row) {
      log.warn({ workspaceId }, 'No Twilio credentials for SMS');
      return false;
    }

    const creds = JSON.parse(decrypt(row.credential_data)) as {
      account_sid: string;
      auth_token: string;
      phone_number?: string;
    };

    const fromNumber = from ?? creds.phone_number;
    if (!fromNumber) {
      log.warn({ workspaceId }, 'No from number for SMS');
      return false;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}/Messages.json`;
    const auth = Buffer.from(`${creds.account_sid}:${creds.auth_token}`).toString('base64');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      log.error({ workspaceId, to, status: res.status, err: err.slice(0, 200) }, 'SMS send failed');
      return false;
    }

    log.info({ workspaceId, to }, 'SMS sent');
    return true;
  } catch (err) {
    log.error({ err, workspaceId, to }, 'SMS send error');
    return false;
  }
}
