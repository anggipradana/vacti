'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Permission } from '@vacti/core';
import {
  setProjectSecret,
  clearProjectSecret,
  getProjectSecret,
  validateProviderKey,
  SECRET_NAMES,
} from '@vacti/integrations';
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
  // Audit the fact a key was set - never the value.
  await recordAudit({
    actorId: actor.id,
    action: 'vault.key_set',
    resource: `key:${name}`,
    projectId,
    metadata: { name },
  });
  revalidatePath('/settings/integrations');
}

/** Probe a stored API key against its provider and redirect back with the verdict. SysAdmin only. */
export async function testProjectKeyAction(formData: FormData) {
  const actor = await requirePermission(Permission.ModifySystemConfig);
  const projectId = String(formData.get('projectId') ?? '');
  const name = String(formData.get('name') ?? '');
  if (!projectId || !(SECRET_NAMES as readonly string[]).includes(name)) return;

  const key = await getProjectSecret(getDb(), projectId, name, env().ENCRYPTION_KEY);
  const result = key
    ? await validateProviderKey(name, key)
    : ({ status: 'invalid', message: 'No key stored.' } as const);

  await recordAudit({
    actorId: actor.id,
    action: 'vault.key_test',
    resource: `key:${name}`,
    projectId,
    metadata: { name, status: result.status },
  });
  // Carry the verdict back to the page via query params (never the key itself).
  const params = new URLSearchParams({ project: projectId, ktest: name, kstatus: result.status });
  redirect(`/settings/integrations?${params.toString()}`);
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
