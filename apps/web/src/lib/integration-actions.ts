'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { webhooks } from '@vacti/db';
import { dispatchWebhook, type Channel } from '@vacti/integrations';
import { getDb } from './db';
import { getCurrentUser } from './session';

export async function addWebhookAction(formData: FormData) {
  if (!(await getCurrentUser())) redirect('/login');
  const projectId = String(formData.get('projectId') ?? '');
  const channel = String(formData.get('channel') ?? 'discord');
  if (!projectId || !['discord', 'slack', 'telegram', 'google_chat', 'generic'].includes(channel)) return;
  const v = (k: string) => {
    const s = String(formData.get(k) ?? '').trim();
    return s || null;
  };
  await getDb()
    .insert(webhooks)
    .values({
      projectId,
      channel,
      label: v('label'),
      url: v('url'),
      telegramToken: v('telegramToken'),
      telegramChatId: v('telegramChatId'),
      events: formData.getAll('events').map(String),
      enabled: true,
    });
  revalidatePath('/settings/integrations');
}

export async function deleteWebhookAction(formData: FormData) {
  if (!(await getCurrentUser())) redirect('/login');
  const id = String(formData.get('id') ?? '');
  if (id) await getDb().delete(webhooks).where(eq(webhooks.id, id));
  revalidatePath('/settings/integrations');
}

export async function testWebhookAction(formData: FormData) {
  if (!(await getCurrentUser())) redirect('/login');
  const id = String(formData.get('id') ?? '');
  const [w] = await getDb().select().from(webhooks).where(eq(webhooks.id, id));
  if (!w) return;
  await dispatchWebhook({
    url: w.url ?? '',
    channel: w.channel as Channel,
    event: {
      type: 'test',
      title: 'vacti test notification',
      message: 'Webhook configured correctly.',
      severity: 'info',
    },
    telegram:
      w.channel === 'telegram' ? { botToken: w.telegramToken ?? '', chatId: w.telegramChatId ?? '' } : undefined,
  });
  revalidatePath('/settings/integrations');
}
