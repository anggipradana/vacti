'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { Permission } from '@vacti/core';
import { isSector } from '@vacti/threat-intel';
import { manualIndicators, leakcheckData, projects } from '@vacti/db';
import { getDb } from './db';
import { getQueue } from './queue';
import { requirePermission } from './authz';

const tiJob = z.object({ projectId: z.string().uuid() });

export async function refreshTiAction(formData: FormData) {
  await requirePermission(Permission.InitiateScans);
  const projectId = String(formData.get('projectId') ?? '');
  if (!projectId) return;
  const q = await getQueue();
  await q.enqueue('ti-refresh', tiJob, { projectId });
  revalidatePath('/threat');
}

/** Set the project's news sector, then enqueue a TI refresh to repopulate the feed. */
export async function setSectorAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const projectId = String(formData.get('projectId') ?? '');
  const sector = String(formData.get('sector') ?? '');
  if (!projectId || !isSector(sector)) return;
  await getDb().update(projects).set({ sector, updatedAt: new Date() }).where(eq(projects.id, projectId));
  const q = await getQueue();
  await q.enqueue('ti-refresh', tiJob, { projectId });
  revalidatePath('/threat');
}

export async function addIndicatorAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const projectId = String(formData.get('projectId') ?? '');
  const type = String(formData.get('type') ?? 'domain');
  const value = String(formData.get('value') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!projectId || !value || !['domain', 'subdomain', 'ip'].includes(type)) return;
  await getDb().insert(manualIndicators).values({ projectId, type, value, note });
  revalidatePath('/threat');
}

export async function toggleLeakAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const id = String(formData.get('id') ?? '');
  const [row] = await getDb().select().from(leakcheckData).where(eq(leakcheckData.id, id));
  if (row) await getDb().update(leakcheckData).set({ checked: !row.checked }).where(eq(leakcheckData.id, id));
  revalidatePath('/threat');
}
