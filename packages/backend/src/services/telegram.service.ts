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
