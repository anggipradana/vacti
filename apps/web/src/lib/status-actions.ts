'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { isVulnStatus, isLeakStatus, Permission, REVIEW_TOGGLE } from '@vacti/core';
import { vulnerabilities, leakcheckData } from '@vacti/db';
import { getDb } from './db';
import { requirePermission } from './authz';

// Finding-status changes require `modify_scan_results` (Auditor is read-only).
export async function setVulnStatusAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  const scanId = String(formData.get('scanId') ?? '');
  if (!id || !isVulnStatus(status)) return;
  await getDb().update(vulnerabilities).set({ status, statusChangedAt: new Date() }).where(eq(vulnerabilities.id, id));
  if (scanId) revalidatePath(`/scans/${scanId}`);
}

/** Bulk one-click: mark every still-open vuln of a scan as reviewed (on progress). */
export async function bulkReviewVulnsAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const scanId = String(formData.get('scanId') ?? '');
  if (!scanId) return;
  const t = REVIEW_TOGGLE.vuln;
  await getDb()
    .update(vulnerabilities)
    .set({ status: t.reviewed, statusChangedAt: new Date() })
    .where(and(eq(vulnerabilities.scanId, scanId), eq(vulnerabilities.status, t.base)));
  if (scanId) revalidatePath(`/scans/${scanId}`);
}

export async function setLeakStatusAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !isLeakStatus(status)) return;
  await getDb()
    .update(leakcheckData)
    .set({ status, checked: status !== 'new' })
    .where(eq(leakcheckData.id, id));
  revalidatePath('/threat');
}
