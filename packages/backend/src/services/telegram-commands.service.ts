/**
 * Telegram bot command handlers extracted from routes/webhooks/telegram.ts.
 * Uses a handler map pattern instead of switch/case.
 */
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../config/db.js';
import { translatorSessions, workspaceMembers } from '../db/schema.js';
import { env } from '../config/env.js';
import { getActiveConferenceTranslators } from '../routes/webhooks/media-stream.js';
import * as callService from './call.service.js';
import * as missionService from './mission.service.js';
import {
  sendTelegramPlainMessage,
  sendTelegramMessageWithButtons,
  sendTelegramMessageReturningId,
  editTelegramMessage,
} from './telegram.service.js';
import pino from 'pino';

const log = pino({ name: 'telegram-commands' });

// --- Types ---

interface TgContext {
  botToken: string;
  chatId: string;
  workspaceId: string;
}

type CommandHandler = (ctx: TgContext, args: string) => Promise<void>;
type CallbackHandler = (ctx: TgContext, data: string, callbackQueryId: string) => Promise<void>;

// --- Helpers ---

function getActiveCallForWorkspace(workspaceId: string): { callId: string; translator: any } | null {
  const translators = getActiveConferenceTranslators();
  for (const [callId, translator] of translators) {
    if ((translator as any).workspaceId === workspaceId) {
      return { callId, translator };
    }
  }
  return null;
}

async function sendReply(botToken: string, chatId: string, text: string) {
  await sendTelegramPlainMessage(botToken, chatId, text);
}

const HELP_TEXT =
  '🌐 <b>Caller</b>\n\n' +
  'Commands:\n' +
  '/mission — 📞 Создать миссию (звонок)\n' +
  '/live — Live translation link\n' +
  '/hangup — End current call\n' +
  '/pause — Pause translator\n' +
  '/resume — Resume translator\n' +
  '/summary — Last conversation summary';

// --- Command Handlers ---

const commandHandlers: Record<string, CommandHandler> = {
  '/start': async (ctx) => {
    await sendReply(ctx.botToken, ctx.chatId, HELP_TEXT);
  },

  '/help': async (ctx) => {
    await sendReply(ctx.botToken, ctx.chatId, HELP_TEXT);
  },

  '/mission': async (ctx) => {
    try {
      const [member] = await db.select({ user_id: workspaceMembers.user_id })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspace_id, ctx.workspaceId))
        .limit(1);
      const userId = member?.user_id || ctx.workspaceId;
      const mission = await missionService.createMission(ctx.workspaceId, userId);

      await sendTelegramMessageWithButtons(ctx.botToken, ctx.chatId,
        '📞 <b>Новая миссия</b>\n\nВыберите тон разговора:', [
        [
          { text: '🔹 Обычный', callback_data: `tone:neutral:${mission.id}` },
          { text: '💼 Официальный', callback_data: `tone:formal:${mission.id}` },
          { text: '😄 Дружеский', callback_data: `tone:friendly:${mission.id}` },
        ],
      ]);
    } catch (err) {
      log.error({ err, chatId: ctx.chatId }, 'Failed to create mission');
      await sendReply(ctx.botToken, ctx.chatId, '❌ Не удалось создать миссию.');
    }
  },

  '/cancel': async (ctx) => {
    const { activeMissions } = await import('../routes/webhooks/telegram.js');
    if (activeMissions.has(ctx.chatId)) {
      const mission = activeMissions.get(ctx.chatId)!;
      await missionService.updateMission(mission.missionId, { status: 'failed' });
      activeMissions.delete(ctx.chatId);
      await sendReply(ctx.botToken, ctx.chatId, '❌ Миссия отменена.');
    } else {
      await sendReply(ctx.botToken, ctx.chatId, '📭 Нет активной миссии.');
    }
  },

  '/recording': async (ctx) => {
    try {
      const { calls: callsTable, aiCallSessions } = await import('../db/schema.js');
      const recentCalls = await db.select({
        id: callsTable.id,
        to_number: callsTable.to_number,
        from_number: callsTable.from_number,
        direction: callsTable.direction,
        created_at: callsTable.created_at,
      })
        .from(callsTable)
        .where(and(eq(callsTable.workspace_id, ctx.workspaceId), eq(callsTable.status, 'completed')))
        .orderBy(desc(callsTable.created_at))
        .limit(5);

      if (!recentCalls.length) {
        await sendReply(ctx.botToken, ctx.chatId, '📭 Нет завершённых звонков.');
        return;
      }

      const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
      for (const call of recentCalls) {
        const [sess] = await db.select({ summary: aiCallSessions.summary, short_title: aiCallSessions.short_title, recording_url: aiCallSessions.recording_url })
          .from(aiCallSessions).where(eq(aiCallSessions.call_id, call.id));
        if (!sess?.recording_url) continue;

        let title = (sess as any).short_title;
        if (!title && sess.summary) {
          title = sess.summary.split(/[.!?]/)[0].trim().slice(0, 50);
        }
        title = title || 'Звонок';
        buttons.push([{ text: title, callback_data: `rec:${call.id.slice(0, 8)}:${call.id}` }]);
      }

      if (!buttons.length) {
        await sendReply(ctx.botToken, ctx.chatId, '📭 Нет записей для прослушивания.');
        return;
      }

      await sendTelegramMessageWithButtons(ctx.botToken, ctx.chatId, '🎧 <b>Записи звонков</b>\n\nВыберите запись:', buttons);
    } catch (err) {
      log.error({ err, chatId: ctx.chatId }, 'Failed to list recordings');
      await sendReply(ctx.botToken, ctx.chatId, '❌ Не удалось загрузить список записей.');
    }
  },

  '/live': async (ctx) => {
    const active = getActiveCallForWorkspace(ctx.workspaceId);
    if (!active) {
      await sendReply(ctx.botToken, ctx.chatId, '📭 No active call right now.');
      return;
    }
    try {
      const shareToken = await callService.createShareToken(active.callId);
      const url = `https://${env.API_DOMAIN}/translate/${shareToken}`;
      await sendReply(ctx.botToken, ctx.chatId, `🌐 <b>Live Translation</b>\n\n<a href="${url}">Open Live Translation</a>`);
    } catch {
      await sendReply(ctx.botToken, ctx.chatId, '❌ Failed to create live link.');
    }
  },

  '/hangup': async (ctx) => {
    const active = getActiveCallForWorkspace(ctx.workspaceId);
    if (!active) {
      await sendReply(ctx.botToken, ctx.chatId, '📭 No active call to end.');
      return;
    }
    try {
      active.translator.stop();
      await sendReply(ctx.botToken, ctx.chatId, '📞 Call ended.');
    } catch {
      await sendReply(ctx.botToken, ctx.chatId, '❌ Failed to end call.');
    }
  },

  '/pause': async (ctx) => {
    const active = getActiveCallForWorkspace(ctx.workspaceId);
    if (!active) {
      await sendReply(ctx.botToken, ctx.chatId, '📭 No active call.');
      return;
    }
    active.translator.pause();
    await sendReply(ctx.botToken, ctx.chatId, '⏸ Translator paused.');
  },

  '/resume': async (ctx) => {
    const active = getActiveCallForWorkspace(ctx.workspaceId);
    if (!active) {
      await sendReply(ctx.botToken, ctx.chatId, '📭 No active call.');
      return;
    }
    active.translator.resume();
    await sendReply(ctx.botToken, ctx.chatId, '▶️ Translator resumed.');
  },

  '/summary': async (ctx) => {
    const [session] = await db.select()
      .from(translatorSessions)
      .where(and(
        eq(translatorSessions.workspace_id, ctx.workspaceId),
        eq(translatorSessions.status, 'completed'),
      ))
      .orderBy(desc(translatorSessions.created_at))
      .limit(1);

    if (!session || !session.transcript) {
      await sendReply(ctx.botToken, ctx.chatId, '📭 No completed sessions found.');
      return;
    }

    const transcript = session.transcript as Array<{ speaker?: string; text?: string; translated?: string }>;
    const duration = session.duration_seconds || 0;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;

    const lines = [
      `📋 <b>Last Session Summary</b>`,
      `⏱ Duration: ${mins}m ${secs}s`,
      `💬 Messages: ${transcript.length}`,
      '',
    ];

    const recent = transcript.slice(-10);
    for (const entry of recent) {
      const speaker = entry.speaker === 'subscriber' ? '🟢 You' : '🔵 Other';
      const orig = entry.text || '';
      const trans = entry.translated || '';
      if (orig) {
        lines.push(`${speaker}: ${orig.length > 80 ? orig.slice(0, 80) + '…' : orig}`);
        if (trans) lines.push(`  ➜ ${trans.length > 80 ? trans.slice(0, 80) + '…' : trans}`);
      }
    }

    if (transcript.length > 10) {
      lines.push(`\n... and ${transcript.length - 10} more messages`);
    }

    await sendReply(ctx.botToken, ctx.chatId, lines.join('\n'));
  },
};

// --- Public API ---

export async function handleCommand(ctx: TgContext, command: string, args: string): Promise<boolean> {
  const handler = commandHandlers[command];
  if (!handler) return false;
  await handler(ctx, args);
  return true;
}

export { getActiveCallForWorkspace, HELP_TEXT };
