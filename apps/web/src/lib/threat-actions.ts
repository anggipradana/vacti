'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { Permission, isNewsStatus, isLeakStatus, REVIEW_TOGGLE } from '@vacti/core';
import { isSector, fetchSectorNews } from '@vacti/threat-intel';
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

/** Set the project's news sector and populate that sector's news immediately (so it shows on switch). */
export async function setSectorAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const projectId = String(formData.get('projectId') ?? '');
  const sector = String(formData.get('sector') ?? '');
  if (!projectId || !isSector(sector)) return;
  const db = getDb();
  await db.update(projects).set({ sector, updatedAt: new Date() }).where(eq(projects.id, projectId));
  // Fetch the new sector's news synchronously (RSS, a few seconds) and upsert it, so switching
  // sector shows data right away instead of waiting on the slower full TI refresh job.
  try {
    const news = await fetchSectorNews(sector);
    if (news.length) {
      await db
        .insert(threatNews)
        .values(
          news.map((n) => ({
            sector,
            title: n.title.slice(0, 500),
            link: n.link,
            source: n.source,
            summary: n.summary,
            publishedAt: n.publishedAt,
          })),
        )
        .onConflictDoUpdate({
          target: [threatNews.sector, threatNews.link],
          set: { title: sql`excluded.title`, source: sql`excluded.source`, fetchedAt: sql`now()` },
        });
    }
  } catch {
    // Best-effort; the enqueued refresh will retry.
  }
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

/** Bulk-set every news headline of a sector to a CHOSEN status (defaults to the review status). */
export async function bulkReviewNewsAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const sector = String(formData.get('sector') ?? '');
  const status = String(formData.get('status') || REVIEW_TOGGLE.news.reviewed);
  if (!isSector(sector) || !isNewsStatus(status)) return;
  await getDb().update(threatNews).set({ status }).where(eq(threatNews.sector, sector));
  revalidatePath('/threat');
}

/** Bulk-set every leaked credential of a project to a CHOSEN triage status. */
export async function bulkReviewLeaksAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const projectId = String(formData.get('projectId') ?? '');
  const status = String(formData.get('status') || REVIEW_TOGGLE.leak.reviewed);
  if (!projectId || !isLeakStatus(status)) return;
  await getDb()
    .update(leakcheckData)
    .set({ status, checked: status !== 'new' })
    .where(eq(leakcheckData.projectId, projectId));
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
