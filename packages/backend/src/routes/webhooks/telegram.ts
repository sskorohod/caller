import type { FastifyPluginAsync } from 'fastify';
import { createHmac } from 'node:crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { providerCredentials, workspaces, translatorSessions, callShareTokens, workspaceMembers } from '../../db/schema.js';
import { decrypt } from '../../lib/crypto.js';
import { env } from '../../config/env.js';
import { getActiveConferenceTranslators } from './media-stream.js';
import * as callService from '../../services/call.service.js';
import * as missionService from '../../services/mission.service.js';
import {
  sendTelegramPlainMessage,
  sendTelegramMessageWithButtons,
  answerCallbackQuery,
  transcribeVoiceMessage,
  sendTelegramMessageReturningId,
  editTelegramMessage,
} from '../../services/telegram.service.js';
import { getProviderCredential } from '../../services/provider.service.js';
import { callEvents } from '../../realtime/call-events.js';
import pino from 'pino';

const log = pino({ name: 'telegram-webhook' });

// Active mission sessions per chat (in-memory)
export const activeMissions = new Map<string, { missionId: string; workspaceId: string; tone?: string }>();

// Chats waiting for delay input (after pressing "Отложить")
const pendingDelay = new Map<string, { missionId: string; workspaceId: string; planText: string }>();

// Scheduled mission timers
const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Active calls per chat (for voice injection during calls)
const activeCalls = new Map<string, { callId: string; workspaceId: string }>();

// Bot commands menu
const BOT_COMMANDS = [
  { command: 'mission', description: '📞 Create a phone call mission' },
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

function getActiveCallForWorkspace(workspaceId: string): { callId: string; translator: any } | null {
  const translators = getActiveConferenceTranslators();
  for (const [callId, translator] of translators) {
    if ((translator as any).workspaceId === workspaceId) {
      return { callId, translator };
    }
  }
  return null;
}

/** Send plan card with 3 buttons */
async function sendPlanCard(botToken: string, chatId: string, missionId: string, planText: string) {
  await sendTelegramMessageWithButtons(botToken, chatId,
    planText + '\n\n<i>Или напишите, что изменить — план обновится.</i>', [
    [
      { text: '📞 Позвонить', callback_data: `mission_call:${missionId}` },
      { text: '⏰ Отложить', callback_data: `mission_delay:${missionId}` },
      { text: '❌ Отменить', callback_data: `mission_cancel:${missionId}` },
    ],
  ]);
}

/** Schedule a mission call with timer and Telegram reminder */
function scheduleMissionCall(
  botToken: string, chatId: string, workspaceId: string,
  missionId: string, planText: string, delayMs: number,
) {
  // Clear any existing timer
  const existing = scheduledTimers.get(missionId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    scheduledTimers.delete(missionId);
    try {
      await sendTelegramPlainMessage(botToken, chatId, '⏰ <b>Напоминание!</b> Время звонить:');
      await sendPlanCard(botToken, chatId, missionId, planText);
    } catch (err) {
      log.error({ err, missionId }, 'Failed to send scheduled mission reminder');
    }
  }, delayMs);

  scheduledTimers.set(missionId, timer);
}

/** Process a mission chat message (text) and send AI response back to Telegram */
async function handleMissionMessage(botToken: string, chatId: string, workspaceId: string, missionId: string, userText: string) {
  try {
    const aiResponse = await missionService.processChatMessage(workspaceId, missionId, userText);

    // Check if AI response contains a ready plan
    const planMatch = aiResponse.match(/\{[\s\S]*"action"\s*:\s*"ready"[\s\S]*\}/);
    if (planMatch) {
      const displayText = aiResponse.replace(planMatch[0], '').trim();
      const planText = displayText || '✅ План готов!';
      await sendPlanCard(botToken, chatId, missionId, planText);
    } else {
      const displayText = aiResponse.length > 4000 ? aiResponse.slice(0, 4000) + '…' : aiResponse;
      await sendTelegramPlainMessage(botToken, chatId, displayText);
    }
  } catch (err) {
    log.error({ err, missionId, chatId }, 'Mission chat error');
    await sendTelegramPlainMessage(botToken, chatId, '❌ Ошибка обработки. Попробуйте ещё раз.');
  }
}

/** Parse delay string like "30", "1ч", "1ч 30м", "90 минут" → milliseconds */
function parseDelay(input: string): number | null {
  const s = input.trim().toLowerCase();

  // Just a number → minutes
  const justNum = s.match(/^(\d+)$/);
  if (justNum) return parseInt(justNum[1], 10) * 60 * 1000;

  // "Xч Yм" or "X ч Y м"
  let totalMs = 0;
  const hours = s.match(/(\d+)\s*(?:ч|час|hours?|h)/);
  const mins = s.match(/(\d+)\s*(?:м|мин|минут|minutes?|m(?!s))/);
  if (hours) totalMs += parseInt(hours[1], 10) * 3600 * 1000;
  if (mins) totalMs += parseInt(mins[1], 10) * 60 * 1000;
  if (totalMs > 0) return totalMs;

  return null;
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
      // Async ffmpeg — does NOT block the Node event loop (execSync did, which
      // froze the whole backend while a long recording transcoded). Generous
      // 4-minute timeout: opus encoding of a 40-min call on the NAS CPU can
      // take well over the old 30s cap, which truncated/failed big recordings.
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

      // Upload with a timeout so a stalled connection can't hang forever.
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

      // Surface real Telegram errors instead of silently "succeeding".
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
 * Telegram includes this in the X-Telegram-Bot-Api-Secret-Token header on
 * every webhook delivery (we set it when calling setWebhook). Anything without
 * the matching header is forged/spoofed and must be rejected.
 */
function deriveTelegramWebhookSecret(botToken: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(botToken).digest('hex').slice(0, 32);
}

const telegramWebhook: FastifyPluginAsync = async (app) => {
  // POST /webhooks/telegram — incoming updates from Telegram
  app.post('/telegram', async (request, reply) => {
    // Signature check: Telegram echoes the secret_token we set in setWebhook
    // back as a header. If any active bot's expected secret matches, the
    // delivery is authentic. Mismatch → 403.
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
          return creds.bot_token && deriveTelegramWebhookSecret(creds.bot_token) === headerSecret;
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
          if (cbData.startsWith('mission_call:')) {
            const missionId = cbData.split(':')[1];
            await answerCallbackQuery(ws.botToken, callbackQuery.id, '📞 Звоню...');
            activeMissions.delete(cbChatId);
            pendingDelay.delete(cbChatId);
            const timer = scheduledTimers.get(missionId);
            if (timer) { clearTimeout(timer); scheduledTimers.delete(missionId); }

            try {
              await missionService.executeMission(ws.workspaceId, missionId);

              // Get call_id and start live transcript
              const freshMission = await missionService.getMission(ws.workspaceId, missionId);
              const callId = freshMission.call_id;

              if (callId) {
                // Track active call for voice injection
                activeCalls.set(cbChatId, { callId, workspaceId: ws.workspaceId });

                const msgId = await sendTelegramMessageReturningId(ws.botToken, cbChatId,
                  '📞 <b>Звонок начался...</b>\n\n<i>🎤 Отправьте голосовое или текст — это будет подсказка агенту.</i>');

                if (msgId) {
                  const lines: string[] = [];
                  let updateTimer: ReturnType<typeof setTimeout> | null = null;
                  let finished = false;

                  const doUpdate = async () => {
                    if (finished) return;
                    const header = '📞 <b>Звонок идёт...</b>\n\n';
                    let body = lines.join('\n');
                    const maxLen = 4096 - header.length - 50;
                    if (body.length > maxLen) body = '...\n' + body.slice(-maxLen);
                    try { await editTelegramMessage(ws.botToken, cbChatId, msgId, header + body); } catch { /* ignore */ }
                  };

                  const throttledUpdate = () => {
                    if (updateTimer || finished) return;
                    updateTimer = setTimeout(() => {
                      updateTimer = null;
                      doUpdate();
                    }, 2000);
                  };

                  const onTranscript = (entry: { speaker: string; text: string; isFinal: boolean }) => {
                    if (!entry.isFinal || !entry.text?.trim()) return;
                    const emoji = entry.speaker === 'agent' ? '🤖' : '👤';
                    lines.push(`${emoji} ${entry.text.trim()}`);
                    throttledUpdate();
                  };

                  const onEnded = async () => {
                    finished = true;
                    activeCalls.delete(cbChatId);
                    callEvents.off(`transcript:${callId}`, onTranscript);
                    if (updateTimer) { clearTimeout(updateTimer); updateTimer = null; }
                    const header = '✅ <b>Звонок завершён</b>\n\n';
                    let body = lines.join('\n') || 'Нет транскрипта.';
                    const maxLen = 4096 - header.length - 10;
                    if (body.length > maxLen) body = '...\n' + body.slice(-maxLen);
                    try { await editTelegramMessage(ws.botToken, cbChatId, msgId, header + body); } catch { /* ignore */ }
                  };

                  callEvents.on(`transcript:${callId}`, onTranscript);
                  callEvents.once(`call_ended:${callId}`, onEnded);

                  // Safety timeout: clean up after 10 minutes
                  setTimeout(() => {
                    if (!finished) {
                      finished = true;
                      callEvents.off(`transcript:${callId}`, onTranscript);
                      callEvents.off(`call_ended:${callId}`, onEnded);
                      if (updateTimer) clearTimeout(updateTimer);
                    }
                  }, 600000);
                }
              } else {
                await sendTelegramPlainMessage(ws.botToken, cbChatId, '📞 Звонок запущен.');
              }
            } catch (execErr: any) {
              log.error({ execErr, missionId }, 'Mission execute from Telegram failed');
              await sendTelegramPlainMessage(ws.botToken, cbChatId, `❌ Не удалось начать звонок: ${execErr.message || 'ошибка'}`);
            }

          } else if (cbData.startsWith('mission_delay:')) {
            const missionId = cbData.split(':')[1];
            await answerCallbackQuery(ws.botToken, callbackQuery.id);
            // Get the plan text from the button message
            const planText = callbackQuery.message?.text || '✅ План готов!';
            pendingDelay.set(cbChatId, { missionId, workspaceId: ws.workspaceId, planText });
            activeMissions.delete(cbChatId);
            await sendTelegramPlainMessage(ws.botToken, cbChatId,
              '⏰ На сколько отложить звонок?\n\n' +
              'Примеры: <b>30</b> (минут), <b>1ч</b>, <b>1ч 30м</b>, <b>2 часа</b>'
            );

          } else if (cbData.startsWith('mission_cancel:')) {
            const missionId = cbData.split(':')[1];
            await answerCallbackQuery(ws.botToken, callbackQuery.id, 'Отменено');
            await missionService.updateMission(missionId, { status: 'failed' });
            activeMissions.delete(cbChatId);
            pendingDelay.delete(cbChatId);
            const timer = scheduledTimers.get(missionId);
            if (timer) { clearTimeout(timer); scheduledTimers.delete(missionId); }
            await sendTelegramPlainMessage(ws.botToken, cbChatId, '❌ Миссия отменена.');

          } else if (cbData.startsWith('mfail:')) {
            // Failure-prompt actions: mfail:retry:<id> | mfail:close:<id>
            //   mfail:postpone:<id>           — show preset menu
            //   mfail:postpone:<id>:<preset>  — apply postpone
            //   mfail:back:<id>               — back to default 3-button keyboard
            const parts = cbData.split(':');
            const sub = parts[1];
            const missionId = parts[2];
            const preset = parts[3] as ('15m' | '1h' | '3h' | 'tomorrow_10' | undefined);
            const { handleFailureAction, editPromptKeyboard, buildPostponeMenu, buildFailurePromptButtons } =
              await import('../../services/mission-failure.service.js');

            try {
              if (sub === 'postpone' && !preset) {
                await answerCallbackQuery(ws.botToken, callbackQuery.id);
                await editPromptKeyboard(missionId, buildPostponeMenu(missionId));
              } else if (sub === 'back') {
                await answerCallbackQuery(ws.botToken, callbackQuery.id);
                await editPromptKeyboard(missionId, buildFailurePromptButtons(missionId));
              } else if (sub === 'retry') {
                await answerCallbackQuery(ws.botToken, callbackQuery.id, '🔄 Повтор...');
                await handleFailureAction({ workspaceId: ws.workspaceId, missionId, action: 'retry' });
              } else if (sub === 'close') {
                await answerCallbackQuery(ws.botToken, callbackQuery.id, 'Закрыто');
                await handleFailureAction({ workspaceId: ws.workspaceId, missionId, action: 'close' });
              } else if (sub === 'postpone' && preset) {
                await answerCallbackQuery(ws.botToken, callbackQuery.id, '⏰ Отложено');
                await handleFailureAction({ workspaceId: ws.workspaceId, missionId, action: 'postpone', preset });
              } else {
                await answerCallbackQuery(ws.botToken, callbackQuery.id);
              }
            } catch (e: any) {
              if (e?.statusCode === 409) {
                await answerCallbackQuery(ws.botToken, callbackQuery.id, 'Уже обработано');
              } else {
                log.error({ e, missionId, sub }, 'mfail action failed');
                await answerCallbackQuery(ws.botToken, callbackQuery.id, 'Ошибка');
              }
            }

          } else if (cbData.startsWith('rec:')) {
            // Recording selection: rec:shortId:fullCallId
            const callId = cbData.split(':')[2];
            await answerCallbackQuery(ws.botToken, callbackQuery.id, '⏳ Загружаю...');
            await sendRecordingVoice(ws.botToken, cbChatId, ws.workspaceId, callId);

          } else if (cbData.startsWith('tone:')) {
            // Tone selection: tone:neutral:missionId → save tone, then ask voice.
            const parts = cbData.split(':');
            const tone = parts[1];
            const missionId = parts[2];
            const toneLabels: Record<string, string> = {
              neutral: '🔹 Обычный',
              formal: '💼 Официальный',
              friendly: '😄 Дружеский',
              cheerful: '🎉 Весёлый',
            };
            await answerCallbackQuery(ws.botToken, callbackQuery.id, toneLabels[tone] || tone);

            // Save tone in mission context
            const mission = await missionService.getMission(ws.workspaceId, missionId);
            const ctx = (mission.context as any) || {};
            ctx.tone = tone;
            await missionService.updateMission(missionId, { context: ctx });

            // Next: ask voice
            await sendTelegramMessageWithButtons(ws.botToken, cbChatId,
              `${toneLabels[tone] || tone} — выбран. Теперь голос:`, [
              [
                { text: '🎉 Eve (upbeat)', callback_data: `voice:eve:${missionId}` },
                { text: '😊 Ara (warm)', callback_data: `voice:ara:${missionId}` },
              ],
              [
                { text: '🧘 Sal (smooth)', callback_data: `voice:sal:${missionId}` },
                { text: '💼 Rex (confident)', callback_data: `voice:rex:${missionId}` },
              ],
              [
                { text: '🎯 Leo (authoritative)', callback_data: `voice:leo:${missionId}` },
                { text: '⏭ Пропустить (по умолчанию)', callback_data: `voice:_skip_:${missionId}` },
              ],
            ]);

          } else if (cbData.startsWith('voice:')) {
            // Voice selection: voice:eve:missionId → save voice, then ask about memory.
            const parts = cbData.split(':');
            const voice = parts[1];
            const missionId = parts[2];
            const voiceLabels: Record<string, string> = {
              eve: '🎉 Eve', ara: '😊 Ara', sal: '🧘 Sal', rex: '💼 Rex', leo: '🎯 Leo',
              _skip_: 'голос по умолчанию',
            };
            await answerCallbackQuery(ws.botToken, callbackQuery.id, voiceLabels[voice] || voice);

            const mission = await missionService.getMission(ws.workspaceId, missionId);
            const ctx = (mission.context as any) || {};
            if (voice !== '_skip_') {
              ctx.voice_override = voice;
              await missionService.updateMission(missionId, { context: ctx });
            }

            // Next step: ask about memory.
            await sendTelegramMessageWithButtons(ws.botToken, cbChatId,
              `Голос: ${voiceLabels[voice] || voice}.\n\n` +
              'Использовать память о предыдущих звонках с этим номером?', [
              [
                { text: '🧠 С памятью', callback_data: `memory:on:${missionId}` },
                { text: '🆕 Без памяти', callback_data: `memory:off:${missionId}` },
              ],
            ]);

          } else if (cbData.startsWith('memory:')) {
            // Memory toggle: memory:on|off:missionId → save, then activate.
            const parts = cbData.split(':');
            const memoryFlag = parts[1]; // 'on' or 'off'
            const missionId = parts[2];
            const memoryLabel = memoryFlag === 'on' ? '🧠 С памятью' : '🆕 Без памяти';
            await answerCallbackQuery(ws.botToken, callbackQuery.id, memoryLabel);

            const mission = await missionService.getMission(ws.workspaceId, missionId);
            const ctx = (mission.context as any) || {};
            ctx.memory_enabled = memoryFlag === 'on';
            await missionService.updateMission(missionId, { context: ctx });

            // Activate mission mode — ready for task description.
            activeMissions.set(cbChatId, { missionId, workspaceId: ws.workspaceId });

            await sendTelegramPlainMessage(ws.botToken, cbChatId,
              `${memoryLabel} — выбрано.\n\n` +
              'Опишите задачу:\n' +
              '• Кому позвонить (имя, номер)\n' +
              '• Зачем\n' +
              '• На каком языке вести разговор\n\n' +
              'Можно текстом или 🎤 голосовым.'
            );

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

    // ─── Handle messages (text + voice) ────────────────────────────
    const message = body?.message;
    if (!message?.chat?.id) {
      return reply.send({ ok: true });
    }

    const chatId = String(message.chat.id);
    const hasText = !!message.text;
    const hasVoice = !!message.voice;

    if (!hasText && !hasVoice) {
      return reply.send({ ok: true });
    }

    const text = hasText ? message.text.trim() : '';
    const command = (hasText && text.startsWith('/')) ? text.split(/\s|@/)[0].toLowerCase() : null;

    // ─── Pending delay input: user typing delay time ───
    if (!command && pendingDelay.has(chatId) && hasText) {
      const delay = pendingDelay.get(chatId)!;
      const ws = await findWorkspaceByChatId(chatId);
      if (!ws) return reply.send({ ok: true });

      const delayMs = parseDelay(text);
      if (!delayMs) {
        await sendTelegramPlainMessage(ws.botToken, chatId,
          '❓ Не понял. Введите время, например: <b>30</b> (минут), <b>1ч</b>, <b>2ч 15м</b>'
        );
        return reply.send({ ok: true });
      }

      pendingDelay.delete(chatId);
      const delayMins = Math.round(delayMs / 60000);
      const h = Math.floor(delayMins / 60);
      const m = delayMins % 60;
      const timeStr = h > 0 ? `${h}ч ${m}м` : `${m} мин`;

      scheduleMissionCall(ws.botToken, chatId, ws.workspaceId, delay.missionId, delay.planText, delayMs);

      await sendTelegramPlainMessage(ws.botToken, chatId,
        `⏰ Звонок отложен на <b>${timeStr}</b>. Напомню, когда придёт время.`
      );
      return reply.send({ ok: true });
    }

    // ─── Active call: inject voice/text as hint to the agent ───
    if (!command && activeCalls.has(chatId)) {
      const activeCall = activeCalls.get(chatId)!;
      const ws = await findWorkspaceByChatId(chatId);
      if (!ws) return reply.send({ ok: true });

      let hintText = text;

      // Voice → transcribe
      if (hasVoice && !hasText) {
        try {
          const openaiCreds = await getProviderCredential(ws.workspaceId, 'openai');
          hintText = await transcribeVoiceMessage(ws.botToken, message.voice.file_id, openaiCreds.api_key);
        } catch (err) {
          log.error({ err, chatId }, 'Voice hint transcription failed');
          await sendTelegramPlainMessage(ws.botToken, chatId, '❌ Не удалось распознать.');
          return reply.send({ ok: true });
        }
      }

      if (hintText) {
        try {
          const { getActiveOrchestrator } = await import('./media-stream.js');
          const orch = getActiveOrchestrator(activeCall.callId);
          if (orch && 'injectInstruction' in orch) {
            (orch as any).injectInstruction(hintText);
            await sendTelegramPlainMessage(ws.botToken, chatId, `💡 <i>${hintText}</i>`);
          } else {
            await sendTelegramPlainMessage(ws.botToken, chatId, '⚠️ Звонок не найден или завершён.');
            activeCalls.delete(chatId);
          }
        } catch (err) {
          log.error({ err, chatId }, 'Inject hint failed');
        }
      }
      return reply.send({ ok: true });
    }

    // ─── Mission mode: non-command text or voice → forward to mission chat ───
    if (!command && activeMissions.has(chatId)) {
      const mission = activeMissions.get(chatId)!;
      const ws = await findWorkspaceByChatId(chatId);
      if (!ws) return reply.send({ ok: true });

      let userText = text;

      // Voice message → transcribe
      if (hasVoice && !hasText) {
        try {
          const openaiCreds = await getProviderCredential(ws.workspaceId, 'openai');
          userText = await transcribeVoiceMessage(ws.botToken, message.voice.file_id, openaiCreds.api_key);
          await sendTelegramPlainMessage(ws.botToken, chatId, `🎤 <i>${userText}</i>`);
        } catch (err) {
          log.error({ err, chatId }, 'Voice transcription failed');
          await sendTelegramPlainMessage(ws.botToken, chatId, '❌ Не удалось распознать голосовое сообщение.');
          return reply.send({ ok: true });
        }
      }

      if (userText) {
        await handleMissionMessage(ws.botToken, chatId, ws.workspaceId, mission.missionId, userText);
      }
      return reply.send({ ok: true });
    }

    // Non-command, no active mission → ignore
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
            const { saveProviderCredential } = await import('../../services/provider.service.js');
            await saveProviderCredential({
              workspaceId: row.workspace_id,
              provider: 'telegram',
              credentials: { bot_token: creds.bot_token, chat_id: chatId },
            });

            // Setup commands for this bot
            await setupTelegramBotCommands(creds.bot_token);

            await sendReply(creds.bot_token, chatId,
              '✅ <b>Paired successfully!</b>\n\n' +
              'Commands:\n' +
              '/mission — 📞 Создать миссию (звонок)\n' +
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
      const { handleCommand } = await import('../../services/telegram-commands.service.js');
      const args = text.slice(command!.length).trim();
      const handled = await handleCommand({ botToken, chatId, workspaceId }, command!, args);
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

/** Set Telegram webhook URL with a derived secret_token. Telegram echoes the
 *  secret in X-Telegram-Bot-Api-Secret-Token on every delivery — we verify it
 *  on every incoming POST /webhooks/telegram to reject forged updates. */
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
