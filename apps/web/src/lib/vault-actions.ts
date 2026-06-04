'use server';

import { revalidatePath } from 'next/cache';
import { Permission } from '@vacti/core';
import { setProjectSecret, clearProjectSecret, SECRET_NAMES } from '@vacti/integrations';
import { getDb, env } from './db';
import { requirePermission } from './authz';
import { recordAudit } from './audit';

/** Store an encrypted per-project API key (OTX / LeakCheck / AI). SysAdmin only. */
export async function saveProjectKeyAction(formData: FormData) {
  const actor = await requirePermission(Permission.ModifySystemConfig);
  const projectId = String(formData.get('projectId') ?? '');
  const name = String(formData.get('name') ?? '');
  const value = String(formData.get('value') ?? '').trim();
  if (!projectId || !(SECRET_NAMES as readonly string[]).includes(name) || !value) return;
  await setProjectSecret(getDb(), projectId, name, value, env().ENCRYPTION_KEY);
  // Audit the fact a key was set — never the value.
  await recordAudit({
    actorId: actor.id,
    action: 'vault.key_set',
    resource: `key:${name}`,
    projectId,
    metadata: { name },
  });
  revalidatePath('/settings/integrations');
}

export async function clearProjectKeyAction(formData: FormData) {
  const actor = await requirePermission(Permission.ModifySystemConfig);
  const projectId = String(formData.get('projectId') ?? '');
  const name = String(formData.get('name') ?? '');
  if (!projectId || !name) return;
  await clearProjectSecret(getDb(), projectId, name);
  await recordAudit({
    actorId: actor.id,
    action: 'vault.key_clear',
    resource: `key:${name}`,
    projectId,
    metadata: { name },
  });
  revalidatePath('/settings/integrations');
}
