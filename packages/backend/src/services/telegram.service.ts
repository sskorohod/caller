interface CallNotificationData {
  phone: string;
  direction: 'inbound' | 'outbound';
  name: string | null;
  company: string | null;
  total_calls: number;
  agent_name: string;
  recent_facts: string[];
  monitor_url?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatCallMessage(data: CallNotificationData): string {
  const lines: string[] = [];
  const emoji = data.direction === 'inbound' ? '\u{1F4DE}' : '\u{1F4F1}';
  const label = data.direction === 'inbound' ? 'Incoming call' : 'Outgoing call';
  lines.push(`${emoji} <b>${label}</b>`);
  lines.push(`${data.direction === 'inbound' ? 'From' : 'To'}: ${escapeHtml(data.phone)}`);
  if (data.name) lines.push(`Name: ${escapeHtml(data.name)}`);
  if (data.company) lines.push(`Company: ${escapeHtml(data.company)}`);
  if (data.total_calls > 1) lines.push(`Calls: ${data.total_calls}`);
  if (data.agent_name) lines.push(`Agent: ${escapeHtml(data.agent_name)}`);

  if (data.recent_facts.length > 0) {
    lines.push('');
    lines.push('\u{1F4AC} <b>Notes:</b>');
    for (const fact of data.recent_facts) {
      lines.push(`\u2022 ${escapeHtml(fact)}`);
    }
  }

  if (data.monitor_url) {
    lines.push('');
    lines.push(`\u{1F4F2} <a href="${escapeHtml(data.monitor_url)}">Live Monitor</a>`);
  }

  return lines.join('\n');
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });

  return response.ok;
}

export async function sendCallNotification(
  botToken: string,
  chatId: string,
  data: CallNotificationData,
): Promise<boolean> {
  const message = formatCallMessage(data);
  return sendTelegramMessage(botToken, chatId, message);
}

export async function testBot(botToken: string, chatId: string): Promise<boolean> {
  const text = '\u2705 <b>Caller</b> Telegram integration connected successfully!';
  return sendTelegramMessage(botToken, chatId, text);
}

// ─── Translator notifications ───────────────────────────────────────────────

export async function sendTranslatorSessionStart(
  botToken: string,
  chatId: string,
  data: { subscriberName: string; liveUrl?: string },
): Promise<boolean> {
  const lines = [
    '\u{1F310} <b>Live Translator Started</b>',
    `Subscriber: ${escapeHtml(data.subscriberName)}`,
  ];
  if (data.liveUrl) {
    lines.push('');
    lines.push(`\u{1F4F2} <a href="${escapeHtml(data.liveUrl)}">View Live Translation</a>`);
  }
  return sendTelegramMessage(botToken, chatId, lines.join('\n'));
}

// ─── Message editing (for live transcript) ────────────────────────────────

export async function sendTelegramMessageReturningId(
  botToken: string,
  chatId: string,
  text: string,
): Promise<number | null> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  const data = await response.json() as { ok: boolean; result?: { message_id: number } };
  return data.ok ? data.result!.message_id : null;
}

export async function editTelegramMessage(
  botToken: string,
  chatId: string,
  messageId: number,
  text: string,
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
    }),
  });
  return response.ok;
}

// ─── Mission support ──────────────────────────────────────────────────────

export async function sendTelegramMessageWithButtons(
  botToken: string,
  chatId: string,
  text: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>,
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    }),
  });
  return response.ok;
}

export async function sendTelegramPlainMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<boolean> {
  return sendTelegramMessage(botToken, chatId, text);
}

export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export async function transcribeVoiceMessage(
  botToken: string,
  fileId: string,
  openaiApiKey: string,
): Promise<string> {
  // 1. Get file path from Telegram
  const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json() as { ok: boolean; result: { file_path: string } };
  if (!fileData.ok) throw new Error('Failed to get file from Telegram');

  // 2. Download OGG voice file
  const audioRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`);
  if (!audioRes.ok) throw new Error('Failed to download voice file');
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

  // 3. Transcribe with OpenAI Whisper
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'voice.ogg');
  formData.append('model', 'whisper-1');

  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiApiKey}` },
    body: formData,
  });
  if (!whisperRes.ok) throw new Error(`Whisper API error: ${whisperRes.status}`);
  const result = await whisperRes.json() as { text: string };
  return result.text;
}

export async function sendTranslatorSessionEnd(
  botToken: string,
  chatId: string,
  data: { subscriberName: string; durationSecs: number; costUsd: number; balanceUsd: number },
): Promise<boolean> {
  const mins = Math.floor(data.durationSecs / 60);
  const secs = data.durationSecs % 60;
  const lines = [
    '\u{1F3C1} <b>Translator Session Ended</b>',
    `User: ${escapeHtml(data.subscriberName)}`,
    `Duration: ${mins}m ${secs}s`,
    `Cost: $${data.costUsd.toFixed(4)}`,
    `Balance: $${data.balanceUsd.toFixed(2)}`,
  ];
  if (data.balanceUsd < 5) {
    lines.push('');
    lines.push('\u26A0\uFE0F <b>Low balance!</b> Please top up.');
  }
  return sendTelegramMessage(botToken, chatId, lines.join('\n'));
}

// ─── Admin notifications (sent to platform owner for every session) ─────────

export async function sendAdminTranslatorStart(
  botToken: string,
  chatId: string,
  data: { subscriberName: string; callerPhone: string; liveUrl?: string },
): Promise<boolean> {
  const lines = [
    '\u{1F7E2} <b>Translator Session Started</b>',
    `User: ${escapeHtml(data.subscriberName)}`,
    `Phone: ${escapeHtml(data.callerPhone)}`,
  ];
  if (data.liveUrl) {
    lines.push(`\u{1F517} <a href="${escapeHtml(data.liveUrl)}">Live</a>`);
  }
  return sendTelegramMessage(botToken, chatId, lines.join('\n'));
}

export async function sendAdminTranslatorEnd(
  botToken: string,
  chatId: string,
  data: {
    subscriberName: string;
    callerPhone: string;
    durationSecs: number;
    providerCostUsd: number;
    clientCostUsd: number;
    profitUsd: number;
    balanceAfterUsd: number;
  },
): Promise<boolean> {
  const mins = Math.floor(data.durationSecs / 60);
  const secs = data.durationSecs % 60;
  const lines = [
    '\u{1F3C1} <b>Translator Session Ended</b>',
    '',
    `User: ${escapeHtml(data.subscriberName)}`,
    `Phone: ${escapeHtml(data.callerPhone)}`,
    `Duration: ${mins}m ${secs}s`,
    '',
    `Provider cost: $${data.providerCostUsd.toFixed(4)}`,
    `Charged: $${data.clientCostUsd.toFixed(4)}`,
    `Profit: $${data.profitUsd.toFixed(4)}`,
    `User balance: $${data.balanceAfterUsd.toFixed(2)}`,
  ];
  if (data.balanceAfterUsd < 5) {
    lines.push('');
    lines.push('\u26A0\uFE0F Low balance');
  }
  return sendTelegramMessage(botToken, chatId, lines.join('\n'));
}
