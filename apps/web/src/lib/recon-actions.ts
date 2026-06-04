'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Permission, isValidCron } from '@vacti/core';
import { targets, scans, scanSchedules } from '@vacti/db';
import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { getQueue } from './queue';
import { requirePermission } from './authz';

const scanJob = z.object({ scanId: z.string().uuid() });

export async function createTargetAction(formData: FormData) {
  await requirePermission(Permission.ModifyTargets);
  const projectId = String(formData.get('projectId') ?? '');
  const domain = String(formData.get('domain') ?? '').trim();
  const subsRaw = String(formData.get('predefinedSubdomains') ?? '').trim();
  if (!projectId || !domain) redirect('/targets?error=invalid');
  const predefinedSubdomains = subsRaw
    ? subsRaw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  await getDb().insert(targets).values({ projectId, domain, predefinedSubdomains });
  revalidatePath('/targets');
}

export async function startScanAction(formData: FormData) {
  await requirePermission(Permission.InitiateScans);
  const targetId = String(formData.get('targetId') ?? '');
  const [target] = await getDb().select().from(targets).where(eq(targets.id, targetId));
  if (!target) redirect('/scans?error=notarget');
  const [scan] = await getDb().insert(scans).values({ projectId: target.projectId, targetId: target.id }).returning();
  const q = await getQueue();
  await q.enqueue('scan', scanJob, { scanId: scan!.id });
  redirect(`/scans/${scan!.id}`);
}

/** Request cancellation of a running/queued scan (worker polls the flag and aborts). */
export async function cancelScanAction(formData: FormData) {
  await requirePermission(Permission.InitiateScans);
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const db = getDb();
  const [scan] = await db.select().from(scans).where(eq(scans.id, id));
  if (!scan || ['completed', 'failed', 'cancelled'].includes(scan.status)) return;
  if (scan.status === 'queued') {
    await db
      .update(scans)
      .set({ status: 'cancelled', cancelRequested: true, finishedAt: new Date() })
      .where(eq(scans.id, id));
  } else {
    await db.update(scans).set({ cancelRequested: true }).where(eq(scans.id, id));
  }
  revalidatePath(`/scans/${id}`);
}

const ALL_TOOLS = ['subfinder', 'httpx', 'naabu', 'nuclei', 'wordfence'] as const;

/** Re-run a target as a new scan; an optional tool subset becomes a sub-scan (toolsOverride). */
export async function rescanAction(formData: FormData) {
  await requirePermission(Permission.InitiateScans);
  const id = String(formData.get('id') ?? '');
  const db = getDb();
  const [scan] = await db.select().from(scans).where(eq(scans.id, id));
  if (!scan) redirect('/scans?error=notfound');
  const picked = new Set(formData.getAll('tools').map(String));
  // A subset (not all tools) → partial rescan; full selection reuses the profile as-is.
  const isSubset = picked.size > 0 && picked.size < ALL_TOOLS.length;
  const toolsOverride = isSubset ? Object.fromEntries(ALL_TOOLS.map((t) => [t, picked.has(t)])) : null;
  const [created] = await db
    .insert(scans)
    .values({ projectId: scan.projectId, targetId: scan.targetId, profileId: scan.profileId, toolsOverride })
    .returning();
  const q = await getQueue();
  await q.enqueue('scan', scanJob, { scanId: created!.id });
  redirect(`/scans/${created!.id}`);
}

export async function createScheduleAction(formData: FormData) {
  await requirePermission(Permission.InitiateScans);
  const targetId = String(formData.get('targetId') ?? '');
  const cron = String(formData.get('cron') ?? '').trim();
  const profileId = String(formData.get('profileId') ?? '').trim() || null;
  if (!targetId || !isValidCron(cron)) redirect('/schedules?error=invalid');
  await getDb().insert(scanSchedules).values({ targetId, cron, profileId });
  revalidatePath('/schedules');
}

export async function toggleScheduleAction(formData: FormData) {
  await requirePermission(Permission.InitiateScans);
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const [row] = await getDb().select().from(scanSchedules).where(eq(scanSchedules.id, id));
  if (row) await getDb().update(scanSchedules).set({ enabled: !row.enabled }).where(eq(scanSchedules.id, id));
  revalidatePath('/schedules');
}

export async function deleteScheduleAction(formData: FormData) {
  await requirePermission(Permission.InitiateScans);
  const id = String(formData.get('id') ?? '');
  if (id) await getDb().delete(scanSchedules).where(eq(scanSchedules.id, id));
  revalidatePath('/schedules');
}
