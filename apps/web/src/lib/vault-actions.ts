'use server';

import { revalidatePath } from 'next/cache';
import { Permission } from '@vacti/core';
import { setProjectSecret, clearProjectSecret, SECRET_NAMES } from '@vacti/integrations';
import { getDb, env } from './db';
import { requirePermission } from './authz';

/** Store an encrypted per-project API key (OTX / LeakCheck / AI). SysAdmin only. */
export async function saveProjectKeyAction(formData: FormData) {
  await requirePermission(Permission.ModifySystemConfig);
  const projectId = String(formData.get('projectId') ?? '');
  const name = String(formData.get('name') ?? '');
  const value = String(formData.get('value') ?? '').trim();
  if (!projectId || !(SECRET_NAMES as readonly string[]).includes(name) || !value) return;
  await setProjectSecret(getDb(), projectId, name, value, env().ENCRYPTION_KEY);
  revalidatePath('/settings/integrations');
}

export async function clearProjectKeyAction(formData: FormData) {
  await requirePermission(Permission.ModifySystemConfig);
  const projectId = String(formData.get('projectId') ?? '');
  const name = String(formData.get('name') ?? '');
  if (!projectId || !name) return;
  await clearProjectSecret(getDb(), projectId, name);
  revalidatePath('/settings/integrations');
}
