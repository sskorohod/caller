/**
 * Reminders scheduler. A BullMQ repeatable job ticks every minute, scans
 * `reminders` for due rows (status='pending' AND remind_at <= now), fires
 * each, and advances recurrence / marks one-offs done.
 *
 * Durable: the reminders table is the source of truth — a backend restart
 * never loses a pending reminder (unlike the old in-memory setTimeout).
 */
import { Worker, Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { redis } from '../config/redis.js';
import { db } from '../config/db.js';
import { providerCredentials } from '../db/schema.js';
import { decrypt } from '../lib/crypto.js';
import { dueReminders, fireReminder, type ReminderRow } from '../services/reminder.service.js';
import pino from 'pino';

const logger = pino({ name: 'reminders-worker' });

export const remindersQueue = new Queue('reminders', { connection: redis });

/** Resolve a workspace's Telegram bot token (cached per tick). */
async function botTokenFor(workspaceId: string, cache: Map<string, string | null>): Promise<string | null> {
  if (cache.has(workspaceId)) return cache.get(workspaceId)!;
  let token: string | null = null;
  const creds = await db.select({
    provider: providerCredentials.provider,
    credential_data: providerCredentials.credential_data,
  }).from(providerCredentials).where(eq(providerCredentials.workspace_id, workspaceId));
  for (const c of creds) {
    if (c.provider !== 'telegram') continue;
    try {
      const parsed = JSON.parse(decrypt(c.credential_data)) as { bot_token?: string };
      if (parsed.bot_token) token = parsed.bot_token;
    } catch { /* skip */ }
  }
  cache.set(workspaceId, token);
  return token;
}

async function processTick(): Promise<void> {
  const due: ReminderRow[] = await dueReminders();
  if (due.length === 0) return;

  const tokenCache = new Map<string, string | null>();
  for (const row of due) {
    try {
      const botToken = await botTokenFor(row.workspace_id, tokenCache);
      if (!botToken) {
        logger.warn({ reminderId: row.id, workspaceId: row.workspace_id }, 'Reminder due but no Telegram bot');
        continue;
      }
      await fireReminder(row, botToken);
      logger.info({ reminderId: row.id, kind: row.kind }, 'Reminder fired');
    } catch (err) {
      logger.error({ err, reminderId: row.id }, 'Failed to fire reminder');
    }
  }
}

export function startRemindersWorker(): Worker {
  const worker = new Worker(
    'reminders',
    async () => { await processTick(); },
    { connection: redis, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Reminders job failed');
  });

  // Every-minute repeatable schedule (idempotent across redeploys).
  remindersQueue.upsertJobScheduler(
    'reminders-minutely',
    { pattern: '* * * * *' },
    { name: 'tick', data: {} },
  ).catch(err => logger.error({ err }, 'Failed to register reminders scheduler'));

  return worker;
}
