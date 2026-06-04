'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { reportSettings, reportSignatories } from '@vacti/db';
import { getDb } from './db';
import { getCurrentUser } from './session';

/** Convert an uploaded image to a data: URL (capped), or undefined if none/invalid. */
async function imageToDataUrl(entry: FormDataEntryValue | null, maxBytes = 600_000): Promise<string | undefined> {
  if (!entry || typeof entry === 'string') return undefined;
  const f = entry as File;
  if (!f.size || !f.type.startsWith('image/') || f.size > maxBytes) return undefined;
  const buf = Buffer.from(await f.arrayBuffer());
  return `data:${f.type};base64,${buf.toString('base64')}`;
}

export async function saveReportSettingsAction(formData: FormData) {
  if (!(await getCurrentUser())) redirect('/login');
  const projectId = String(formData.get('projectId') ?? '');
  const kind = String(formData.get('kind') ?? 'va') === 'ti' ? 'ti' : 'va';
  if (!projectId) return;
  const v = (k: string) => {
    const s = String(formData.get(k) ?? '').trim();
    return s || null;
  };
  const logo = await imageToDataUrl(formData.get('companyLogoFile'));
  const removeLogo = formData.get('removeLogo') === 'on';
  const values: Record<string, unknown> = {
    projectId,
    kind,
    primaryColor: v('primaryColor') ?? '#069ec6',
    secondaryColor: v('secondaryColor') ?? '#08222b',
    companyName: v('companyName'),
    companyAddress: v('companyAddress'),
    companyEmail: v('companyEmail'),
    companyWebsite: v('companyWebsite'),
    documentNumber: v('documentNumber'),
    classification: v('classification'),
    footerText: v('footerText'),
    language: String(formData.get('language') ?? 'en') === 'id' ? 'id' : 'en',
    showExecutiveSummary: formData.get('showExecutiveSummary') === 'on',
    executiveSummary: v('executiveSummary'),
    executiveSummaryId: v('executiveSummaryId'),
  };
  // Only touch the logo column when replacing or explicitly removing it.
  if (logo) values.companyLogo = logo;
  else if (removeLogo) values.companyLogo = null;
  await getDb()
    .insert(reportSettings)
    .values(values as typeof reportSettings.$inferInsert)
    .onConflictDoUpdate({ target: [reportSettings.projectId, reportSettings.kind], set: values });
  revalidatePath('/settings/reports');
}

export async function addSignatoryAction(formData: FormData) {
  if (!(await getCurrentUser())) redirect('/login');
  const projectId = String(formData.get('projectId') ?? '');
  const role = String(formData.get('role') ?? 'prepared');
  const name = String(formData.get('name') ?? '').trim();
  const position = String(formData.get('position') ?? '').trim();
  if (!projectId || !name || !['prepared', 'reviewed', 'approved'].includes(role)) return;
  const order = role === 'prepared' ? 0 : role === 'reviewed' ? 1 : 2;
  const signatureImage = (await imageToDataUrl(formData.get('signatureImageFile'))) ?? null;
  await getDb().insert(reportSignatories).values({ projectId, role, name, position, sortOrder: order, signatureImage });
  revalidatePath('/settings/reports');
}

export async function deleteSignatoryAction(formData: FormData) {
  if (!(await getCurrentUser())) redirect('/login');
  const id = String(formData.get('id') ?? '');
  if (id) await getDb().delete(reportSignatories).where(eq(reportSignatories.id, id));
  revalidatePath('/settings/reports');
}
