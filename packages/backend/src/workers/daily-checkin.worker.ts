/**
 * Daily check-in scheduler.
 *
 * A BullMQ repeatable job ticks hourly. On each tick we look at every
 * workspace with daily_checkin_enabled = true, compute the workspace-local
 * hour, and if it equals daily_checkin_hour (and no check-in row exists for
 * the local date yet) we start the survey over Telegram.
 *
 * Hourly polling + a "row already exists" guard is DST-proof, correct for
 * any timezone, and idempotent — much simpler than a timezone-aware cron.
 */
import { Worker, Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { redis } from '../config/redis.js';
import { db } from '../config/db.js';
import { workspaces, providerCredentials } from '../db/schema.js';
import { decrypt } from '../lib/crypto.js';
import { startCheckin, findCheckin } from '../services/checkin.service.js';
import pino from 'pino';

const logger = pino({ name: 'daily-checkin-worker' });

export const dailyCheckinQueue = new Queue('daily-checkin', { connection: redis });

/** Local hour (0-23) + ISO date (YYYY-MM-DD) for a timezone. */
function localHourAndDate(tz: string): { hour: number; date: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0; // some engines emit 24 for midnight
  return { hour, date: `${get('year')}-${get('month')}-${get('day')}` };
}

/** Resolve a workspace's Telegram bot token + chat id, if configured. */
async function resolveTelegram(workspaceId: string): Promise<{ botToken: string; chatId: string } | null> {
  const creds = await db.select({
    provider: providerCredentials.provider,
    credential_data: providerCredentials.credential_data,
  }).from(providerCredentials)
    .where(eq(providerCredentials.workspace_id, workspaceId));

  for (const c of creds) {
    if (c.provider !== 'telegram') continue;
    try {
      const parsed = JSON.parse(decrypt(c.credential_data)) as { bot_token?: string; chat_id?: string };
      if (parsed.bot_token && parsed.chat_id) {
        return { botToken: parsed.bot_token, chatId: parsed.chat_id };
      }
    } catch { /* skip malformed cred */ }
  }
  return null;
}

async function processTick(): Promise<void> {
  const enabled = await db.select().from(workspaces)
    .where(eq(workspaces.daily_checkin_enabled, true));
  if (enabled.length === 0) return;

  for (const ws of enabled) {
    try {
      const tz = ws.timezone || 'America/Los_Angeles';
      const { hour, date } = localHourAndDate(tz);
      if (hour !== ws.daily_checkin_hour) continue;

      const tg = await resolveTelegram(ws.id);
      if (!tg) {
        logger.warn({ workspaceId: ws.id }, 'Check-in due but no Telegram credentials');
        continue;
      }

      // Idempotency: skip if a row already exists for this local date.
      const dup = await findCheckin(ws.id, tg.chatId, date);
      if (dup) continue;

      await startCheckin(ws.id, tg.botToken, tg.chatId, date);
      logger.info({ workspaceId: ws.id, date }, 'Daily check-in sent');
    } catch (err) {
      logger.error({ err, workspaceId: ws.id }, 'Check-in tick failed for workspace');
    }
  }
}

export function startDailyCheckinWorker(): Worker {
  const worker = new Worker(
    'daily-checkin',
    async () => { await processTick(); },
    { connection: redis, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Daily check-in job failed');
  });

  // Register the hourly repeatable schedule (idempotent across redeploys).
  dailyCheckinQueue.upsertJobScheduler(
    'daily-checkin-hourly',
    { pattern: '0 * * * *' },
    { name: 'tick', data: {} },
  ).catch(err => logger.error({ err }, 'Failed to register check-in scheduler'));

  return worker;
}
