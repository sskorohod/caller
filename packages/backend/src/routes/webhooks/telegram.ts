import type { FastifyPluginAsync } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { providerCredentials, workspaces, translatorSessions, callShareTokens } from '../../db/schema.js';
import { decrypt } from '../../lib/crypto.js';
import { env } from '../../config/env.js';
import { getActiveConferenceTranslators } from './media-stream.js';
import * as callService from '../../services/call.service.js';
import pino from 'pino';

const log = pino({ name: 'telegram-webhook' });

// Bot commands menu
const BOT_COMMANDS = [
  { command: 'live', description: 'Get live translation link' },
  { command: 'hangup', description: 'End current call' },
  { command: 'pause', description: 'Pause translator' },
  { command: 'resume', description: 'Resume translator' },
  { command: 'summary', description: 'Summary of last conversation' },
];

async function findWorkspaceByChatId(chatId: string) {
  const rows = await db.select({
    workspace_id: providerCredentials.workspace_id,
    credential_data: providerCredentials.credential_data,
  }).from(providerCredentials)
    .where(eq(providerCredentials.provider, 'telegram'));

  for (const row of rows) {
    try {
      const creds = JSON.parse(decrypt(row.credential_data)) as { bot_token: string; chat_id: string };
      if (creds.chat_id === chatId) {
        return { workspaceId: row.workspace_id, botToken: creds.bot_token };
      }
    } catch { /* skip */ }
  }
  return null;
}

async function sendReply(botToken: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
}

function getActiveCallForWorkspace(workspaceId: string): { callId: string; translator: any } | null {
  const translators = getActiveConferenceTranslators();
  for (const [callId, translator] of translators) {
    if ((translator as any).workspaceId === workspaceId) {
      return { callId, translator };
    }
  }
  return null;
}

const telegramWebhook: FastifyPluginAsync = async (app) => {
  // POST /webhooks/telegram — incoming updates from Telegram
  app.post('/telegram', async (request, reply) => {
    const body = request.body as any;
    const message = body?.message;
    if (!message?.text || !message?.chat?.id) {
      return reply.send({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();
    const command = text.startsWith('/') ? text.split(/\s|@/)[0].toLowerCase() : null;

    if (!command) return reply.send({ ok: true });

    // Try to find workspace by existing chat_id
    let ws = await findWorkspaceByChatId(chatId);

    // /start pairing: if chat not recognized, try to pair by matching bot token
    if (!ws && command === '/start') {
      try {
        // The webhook URL is per-bot, so find which workspace owns this bot
        // by checking all telegram credentials and matching via getMe
        const rows = await db.select({
          workspace_id: providerCredentials.workspace_id,
          credential_data: providerCredentials.credential_data,
        }).from(providerCredentials)
          .where(eq(providerCredentials.provider, 'telegram'));

        for (const row of rows) {
          const creds = JSON.parse(decrypt(row.credential_data)) as { bot_token: string; chat_id?: string };
          if (!creds.chat_id || creds.chat_id === '') {
            // This workspace has a bot_token but no chat_id — pair it!
            const { encrypt } = await import('../../lib/crypto.js');
            const { saveProviderCredential } = await import('../../services/provider.service.js');
            await saveProviderCredential(row.workspace_id, 'telegram', JSON.stringify({
              bot_token: creds.bot_token,
              chat_id: chatId,
            }));

            // Setup commands for this bot
            await setupTelegramBotCommands(creds.bot_token);

            await sendReply(creds.bot_token, chatId,
              '✅ <b>Paired successfully!</b>\n\n' +
              'You will now receive translator notifications here.\n\n' +
              'Commands:\n' +
              '/live — Live translation link\n' +
              '/hangup — End current call\n' +
              '/pause — Pause translator\n' +
              '/resume — Resume translator\n' +
              '/summary — Last conversation summary'
            );
            log.info({ chatId, workspaceId: row.workspace_id }, 'Telegram bot paired via /start');
            return reply.send({ ok: true });
          }
        }

        // No unpaired bots found
        log.warn({ chatId }, 'Telegram /start from unknown chat, no unpaired bots');
        return reply.send({ ok: true });
      } catch (err) {
        log.error({ err, chatId }, 'Telegram pairing error');
        return reply.send({ ok: true });
      }
    }

    if (!ws) {
      log.warn({ chatId, command }, 'Telegram command from unknown chat');
      return reply.send({ ok: true });
    }

    const { workspaceId, botToken } = ws;

    try {
      switch (command) {
        case '/live': {
          const active = getActiveCallForWorkspace(workspaceId);
          if (!active) {
            await sendReply(botToken, chatId, '📭 No active call right now.');
            break;
          }
          // Find or create share token
          try {
            const shareToken = await callService.createShareToken(active.callId);
            const url = `https://${env.API_DOMAIN}/translate/${shareToken}`;
            await sendReply(botToken, chatId, `🌐 <b>Live Translation</b>\n\n<a href="${url}">Open Live Translation</a>`);
          } catch {
            await sendReply(botToken, chatId, '❌ Failed to create live link.');
          }
          break;
        }

        case '/hangup': {
          const active = getActiveCallForWorkspace(workspaceId);
          if (!active) {
            await sendReply(botToken, chatId, '📭 No active call to end.');
            break;
          }
          try {
            active.translator.stop();
            await sendReply(botToken, chatId, '📞 Call ended.');
          } catch {
            await sendReply(botToken, chatId, '❌ Failed to end call.');
          }
          break;
        }

        case '/pause': {
          const active = getActiveCallForWorkspace(workspaceId);
          if (!active) {
            await sendReply(botToken, chatId, '📭 No active call.');
            break;
          }
          active.translator.pause();
          await sendReply(botToken, chatId, '⏸ Translator paused.');
          break;
        }

        case '/resume': {
          const active = getActiveCallForWorkspace(workspaceId);
          if (!active) {
            await sendReply(botToken, chatId, '📭 No active call.');
            break;
          }
          active.translator.resume();
          await sendReply(botToken, chatId, '▶️ Translator resumed.');
          break;
        }

        case '/summary': {
          // Get last completed session
          const [session] = await db.select()
            .from(translatorSessions)
            .where(and(
              eq(translatorSessions.workspace_id, workspaceId),
              eq(translatorSessions.status, 'completed'),
            ))
            .orderBy(desc(translatorSessions.created_at))
            .limit(1);

          if (!session || !session.transcript) {
            await sendReply(botToken, chatId, '📭 No completed sessions found.');
            break;
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

          // Show last 10 messages
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

          await sendReply(botToken, chatId, lines.join('\n'));
          break;
        }

        case '/start': {
          await sendReply(botToken, chatId,
            '🌐 <b>Caller Live Translator</b>\n\n' +
            'Commands:\n' +
            '/live — Get live translation link\n' +
            '/hangup — End current call\n' +
            '/pause — Pause translator\n' +
            '/resume — Resume translator\n' +
            '/summary — Last conversation summary'
          );
          break;
        }
      }
    } catch (err) {
      log.error({ err, command, chatId }, 'Telegram command error');
    }

    return reply.send({ ok: true });
  });
};

/** Register bot commands menu with Telegram API */
export async function setupTelegramBotCommands(botToken: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: BOT_COMMANDS }),
    });
    log.info('Telegram bot commands registered');
  } catch (err) {
    log.error({ err }, 'Failed to register Telegram bot commands');
  }
}

/** Set Telegram webhook URL */
export async function setupTelegramWebhook(botToken: string, webhookUrl: string): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await res.json() as any;
    log.info({ webhookUrl, ok: data.ok }, 'Telegram webhook set');
  } catch (err) {
    log.error({ err }, 'Failed to set Telegram webhook');
  }
}

export default telegramWebhook;
