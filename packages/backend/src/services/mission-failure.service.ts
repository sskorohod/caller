import { eq, and } from 'drizzle-orm';
import pino from 'pino';
import { db } from '../config/db.js';
import {
  missions,
  providerCredentials,
  type MissionOutcome,
  type MissionFailureReason,
  type MissionPostponePreset,
} from '../db/schema.js';
import { decrypt } from '../lib/crypto.js';
import {
  sendTelegramMessageWithButtonsReturningId,
  editTelegramMessageButtons,
} from './telegram.service.js';
import { queueMissionScheduledRun, cancelMissionScheduledRun } from '../workers/mission-scheduled.worker.js';
import { executeMission, getMission } from './mission.service.js';
import { getIo } from '../realtime/io.js';

const logger = pino({ name: 'mission-failure' });

const REASON_LABELS_RU: Record<MissionFailureReason, string> = {
  no_answer: 'не взяли трубку',
  busy: 'занято',
  voicemail: 'автоответчик',
  error: 'ошибка соединения',
};

const PRESET_OFFSETS_MS: Record<Exclude<MissionPostponePreset, 'tomorrow_10'>, number> = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
};

export function reasonLabel(reason: MissionFailureReason | undefined): string {
  return reason ? REASON_LABELS_RU[reason] : 'неизвестная причина';
}

export function presetToScheduledAt(preset: MissionPostponePreset, now = new Date()): Date {
  if (preset === 'tomorrow_10') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  }
  return new Date(now.getTime() + PRESET_OFFSETS_MS[preset]);
}

function fmtTime(d: Date): string {
  return d.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

interface TelegramCreds { bot_token: string; chat_id: string }

async function getTelegramCreds(workspaceId: string): Promise<TelegramCreds | null> {
  const rows = await db.select({ credential_data: providerCredentials.credential_data })
    .from(providerCredentials)
    .where(and(
      eq(providerCredentials.workspace_id, workspaceId),
      eq(providerCredentials.provider, 'telegram'),
    ));
  for (const row of rows) {
    try {
      const c = JSON.parse(decrypt(row.credential_data)) as TelegramCreds;
      if (c.bot_token && c.chat_id) return c;
    } catch { /* skip */ }
  }
  return null;
}

function buildPromptText(missionTitleOrGoal: string, reason: MissionFailureReason | undefined): string {
  const safeTitle = missionTitleOrGoal.length > 80 ? missionTitleOrGoal.slice(0, 77) + '…' : missionTitleOrGoal;
  return [
    `❌ <b>Миссия не удалась</b>`,
    `«${escapeHtml(safeTitle)}» — ${reasonLabel(reason)}.`,
    '',
    'Что дальше?',
  ].join('\n');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildPromptButtons(missionId: string) {
  return [
    [
      { text: '🔄 Повторить сейчас', callback_data: `mfail:retry:${missionId}` },
      { text: '✖️ Закрыть',          callback_data: `mfail:close:${missionId}` },
    ],
    [
      { text: '⏰ Отложить ▾',       callback_data: `mfail:postpone:${missionId}` },
    ],
  ];
}

export function buildPostponeMenu(missionId: string) {
  return [
    [
      { text: '+15 мин',    callback_data: `mfail:postpone:${missionId}:15m` },
      { text: '+1 ч',       callback_data: `mfail:postpone:${missionId}:1h` },
    ],
    [
      { text: '+3 ч',       callback_data: `mfail:postpone:${missionId}:3h` },
      { text: 'Завтра 10:00', callback_data: `mfail:postpone:${missionId}:tomorrow_10` },
    ],
    [
      { text: '← Назад',    callback_data: `mfail:back:${missionId}` },
    ],
  ];
}

/**
 * Send the failure prompt to the workspace's Telegram chat (if configured).
 * Idempotent: if a prompt was already sent for this mission, no-op.
 */
export async function notifyMissionFailure(missionId: string): Promise<void> {
  const [mission] = await db.select().from(missions).where(eq(missions.id, missionId));
  if (!mission) {
    logger.warn({ missionId }, 'notifyMissionFailure: mission not found');
    return;
  }

  const outcome = (mission.outcome as MissionOutcome | null) ?? {};

  // Skip if a prompt was already sent or the user already acted.
  if (outcome.failure_prompt_sent_at || outcome.failure_action_taken) {
    return;
  }

  const creds = await getTelegramCreds(mission.workspace_id);
  if (!creds) {
    // No Telegram → frontend FailureActionCard will still appear. Just stamp
    // sent_at so we don't keep retrying.
    await db.update(missions).set({
      outcome: { ...outcome, failure_prompt_sent_at: new Date().toISOString() } as any,
      updated_at: new Date(),
    }).where(eq(missions.id, missionId));
    return;
  }

  const text = buildPromptText(
    mission.title || mission.goal || 'без названия',
    outcome.failure_reason,
  );
  const messageId = await sendTelegramMessageWithButtonsReturningId(
    creds.bot_token,
    creds.chat_id,
    text,
    buildPromptButtons(missionId),
  );

  await db.update(missions).set({
    outcome: {
      ...outcome,
      failure_prompt_sent_at: new Date().toISOString(),
      failure_prompt_message_id: messageId ?? undefined,
      failure_prompt_chat_id: creds.chat_id,
    } as any,
    updated_at: new Date(),
  }).where(eq(missions.id, missionId));

  logger.info({ missionId, messageId }, 'Mission failure prompt sent to Telegram');
}

/**
 * Apply a user-chosen failure action. Used by both the Telegram callback
 * handler and the REST endpoint POST /api/missions/:id/failure-action.
 *
 * Returns the resolved scheduled time for postpone, or null otherwise.
 * Throws { statusCode: 409, message } if the mission was already acted upon
 * (race between Telegram and dashboard).
 */
export async function handleFailureAction(params: {
  workspaceId: string;
  missionId: string;
  action: 'retry' | 'postpone' | 'close';
  preset?: MissionPostponePreset;
}): Promise<{ scheduledAt: Date | null }> {
  const { workspaceId, missionId, action, preset } = params;

  const mission = await getMission(workspaceId, missionId);
  const outcome = (mission.outcome as MissionOutcome | null) ?? {};

  if (outcome.failure_action_taken) {
    const err: any = new Error(`Mission already handled: ${outcome.failure_action_taken}`);
    err.statusCode = 409;
    throw err;
  }

  const nowIso = new Date().toISOString();

  if (action === 'retry') {
    await db.update(missions).set({
      outcome: { ...outcome, failure_action_taken: 'retry', failure_action_at: nowIso } as any,
      updated_at: new Date(),
    }).where(eq(missions.id, missionId));

    await editPromptDone(missionId, '✓ Повтор запущен');

    // Reset retry_count so manual retry isn't blocked by historical attempts.
    await db.update(missions).set({ retry_count: 0 } as any).where(eq(missions.id, missionId));
    await executeMission(workspaceId, missionId);
    return { scheduledAt: null };
  }

  if (action === 'close') {
    await db.update(missions).set({
      outcome: { ...outcome, failure_action_taken: 'closed', failure_action_at: nowIso } as any,
      updated_at: new Date(),
    }).where(eq(missions.id, missionId));
    await editPromptDone(missionId, '✓ Закрыто');
    return { scheduledAt: null };
  }

  // postpone
  if (!preset) {
    const err: any = new Error('postpone requires a preset');
    err.statusCode = 400;
    throw err;
  }
  const scheduledAt = presetToScheduledAt(preset);
  const delayMs = scheduledAt.getTime() - Date.now();

  await db.update(missions).set({
    status: 'scheduled',
    scheduled_at: scheduledAt,
    outcome: {
      ...outcome,
      failure_action_taken: 'postponed',
      failure_action_at: nowIso,
      failure_postpone_preset: preset,
    } as any,
    updated_at: new Date(),
  }).where(eq(missions.id, missionId));

  await queueMissionScheduledRun(workspaceId, missionId, delayMs);

  const io = getIo();
  io?.to(`mission:${missionId}`).emit('mission:status', { mission_id: missionId, status: 'scheduled' });

  await editPromptDone(missionId, `✓ Отложено до ${fmtTime(scheduledAt)}`);
  return { scheduledAt };
}

/**
 * Edit the original Telegram prompt message: strip buttons, append a status line.
 * Best-effort — silently swallows errors (the action itself already succeeded).
 */
async function editPromptDone(missionId: string, statusLine: string): Promise<void> {
  try {
    const [mission] = await db.select().from(missions).where(eq(missions.id, missionId));
    if (!mission) return;
    const outcome = (mission.outcome as MissionOutcome | null) ?? {};
    const messageId = outcome.failure_prompt_message_id;
    const chatId = outcome.failure_prompt_chat_id;
    if (!messageId || !chatId) return;

    const creds = await getTelegramCreds(mission.workspace_id);
    if (!creds) return;

    const baseText = buildPromptText(
      mission.title || mission.goal || 'без названия',
      outcome.failure_reason,
    );
    await editTelegramMessageButtons(
      creds.bot_token,
      chatId,
      messageId,
      `${baseText}\n\n<i>${escapeHtml(statusLine)}</i>`,
      null,
    );
  } catch (err) {
    logger.warn({ err, missionId }, 'Failed to edit failure prompt message');
  }
}

/** Edit the prompt to swap the keyboard (back ↔ postpone-menu). */
export async function editPromptKeyboard(
  missionId: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>,
): Promise<void> {
  try {
    const [mission] = await db.select().from(missions).where(eq(missions.id, missionId));
    if (!mission) return;
    const outcome = (mission.outcome as MissionOutcome | null) ?? {};
    const messageId = outcome.failure_prompt_message_id;
    const chatId = outcome.failure_prompt_chat_id;
    if (!messageId || !chatId) return;

    const creds = await getTelegramCreds(mission.workspace_id);
    if (!creds) return;

    const baseText = buildPromptText(
      mission.title || mission.goal || 'без названия',
      outcome.failure_reason,
    );
    await editTelegramMessageButtons(creds.bot_token, chatId, messageId, baseText, buttons);
  } catch (err) {
    logger.warn({ err, missionId }, 'Failed to edit failure prompt keyboard');
  }
}

export { buildPromptButtons as buildFailurePromptButtons };

/**
 * Public helper for cancelling any pending scheduled run for a mission
 * (e.g. user manually executes from dashboard).
 */
export { cancelMissionScheduledRun };
