'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { isVulnStatus, isLeakStatus } from '@vacti/core';
import { vulnerabilities, leakcheckData } from '@vacti/db';
import { getDb } from './db';
import { getCurrentUser } from './session';

// NOTE: finding-status changes correspond to `modify_scan_results`; full RBAC enforcement (Auditor
// read-only) is layered with the RBAC middleware. Session presence is checked here.
export async function setVulnStatusAction(formData: FormData) {
  if (!(await getCurrentUser())) redirect('/login');
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  const scanId = String(formData.get('scanId') ?? '');
  if (!id || !isVulnStatus(status)) return;
  await getDb().update(vulnerabilities).set({ status, statusChangedAt: new Date() }).where(eq(vulnerabilities.id, id));
  if (scanId) revalidatePath(`/scans/${scanId}`);
}

export async function setLeakStatusAction(formData: FormData) {
  if (!(await getCurrentUser())) redirect('/login');
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !isLeakStatus(status)) return;
  await getDb()
    .update(leakcheckData)
    .set({ status, checked: status !== 'new' })
    .where(eq(leakcheckData.id, id));
  revalidatePath('/threat');
}
