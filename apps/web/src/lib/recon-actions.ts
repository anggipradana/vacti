'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { targets, scans } from '@vacti/db';
import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { getQueue } from './queue';
import { getCurrentUser } from './session';

const scanJob = z.object({ scanId: z.string().uuid() });

export async function createTargetAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
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
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const targetId = String(formData.get('targetId') ?? '');
  const [target] = await getDb().select().from(targets).where(eq(targets.id, targetId));
  if (!target) redirect('/scans?error=notarget');
  const [scan] = await getDb().insert(scans).values({ projectId: target.projectId, targetId: target.id }).returning();
  const q = await getQueue();
  await q.enqueue('scan', scanJob, { scanId: scan!.id });
  redirect(`/scans/${scan!.id}`);
}
