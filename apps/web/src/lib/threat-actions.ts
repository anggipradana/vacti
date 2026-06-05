'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { Permission, isNewsStatus, REVIEW_TOGGLE } from '@vacti/core';
import { isSector } from '@vacti/threat-intel';
import { manualIndicators, leakcheckData, projects, threatNews } from '@vacti/db';
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

/** Triage a sector security-news headline (status preserved across feed refreshes). */
export async function setNewsStatusAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !isNewsStatus(status)) return;
  await getDb().update(threatNews).set({ status }).where(eq(threatNews.id, id));
  revalidatePath('/threat');
}

/** Bulk one-click: mark every still-unreviewed news headline of a sector as reviewed. */
export async function bulkReviewNewsAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const sector = String(formData.get('sector') ?? '');
  if (!isSector(sector)) return;
  const t = REVIEW_TOGGLE.news;
  await getDb()
    .update(threatNews)
    .set({ status: t.reviewed })
    .where(and(eq(threatNews.sector, sector), eq(threatNews.status, t.base)));
  revalidatePath('/threat');
}

/** Bulk one-click: mark every still-untriaged leak of a project as reviewed (investigating). */
export async function bulkReviewLeaksAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const projectId = String(formData.get('projectId') ?? '');
  if (!projectId) return;
  const t = REVIEW_TOGGLE.leak;
  await getDb()
    .update(leakcheckData)
    .set({ status: t.reviewed, checked: true })
    .where(and(eq(leakcheckData.projectId, projectId), eq(leakcheckData.status, t.base)));
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
