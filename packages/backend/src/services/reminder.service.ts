/**
 * Standalone reminders — Apple-style. Natural-language creation, durable
 * scheduling (the row is the source of truth, scanned every minute by
 * reminders.worker.ts), snooze, recurrence (daily / weekdays / weekly).
 */
import { and, asc, eq, lte } from 'drizzle-orm';
import { db } from '../config/db.js';
import { reminders } from '../db/schema.js';
import { createLLMProvider, type LLMMessage } from './llm.service.js';
import {
  sendTelegramMessageWithButtons,
  sendMissionPlanCard,
} from './telegram.service.js';
import pino from 'pino';

const log = pino({ name: 'reminder-service' });

export type Recurrence = 'daily' | 'weekdays' | 'weekly' | null;

export interface ReminderRow {
  id: string;
  workspace_id: string;
  chat_id: string;
  kind: string;
  text: string;
  payload: Record<string, unknown>;
  remind_at: Date;
  timezone: string;
  recurrence: string | null;
  status: string;
  fired_count: number;
  last_fired_at: Date | null;
}

// ─── Timezone helpers ───────────────────────────────────────────────────────

/** Offset (ms) of a timezone at a given instant: localWallTime - utcTime. */
function tzOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date);
  const g = (t: string) => parseInt(parts.find(p => p.type === t)?.value || '0', 10);
  let h = g('hour'); if (h === 24) h = 0;
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), h, g('minute'), g('second'));
  return asUtc - date.getTime();
}

/** Convert a wall-clock time in a timezone to the correct UTC Date. */
function zonedWallTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  let utc = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const offset = tzOffsetMs(new Date(utc), tz);
    utc = Date.UTC(y, mo - 1, d, h, mi) - offset;
  }
  return new Date(utc);
}

/** Local wall-clock parts of an instant in a timezone. */
function localParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(date);
  const g = (t: string) => parts.find(p => p.type === t)?.value || '';
  let h = parseInt(g('hour'), 10); if (h === 24) h = 0;
  return {
    year: parseInt(g('year'), 10), month: parseInt(g('month'), 10),
    day: parseInt(g('day'), 10), hour: h, minute: parseInt(g('minute'), 10),
    weekday: g('weekday'), // Mon/Tue/...
  };
}

/**
 * Next occurrence of a recurring reminder — preserves the local wall-clock
 * time of day across DST. Returns null for one-off reminders.
 */
export function nextOccurrence(remindAt: Date, recurrence: Recurrence, tz: string): Date | null {
  if (!recurrence) return null;
  const p = localParts(remindAt, tz);
  // Advance by whole local days until the recurrence rule is satisfied.
  let addDays = recurrence === 'weekly' ? 7 : 1;
  const buildAt = (extra: number) => {
    const base = new Date(Date.UTC(p.year, p.month - 1, p.day));
    base.setUTCDate(base.getUTCDate() + extra);
    return zonedWallTimeToUtc(
      base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(),
      p.hour, p.minute, tz,
    );
  };
  let candidate = buildAt(addDays);
  if (recurrence === 'weekdays') {
    // skip Sat/Sun
    while (['Sat', 'Sun'].includes(localParts(candidate, tz).weekday)) {
      addDays += 1;
      candidate = buildAt(addDays);
    }
  }
  return candidate;
}

// ─── Natural-language parsing ───────────────────────────────────────────────

export interface ParsedReminder {
  text: string | null;
  remind_at: string | null; // ISO UTC
  recurrence: Recurrence;
  needs_time: boolean;
}

/**
 * Parse a free-form phrase ("напомни позвонить маме завтра в 17:00") into a
 * structured reminder using an LLM. Returns needs_time=true if no time could
 * be determined.
 */
export async function parseReminder(workspaceId: string, phrase: string, tz: string): Promise<ParsedReminder> {
  let llm;
  let selected: string = 'anthropic';
  for (const provider of ['anthropic', 'xai', 'openai'] as const) {
    try { llm = await createLLMProvider(workspaceId, provider); selected = provider; break; }
    catch { /* next */ }
  }
  if (!llm) return { text: phrase, remind_at: null, recurrence: null, needs_time: true };

  const model = ({ anthropic: 'claude-sonnet-4-5-20250514', xai: 'grok-3-mini-fast', openai: 'gpt-4o-mini' } as Record<string, string>)[selected];

  const nowLocal = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'long',
  }).format(new Date());

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `You parse a reminder phrase into JSON. The user's timezone is ${tz}. Current local date/time: ${nowLocal}.

Extract:
- "text": what to be reminded about, cleaned up (remove "напомни/remind me" etc). Keep the user's language.
- "remind_at": the absolute moment, ISO 8601 WITH timezone offset (e.g. "2026-05-21T17:00:00-07:00"). Resolve relative expressions ("завтра", "через 2 часа", "в пятницу") against the current local date/time. If NO time/date is expressed at all, set null.
- "recurrence": one of "daily", "weekdays", "weekly", or null. "каждый день"=daily, "по будням"=weekdays, "каждую неделю"/"каждый понедельник"=weekly.
- "needs_time": true if remind_at is null (could not determine when).

Respond with ONLY the JSON object, nothing else.`,
    },
    { role: 'user', content: phrase },
  ];

  let raw = '';
  try {
    await llm.generateStream(messages, model, 0.1, {
      onToken: () => {},
      onComplete: (r) => { raw = r.text; },
      onError: () => {},
    });
  } catch (err) {
    log.warn({ err }, 'Reminder parse LLM error');
  }

  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { text: phrase, remind_at: null, recurrence: null, needs_time: true };
    const parsed = JSON.parse(m[0]);
    const rec = ['daily', 'weekdays', 'weekly'].includes(parsed.recurrence) ? parsed.recurrence : null;
    const remindAt = parsed.remind_at ? new Date(parsed.remind_at) : null;
    const valid = remindAt && !isNaN(remindAt.getTime());
    return {
      text: parsed.text || phrase,
      remind_at: valid ? remindAt!.toISOString() : null,
      recurrence: rec,
      needs_time: !valid,
    };
  } catch {
    return { text: phrase, remind_at: null, recurrence: null, needs_time: true };
  }
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function createReminder(params: {
  workspaceId: string;
  chatId: string;
  text: string;
  remindAt: Date;
  timezone: string;
  recurrence?: Recurrence;
  kind?: string;
  payload?: Record<string, unknown>;
}): Promise<ReminderRow> {
  const [row] = await db.insert(reminders).values({
    workspace_id: params.workspaceId,
    chat_id: params.chatId,
    kind: params.kind ?? 'generic',
    text: params.text,
    payload: params.payload ?? {},
    remind_at: params.remindAt,
    timezone: params.timezone,
    recurrence: params.recurrence ?? null,
    status: 'pending',
  }).returning();
  return row as ReminderRow;
}

export async function listReminders(workspaceId: string, status?: string): Promise<ReminderRow[]> {
  const rows = await db.select().from(reminders)
    .where(status
      ? and(eq(reminders.workspace_id, workspaceId), eq(reminders.status, status))
      : eq(reminders.workspace_id, workspaceId))
    .orderBy(asc(reminders.remind_at));
  return rows as ReminderRow[];
}

export async function getReminder(id: string, workspaceId?: string): Promise<ReminderRow | null> {
  const [row] = await db.select().from(reminders)
    .where(workspaceId
      ? and(eq(reminders.id, id), eq(reminders.workspace_id, workspaceId))
      : eq(reminders.id, id))
    .limit(1);
  return (row as ReminderRow) ?? null;
}

export async function cancelReminder(id: string, workspaceId?: string): Promise<void> {
  await db.update(reminders)
    .set({ status: 'cancelled', updated_at: new Date() })
    .where(workspaceId
      ? and(eq(reminders.id, id), eq(reminders.workspace_id, workspaceId))
      : eq(reminders.id, id));
}

export async function completeReminder(id: string, workspaceId?: string): Promise<void> {
  await db.update(reminders)
    .set({ status: 'done', updated_at: new Date() })
    .where(workspaceId
      ? and(eq(reminders.id, id), eq(reminders.workspace_id, workspaceId))
      : eq(reminders.id, id));
}

/** Snooze: reactivate with a new remind_at. spec = minutes, or 'tomorrow'. */
export async function snoozeReminder(id: string, spec: number | 'tomorrow', workspaceId?: string): Promise<Date | null> {
  const row = await getReminder(id, workspaceId);
  if (!row) return null;
  let next: Date;
  if (spec === 'tomorrow') {
    // tomorrow 09:00 local
    const p = localParts(new Date(), row.timezone);
    const base = new Date(Date.UTC(p.year, p.month - 1, p.day));
    base.setUTCDate(base.getUTCDate() + 1);
    next = zonedWallTimeToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), 9, 0, row.timezone);
  } else {
    next = new Date(Date.now() + spec * 60_000);
  }
  await db.update(reminders)
    .set({ status: 'pending', remind_at: next, updated_at: new Date() })
    .where(eq(reminders.id, id));
  return next;
}

// ─── Firing ─────────────────────────────────────────────────────────────────

/** Snooze buttons shown on a fired generic reminder. */
function fireButtons(id: string) {
  return [
    [
      { text: '✅ Готово', callback_data: `reminder:done:${id}` },
      { text: '😴 10 мин', callback_data: `reminder:snooze:10:${id}` },
    ],
    [
      { text: '⏰ 1 час', callback_data: `reminder:snooze:60:${id}` },
      { text: '📅 Завтра 9:00', callback_data: `reminder:snooze:tomorrow:${id}` },
    ],
  ];
}

/**
 * Fire a due reminder: send the Telegram notification, then advance
 * recurrence (stays pending) or mark a one-off as done.
 */
export async function fireReminder(row: ReminderRow, botToken: string): Promise<void> {
  try {
    if (row.kind === 'mission_plan') {
      const missionId = String((row.payload as any)?.missionId || '');
      await sendTelegramMessageWithButtons(botToken, row.chat_id, '⏰ <b>Напоминание!</b> Время звонить:', []);
      if (missionId) {
        await sendMissionPlanCard(botToken, row.chat_id, missionId, row.text);
      }
    } else {
      await sendTelegramMessageWithButtons(
        botToken, row.chat_id,
        `🔔 <b>Напоминание</b>\n\n${row.text}`,
        fireButtons(row.id),
      );
    }
  } catch (err) {
    log.error({ err, reminderId: row.id }, 'Failed to send reminder notification');
  }

  const next = nextOccurrence(row.remind_at, row.recurrence as Recurrence, row.timezone);
  if (next) {
    await db.update(reminders).set({
      remind_at: next,
      fired_count: row.fired_count + 1,
      last_fired_at: new Date(),
      updated_at: new Date(),
    }).where(eq(reminders.id, row.id));
  } else {
    await db.update(reminders).set({
      status: 'done',
      fired_count: row.fired_count + 1,
      last_fired_at: new Date(),
      updated_at: new Date(),
    }).where(eq(reminders.id, row.id));
  }
}

/** Reminders due now (for the worker). */
export async function dueReminders(): Promise<ReminderRow[]> {
  const rows = await db.select().from(reminders)
    .where(and(eq(reminders.status, 'pending'), lte(reminders.remind_at, new Date())));
  return rows as ReminderRow[];
}

// ─── Formatting ─────────────────────────────────────────────────────────────

const RECUR_LABEL: Record<string, string> = {
  daily: 'каждый день', weekdays: 'по будням', weekly: 'каждую неделю',
};

/** Human-readable "когда" for a reminder, in its timezone. */
export function formatWhen(remindAt: Date, recurrence: string | null, tz: string): string {
  const datePart = new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz, day: 'numeric', month: 'long', weekday: 'short',
  }).format(remindAt);
  const timePart = new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(remindAt);
  const rec = recurrence ? ` 🔁 ${RECUR_LABEL[recurrence] ?? recurrence}` : '';
  return `${datePart}, ${timePart}${rec}`;
}
