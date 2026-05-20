/**
 * Daily evening check-in survey over Telegram.
 *
 * Flow (one question at a time):
 *   Q1 energy level  — 5 inline buttons
 *   Q2 lunch         — free text / voice
 *   Q3 dinner        — free text / voice
 *   Q4 highlight     — free text / voice
 *
 * The daily_check_ins row IS the conversation state. `current_question`
 * (1..4) says which answer is pending; a backend restart never loses
 * progress. One row per (workspace, chat, local date).
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { dailyCheckIns } from '../db/schema.js';
import {
  sendTelegramMessageWithButtons,
  sendTelegramPlainMessage,
} from './telegram.service.js';
import pino from 'pino';

const log = pino({ name: 'checkin-service' });

export type EnergyLevel = 'great' | 'good' | 'ok' | 'low' | 'drained';

const ENERGY_LABELS: Record<EnergyLevel, string> = {
  great: '🔥 Отличная',
  good: '🙂 Хорошая',
  ok: '😐 Средняя',
  low: '😕 Низкая',
  drained: '😴 Выжат',
};

const Q2_PROMPT = '🍽 Вопрос 2 из 4. Что было на обед? (можно текстом или голосовым)';
const Q3_PROMPT = '🌙 Вопрос 3 из 4. Что было на ужин? (можно текстом или голосовым)';
const Q4_PROMPT = '⭐️ Вопрос 4 из 4. Что было самое важное сегодня? (можно текстом или голосовым)';

interface CheckinRow {
  id: string;
  workspace_id: string;
  chat_id: string;
  checkin_date: string;
  status: string;
  current_question: number;
  energy_level: string | null;
  lunch: string | null;
  dinner: string | null;
  highlight: string | null;
}

/** Q1 — energy buttons. callback_data = checkin:energy:<level>:<checkinId> */
function energyButtons(checkinId: string) {
  return (Object.keys(ENERGY_LABELS) as EnergyLevel[]).map(level => [
    { text: ENERGY_LABELS[level], callback_data: `checkin:energy:${level}:${checkinId}` },
  ]);
}

/** Find today's in-progress check-in for a chat, if any. */
export async function findActiveCheckin(
  workspaceId: string,
  chatId: string,
  checkinDate: string,
): Promise<CheckinRow | null> {
  const [row] = await db.select().from(dailyCheckIns)
    .where(and(
      eq(dailyCheckIns.workspace_id, workspaceId),
      eq(dailyCheckIns.chat_id, chatId),
      eq(dailyCheckIns.checkin_date, checkinDate),
      eq(dailyCheckIns.status, 'in_progress'),
    ))
    .limit(1);
  return (row as CheckinRow) ?? null;
}

/** Find today's check-in regardless of status. */
export async function findCheckin(
  workspaceId: string,
  chatId: string,
  checkinDate: string,
): Promise<CheckinRow | null> {
  const [row] = await db.select().from(dailyCheckIns)
    .where(and(
      eq(dailyCheckIns.workspace_id, workspaceId),
      eq(dailyCheckIns.chat_id, chatId),
      eq(dailyCheckIns.checkin_date, checkinDate),
    ))
    .limit(1);
  return (row as CheckinRow) ?? null;
}

/**
 * Start a check-in: insert the row (or reuse an existing one) and send Q1.
 * Returns the row. Idempotent — if a row already exists for today it is
 * reused (resume), not duplicated.
 */
export async function startCheckin(
  workspaceId: string,
  botToken: string,
  chatId: string,
  checkinDate: string,
): Promise<CheckinRow> {
  const existing = await findCheckin(workspaceId, chatId, checkinDate);
  if (existing) {
    if (existing.status === 'completed') {
      await sendTelegramPlainMessage(botToken, chatId,
        `Чек-ин за сегодня уже заполнен ✅\n\n${formatSummary(existing)}`);
      return existing;
    }
    // in_progress — resume at the current question
    await resendCurrentQuestion(botToken, existing);
    return existing;
  }

  const [row] = await db.insert(dailyCheckIns).values({
    workspace_id: workspaceId,
    chat_id: chatId,
    checkin_date: checkinDate,
    status: 'in_progress',
    current_question: 1,
  }).returning();

  const created = row as CheckinRow;
  await sendTelegramMessageWithButtons(botToken, chatId,
    '🌆 <b>Вечерний чек-ин</b>\n\nВопрос 1 из 4. Какой был уровень энергии за день?',
    energyButtons(created.id));
  log.info({ workspaceId, chatId, checkinId: created.id }, 'Check-in started');
  return created;
}

/** Re-send whatever question is currently pending (used for /checkin resume). */
export async function resendCurrentQuestion(botToken: string, row: CheckinRow): Promise<void> {
  switch (row.current_question) {
    case 1:
      await sendTelegramMessageWithButtons(botToken, row.chat_id,
        '🌆 <b>Вечерний чек-ин</b>\n\nВопрос 1 из 4. Какой был уровень энергии за день?',
        energyButtons(row.id));
      break;
    case 2:
      await sendTelegramPlainMessage(botToken, row.chat_id, Q2_PROMPT);
      break;
    case 3:
      await sendTelegramPlainMessage(botToken, row.chat_id, Q3_PROMPT);
      break;
    case 4:
      await sendTelegramPlainMessage(botToken, row.chat_id, Q4_PROMPT);
      break;
  }
}

/** Q1 answered via energy button. Advances to Q2. */
export async function recordEnergyAnswer(
  botToken: string,
  checkinId: string,
  level: EnergyLevel,
): Promise<void> {
  const [row] = await db.update(dailyCheckIns)
    .set({ energy_level: level, current_question: 2, updated_at: new Date() })
    .where(and(eq(dailyCheckIns.id, checkinId), eq(dailyCheckIns.status, 'in_progress')))
    .returning();
  if (!row) return; // already completed or gone
  await sendTelegramPlainMessage(botToken, (row as CheckinRow).chat_id, Q2_PROMPT);
}

/**
 * A free-text/voice answer to Q2/Q3/Q4. Writes the field, advances, and
 * either prompts the next question or finishes with a summary.
 */
export async function recordTextAnswer(
  botToken: string,
  row: CheckinRow,
  text: string,
): Promise<void> {
  const answer = text.trim();
  if (!answer) return;

  if (row.current_question === 2) {
    await db.update(dailyCheckIns)
      .set({ lunch: answer, current_question: 3, updated_at: new Date() })
      .where(eq(dailyCheckIns.id, row.id));
    await sendTelegramPlainMessage(botToken, row.chat_id, Q3_PROMPT);
  } else if (row.current_question === 3) {
    await db.update(dailyCheckIns)
      .set({ dinner: answer, current_question: 4, updated_at: new Date() })
      .where(eq(dailyCheckIns.id, row.id));
    await sendTelegramPlainMessage(botToken, row.chat_id, Q4_PROMPT);
  } else if (row.current_question === 4) {
    const [updated] = await db.update(dailyCheckIns)
      .set({ highlight: answer, status: 'completed', updated_at: new Date() })
      .where(eq(dailyCheckIns.id, row.id))
      .returning();
    await sendTelegramPlainMessage(botToken, row.chat_id, formatSummary(updated as CheckinRow));
    log.info({ checkinId: row.id }, 'Check-in completed');
  }
}

/** Final confirmation message. */
export function formatSummary(row: CheckinRow): string {
  const energy = row.energy_level
    ? (ENERGY_LABELS[row.energy_level as EnergyLevel] ?? row.energy_level)
    : '—';
  const date = new Date(row.checkin_date + 'T00:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long',
  });
  return [
    `✅ <b>Чек-ин за ${date}</b>`,
    '',
    `Энергия: ${energy}`,
    `🍽 Обед: ${row.lunch ?? '—'}`,
    `🌙 Ужин: ${row.dinner ?? '—'}`,
    `⭐️ Важное: ${row.highlight ?? '—'}`,
  ].join('\n');
}
