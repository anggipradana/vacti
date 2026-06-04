import { describe, it, expect, vi } from 'vitest';
import { formatPayload } from './format';
import { dispatchWebhook } from './notify';

const ev = {
  type: 'scan.completed' as const,
  title: 'Scan done',
  message: 'example.com',
  severity: 'success' as const,
  fields: { Status: 'completed' },
};

describe('formatPayload', () => {
  it('builds a Discord embed', () => {
    const p = formatPayload('discord', ev);
    expect(p.body).toHaveProperty('embeds');
    expect((p.body as { embeds: { title: string }[] }).embeds[0]!.title).toBe('Scan done');
  });
  it('builds Slack/Google Chat text', () => {
    expect((formatPayload('slack', ev).body as { text: string }).text).toContain('Scan done');
    expect((formatPayload('google_chat', ev).body as { text: string }).text).toContain('example.com');
  });
  it('routes Telegram to the bot API with chat_id', () => {
    const p = formatPayload('telegram', ev, { botToken: 'T', chatId: 'C' });
    expect(p.overrideUrl).toContain('/botT/sendMessage');
    expect((p.body as { chat_id: string }).chat_id).toBe('C');
  });
});

describe('dispatchWebhook', () => {
  it('posts and returns ok on 200', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    const r = await dispatchWebhook({
      url: 'http://hook',
      channel: 'slack',
      event: ev,
      fetchImpl: f as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
    expect(f).toHaveBeenCalledOnce();
  });
  it('retries on 500 then gives up', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 500 }) as Response);
    const r = await dispatchWebhook({
      url: 'http://hook',
      channel: 'slack',
      event: ev,
      retries: 1,
      fetchImpl: f as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(2);
  });
  it('does not retry on 400', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 400 }) as Response);
    const r = await dispatchWebhook({
      url: 'http://hook',
      channel: 'discord',
      event: ev,
      retries: 3,
      fetchImpl: f as unknown as typeof fetch,
    });
    expect(r.attempts).toBe(1);
  });
});
