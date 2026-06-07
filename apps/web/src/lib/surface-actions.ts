'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { Permission, isLeakStatus } from '@vacti/core';
import { exposureFindings } from '@vacti/db';
import { getDb } from './db';
import { requirePermission } from './authz';
import { recordAudit } from './audit';

/** Triage a single exposure finding (reuses the leak status set: new/investigating/confirmed/…). */
export async function setExposureStatusAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !isLeakStatus(status)) return;
  await getDb().update(exposureFindings).set({ status }).where(eq(exposureFindings.id, id));
  revalidatePath('/surface');
}

/** Delete a single exposure finding. ModifyScanResults + audit. */
export async function deleteExposureAction(formData: FormData) {
  const actor = await requirePermission(Permission.ModifyScanResults);
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await getDb().delete(exposureFindings).where(eq(exposureFindings.id, id));
  await recordAudit({ actorId: actor.id, action: 'exposure.delete', resource: `exposure:${id}` });
  revalidatePath('/surface');
}

/** Bulk-set a project's exposure findings to a status; honours the active type/status filter. */
export async function bulkReviewExposureAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const projectId = String(formData.get('projectId') ?? '');
  const status = String(formData.get('status') ?? 'investigating');
  const typeFilter = String(formData.get('type') ?? 'all');
  const statusFilter = String(formData.get('filter') ?? 'all');
  if (!projectId || !isLeakStatus(status)) return;
  await getDb()
    .update(exposureFindings)
    .set({ status })
    .where(
      and(
        eq(exposureFindings.projectId, projectId),
        typeFilter !== 'all' ? eq(exposureFindings.findingType, typeFilter) : undefined,
        statusFilter !== 'all' && isLeakStatus(statusFilter) ? eq(exposureFindings.status, statusFilter) : undefined,
      ),
    );
  revalidatePath('/surface');
}
