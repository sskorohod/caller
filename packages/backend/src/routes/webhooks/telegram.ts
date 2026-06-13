import type { FastifyPluginAsync } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { providerCredentials } from '../../db/schema.js';
import { decrypt } from '../../lib/crypto.js';
import { env } from '../../config/env.js';
import {
  sendTelegramPlainMessage,
  answerCallbackQuery,
} from '../../services/telegram.service.js';
import pino from 'pino';

const log = pino({ name: 'telegram-webhook' });

// Bot commands menu (translator-only)
const BOT_COMMANDS = [
  { command: 'recording', description: '🎧 Listen to last call recording' },
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

/** Download recording, convert to OGG, send as Telegram voice */
async function sendRecordingVoice(botToken: string, chatId: string, workspaceId: string, callId: string) {
  try {
    const { aiCallSessions } = await import('../../db/schema.js');
    const [session] = await db.select({ recording_url: aiCallSessions.recording_url, summary: aiCallSessions.summary })
      .from(aiCallSessions).where(eq(aiCallSessions.call_id, callId));

    if (!session?.recording_url) {
      await sendTelegramPlainMessage(botToken, chatId, '📭 Запись не найдена.');
      return;
    }

    await sendTelegramPlainMessage(botToken, chatId, '⏳ Загружаю запись...');

    let audioBuffer: Buffer;
    if (session.recording_url.startsWith('minio://')) {
      const key = session.recording_url.replace('minio://', '');
      const { getRecordingBuffer } = await import('../../services/recording-storage.service.js');
      audioBuffer = await getRecordingBuffer(key);
    } else {
      const { getTwilioCreds } = await import('../../services/telephony.service.js');
      const creds = await getTwilioCreds(workspaceId);
      const authHeader = 'Basic ' + Buffer.from(`${creds.account_sid}:${creds.auth_token}`).toString('base64');
      const mp3Url = session.recording_url.endsWith('.mp3') ? session.recording_url : `${session.recording_url}.mp3`;
      const res = await fetch(mp3Url, { headers: { Authorization: authHeader } });
      if (!res.ok) throw new Error('Failed to fetch from Twilio');
      audioBuffer = Buffer.from(await res.arrayBuffer());
    }

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const { writeFileSync, readFileSync, unlinkSync, statSync } = await import('fs');
    const { join } = await import('path');
    const execAsync = promisify(exec);
    const ts = Date.now();
    const mp3Path = join('/tmp', `rec_${ts}.mp3`);
    const oggPath = join('/tmp', `rec_${ts}.ogg`);

    // Telegram bot upload hard limit is 50 MB. Stay safely under it.
    const TELEGRAM_MAX_BYTES = 48 * 1024 * 1024;

    writeFileSync(mp3Path, audioBuffer);
    try {
      await execAsync(
        `ffmpeg -y -i "${mp3Path}" -c:a libopus -b:a 48k -ar 48000 -ac 1 "${oggPath}"`,
        { timeout: 240_000, maxBuffer: 16 * 1024 * 1024 },
      );

      const oggBytes = statSync(oggPath).size;
      if (oggBytes > TELEGRAM_MAX_BYTES) {
        log.warn({ callId, oggBytes }, 'Recording too large for Telegram');
        await sendTelegramPlainMessage(botToken, chatId,
          `⚠️ Запись слишком большая для Telegram (${(oggBytes / 1024 / 1024).toFixed(1)} МБ, лимит 50 МБ). ` +
          `Послушайте её в дашборде на странице звонка.`);
        return;
      }

      const oggBuffer = readFileSync(oggPath);
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('voice', new Blob([new Uint8Array(oggBuffer)], { type: 'audio/ogg' }), 'voice.ogg');

      const ctrl = new AbortController();
      const uploadTimer = setTimeout(() => ctrl.abort(), 180_000);
      let tgRes: Response;
      try {
        tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendVoice`, {
          method: 'POST',
          body: formData,
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(uploadTimer);
      }

      const tgJson = await tgRes.json().catch(() => ({})) as { ok?: boolean; description?: string };
      if (!tgRes.ok || !tgJson.ok) {
        log.error({ callId, status: tgRes.status, description: tgJson.description }, 'Telegram sendVoice rejected');
        await sendTelegramPlainMessage(botToken, chatId,
          `❌ Telegram отклонил запись: ${tgJson.description || tgRes.status}. Послушайте её в дашборде.`);
      }
    } finally {
      try { unlinkSync(mp3Path); } catch { /* ignore */ }
      try { unlinkSync(oggPath); } catch { /* ignore */ }
    }
  } catch (err) {
    log.error({ err, chatId, callId }, 'Failed to send recording voice');
    await sendTelegramPlainMessage(botToken, chatId, '❌ Не удалось отправить запись. Послушайте её в дашборде.');
  }
}

/**
 * Per-bot webhook secret, derived deterministically from JWT_SECRET + botToken.
 * Telegram includes this in the X-Telegram-Bot-Api-Secret-Token header on every
 * delivery (set via setWebhook). Anything without the matching header is forged.
 */
function deriveTelegramWebhookSecret(botToken: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(botToken).digest('hex').slice(0, 32);
}

const telegramWebhook: FastifyPluginAsync = async (app) => {
  // POST /webhooks/telegram — incoming updates from Telegram
  app.post('/telegram', async (request, reply) => {
    const headerSecret = request.headers['x-telegram-bot-api-secret-token'] as string | undefined;
    if (!headerSecret) {
      log.warn({ ip: request.ip }, 'Telegram webhook rejected — missing secret header');
      return reply.status(403).send({ ok: false, error: 'forbidden' });
    }
    try {
      const allBots = await db.select({ credential_data: providerCredentials.credential_data })
        .from(providerCredentials)
        .where(eq(providerCredentials.provider, 'telegram'));
      const matched = allBots.some(b => {
        try {
          const creds = JSON.parse(decrypt(b.credential_data)) as { bot_token?: string };
          if (!creds.bot_token) return false;
          // Constant-time compare (both are fixed 32-char hex), consistent with
          // the Stripe/OAuth/API-key secret checks elsewhere in the codebase.
          const derived = Buffer.from(deriveTelegramWebhookSecret(creds.bot_token));
          const provided = Buffer.from(headerSecret);
          return derived.length === provided.length && timingSafeEqual(derived, provided);
        } catch {
          return false;
        }
      });
      if (!matched) {
        log.warn({ ip: request.ip }, 'Telegram webhook rejected — secret mismatch');
        return reply.status(403).send({ ok: false, error: 'forbidden' });
      }
    } catch (err) {
      log.error({ err }, 'Telegram webhook secret verification error');
      return reply.status(500).send({ ok: false });
    }

    const body = request.body as any;

    // ─── Handle callback_query (inline button presses) ─────────────
    const callbackQuery = body?.callback_query;
    if (callbackQuery) {
      const cbData = callbackQuery.data as string;
      const cbChatId = String(callbackQuery.message?.chat?.id);
      const ws = await findWorkspaceByChatId(cbChatId);

      if (ws) {
        try {
          if (cbData.startsWith('rec:')) {
            // Recording selection: rec:shortId:fullCallId
            const callId = cbData.split(':')[2];
            await answerCallbackQuery(ws.botToken, callbackQuery.id, '⏳ Загружаю...');
            await sendRecordingVoice(ws.botToken, cbChatId, ws.workspaceId, callId);
          } else {
            await answerCallbackQuery(ws.botToken, callbackQuery.id);
          }
        } catch (err) {
          log.error({ err, cbData, cbChatId }, 'Callback query error');
          await answerCallbackQuery(ws.botToken, callbackQuery.id, 'Ошибка');
        }
      }

      return reply.send({ ok: true });
    }

    // ─── Handle messages (slash commands only) ─────────────────────
    const message = body?.message;
    if (!message?.chat?.id || !message.text) {
      return reply.send({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();
    const command = text.startsWith('/') ? text.split(/\s|@/)[0].toLowerCase() : null;
    if (!command) return reply.send({ ok: true });

    let ws = await findWorkspaceByChatId(chatId);

    // /start pairing: if chat not recognized, pair by matching an unpaired bot
    if (!ws && command === '/start') {
      try {
        const rows = await db.select({
          workspace_id: providerCredentials.workspace_id,
          credential_data: providerCredentials.credential_data,
        }).from(providerCredentials)
          .where(eq(providerCredentials.provider, 'telegram'));

        for (const row of rows) {
          const creds = JSON.parse(decrypt(row.credential_data)) as { bot_token: string; chat_id?: string };
          if (!creds.chat_id || creds.chat_id === '') {
            const { saveProviderCredential } = await import('../../services/provider.service.js');
            await saveProviderCredential({
              workspaceId: row.workspace_id,
              provider: 'telegram',
              credentials: { bot_token: creds.bot_token, chat_id: chatId },
            });

            await setupTelegramBotCommands(creds.bot_token);

            await sendReply(creds.bot_token, chatId,
              '✅ <b>Paired successfully!</b>\n\n' +
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
      const { handleCommand } = await import('../../services/telegram-commands.service.js');
      const args = text.slice(command.length).trim();
      const handled = await handleCommand({ botToken, chatId, workspaceId }, command, args);
      if (!handled) {
        log.warn({ command, chatId }, 'Unknown Telegram command');
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

/** Set Telegram webhook URL with a derived secret_token. */
export async function setupTelegramWebhook(botToken: string, webhookUrl: string): Promise<void> {
  try {
    const secretToken = deriveTelegramWebhookSecret(botToken);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, secret_token: secretToken }),
    });
    const data = await res.json() as any;
    log.info({ webhookUrl, ok: data.ok }, 'Telegram webhook set');
  } catch (err) {
    log.error({ err }, 'Failed to set Telegram webhook');
  }
}

export default telegramWebhook;
