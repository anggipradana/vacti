import type { Channel, NotificationEvent } from './events';

const COLOR: Record<string, number> = { info: 0x3b82f6, success: 0x22c55e, warning: 0xf59e0b, error: 0xef4444 };

/** Build the channel-specific webhook payload + target (for Telegram the url carries token/chat). */
export function formatPayload(
  channel: Channel,
  ev: NotificationEvent,
  telegram?: { botToken: string; chatId: string },
) {
  const fieldsText = ev.fields
    ? Object.entries(ev.fields)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    : '';
  const text = `*${ev.title}*\n${ev.message}${fieldsText ? `\n${fieldsText}` : ''}${ev.url ? `\n${ev.url}` : ''}`;

  switch (channel) {
    case 'discord':
      return {
        body: {
          embeds: [
            {
              title: ev.title,
              description: ev.message + (ev.url ? `\n${ev.url}` : ''),
              color: COLOR[ev.severity ?? 'info'],
              fields: ev.fields
                ? Object.entries(ev.fields).map(([name, value]) => ({ name, value: String(value), inline: true }))
                : [],
            },
          ],
        },
      };
    case 'slack':
    case 'google_chat':
      return { body: { text } };
    case 'telegram':
      return {
        overrideUrl: telegram ? `https://api.telegram.org/bot${telegram.botToken}/sendMessage` : undefined,
        body: { chat_id: telegram?.chatId, text, parse_mode: 'Markdown' },
      };
    default:
      return {
        body: {
          event: ev.type,
          title: ev.title,
          message: ev.message,
          severity: ev.severity,
          url: ev.url,
          fields: ev.fields,
        },
      };
  }
}
