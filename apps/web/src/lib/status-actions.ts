'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { isVulnStatus, isLeakStatus, Permission } from '@vacti/core';
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
