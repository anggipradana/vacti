'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { manualIndicators, leakcheckData } from '@vacti/db';
import { getDb } from './db';
import { getQueue } from './queue';
import { getCurrentUser } from './session';

const tiJob = z.object({ projectId: z.string().uuid() });

export async function refreshTiAction(formData: FormData) {
  if (!(await getCurrentUser())) redirect('/login');
  const projectId = String(formData.get('projectId') ?? '');
  if (!projectId) return;
  const q = await getQueue();
  await q.enqueue('ti-refresh', tiJob, { projectId });
  revalidatePath('/threat');
}

export async function addIndicatorAction(formData: FormData) {
  if (!(await getCurrentUser())) redirect('/login');
  const projectId = String(formData.get('projectId') ?? '');
  const type = String(formData.get('type') ?? 'domain');
  const value = String(formData.get('value') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!projectId || !value || !['domain', 'subdomain', 'ip'].includes(type)) return;
  await getDb().insert(manualIndicators).values({ projectId, type, value, note });
  revalidatePath('/threat');
}

export async function toggleLeakAction(formData: FormData) {
  if (!(await getCurrentUser())) redirect('/login');
  const id = String(formData.get('id') ?? '');
  const [row] = await getDb().select().from(leakcheckData).where(eq(leakcheckData.id, id));
  if (row) await getDb().update(leakcheckData).set({ checked: !row.checked }).where(eq(leakcheckData.id, id));
  revalidatePath('/threat');
}
