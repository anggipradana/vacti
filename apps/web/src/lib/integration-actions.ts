'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { Permission } from '@vacti/core';
import { webhooks } from '@vacti/db';
import { dispatchWebhook, type Channel } from '@vacti/integrations';
import { getDb } from './db';
import { requirePermission } from './authz';

export async function addWebhookAction(formData: FormData) {
  await requirePermission(Permission.ModifySystemConfig);
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
  await requirePermission(Permission.ModifySystemConfig);
  const id = String(formData.get('id') ?? '');
  if (id) await getDb().delete(webhooks).where(eq(webhooks.id, id));
  revalidatePath('/settings/integrations');
}

export async function testWebhookAction(formData: FormData) {
  await requirePermission(Permission.ModifySystemConfig);
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
