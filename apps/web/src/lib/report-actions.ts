'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { Permission } from '@vacti/core';
import type { DistributionRow, VersionHistoryRow } from '@vacti/reports';
import { projects, reportSettings, reportSignatories } from '@vacti/db';
import { getDb } from './db';
import { requirePermission } from './authz';
import { recordAudit } from './audit';

/** Convert an uploaded image to a data: URL (capped), or undefined if none/invalid. */
async function imageToDataUrl(entry: FormDataEntryValue | null, maxBytes = 600_000): Promise<string | undefined> {
  if (!entry || typeof entry === 'string') return undefined;
  const f = entry as File;
  if (!f.size || !f.type.startsWith('image/') || f.size > maxBytes) return undefined;
  const buf = Buffer.from(await f.arrayBuffer());
  return `data:${f.type};base64,${buf.toString('base64')}`;
}

export async function saveReportSettingsAction(formData: FormData) {
  await requirePermission(Permission.ModifyReport);
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

/** Parse a textarea holding pretty JSON for a jsonb list column; null when empty, undefined on error (keep existing). */
function parseJsonList<T>(raw: string): T[] | null | undefined {
  const s = raw.trim();
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? (parsed as T[]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Upsert the pentest report-settings row, keyed by (projectId, kind='pentest'). Persists ALL the
 * professional doc-style fields plus the shared branding/identity ones. The two list columns are
 * authored as pretty JSON textareas and parsed here; an unparseable list is left untouched.
 */
export async function savePentestReportSettingsAction(formData: FormData) {
  const user = await requirePermission(Permission.ModifyReport);
  const projectId = String(formData.get('projectId') ?? '');
  if (!projectId) return;
  const v = (k: string) => {
    const s = String(formData.get(k) ?? '').trim();
    return s || null;
  };
  const logo = await imageToDataUrl(formData.get('companyLogoFile'));
  const removeLogo = formData.get('removeLogo') === 'on';
  const versionHistory = parseJsonList<VersionHistoryRow>(String(formData.get('versionHistory') ?? ''));
  const distributionList = parseJsonList<DistributionRow>(String(formData.get('distributionList') ?? ''));
  const values: Record<string, unknown> = {
    projectId,
    kind: 'pentest',
    primaryColor: v('primaryColor') ?? '#069ec6',
    secondaryColor: v('secondaryColor') ?? '#08222b',
    headerStyle: v('headerStyle'),
    companyName: v('companyName'),
    companyAddress: v('companyAddress'),
    companyPhone: v('companyPhone'),
    companyEmail: v('companyEmail'),
    companyWebsite: v('companyWebsite'),
    classification: v('classification'),
    tlpLevel: v('tlpLevel'),
    footerText: v('footerText'),
    findingIdPrefix: v('findingIdPrefix'),
    assessmentType: v('assessmentType'),
    confidentialityText: v('confidentialityText'),
    confidentialityTextId: v('confidentialityTextId'),
    termsText: v('termsText'),
    termsTextId: v('termsTextId'),
    language: String(formData.get('language') ?? 'en') === 'id' ? 'id' : 'en',
  };
  // Only overwrite a list column when the textarea parsed (null clears, array sets); skip on parse error.
  if (versionHistory !== undefined) values.versionHistory = versionHistory;
  if (distributionList !== undefined) values.distributionList = distributionList;
  // Only touch the logo column when replacing or explicitly removing it.
  if (logo) values.companyLogo = logo;
  else if (removeLogo) values.companyLogo = null;
  await getDb()
    .insert(reportSettings)
    .values(values as typeof reportSettings.$inferInsert)
    .onConflictDoUpdate({ target: [reportSettings.projectId, reportSettings.kind], set: values });
  await recordAudit({
    actorId: user.id,
    action: 'report.settings_update',
    resource: `report_settings:${projectId}:pentest`,
    projectId,
  });
  revalidatePath('/settings/pentest-report');
  revalidatePath('/pentest/report-settings');
}

/** Resolve the AI Pentest project id (slug 'ai-pentest'), creating it if missing - same as the settings page. */
async function resolvePentestProjectId(): Promise<string> {
  const db = getDb();
  let [p] = await db.select().from(projects).where(eq(projects.slug, 'ai-pentest')).limit(1);
  if (!p) {
    [p] = await db.insert(projects).values({ slug: 'ai-pentest', name: 'AI Pentest', sector: 'banking' }).returning();
  }
  return p!.id;
}

/** Read the pentest (kind='pentest') report-settings row for the AI Pentest project, or null. */
async function getPentestSettings() {
  const projectId = await resolvePentestProjectId();
  const [row] = await getDb()
    .select()
    .from(reportSettings)
    .where(and(eq(reportSettings.projectId, projectId), eq(reportSettings.kind, 'pentest')));
  return { projectId, row: row ?? null };
}

/** Upsert just the versionHistory or distributionList jsonb list on the pentest settings row, then audit + revalidate. */
async function writePentestList(
  actorId: string,
  projectId: string,
  column: 'versionHistory' | 'retestVersionHistory' | 'distributionList',
  list: VersionHistoryRow[] | DistributionRow[],
) {
  const values: Record<string, unknown> = { projectId, kind: 'pentest', [column]: list };
  await getDb()
    .insert(reportSettings)
    .values(values as typeof reportSettings.$inferInsert)
    .onConflictDoUpdate({ target: [reportSettings.projectId, reportSettings.kind], set: { [column]: list } });
  await recordAudit({
    actorId,
    action: 'report.settings_update',
    resource: `report_settings:${projectId}:pentest`,
    projectId,
  });
  revalidatePath('/pentest/report-settings');
  revalidatePath('/settings/pentest-report');
}

/** Append one row to the pentest report Document-Control version history (GUI repeater, no JSON). */
export async function addPentestVersionRow(formData: FormData) {
  const user = await requirePermission(Permission.ModifyReport);
  const { projectId, row } = await getPentestSettings();
  const next: VersionHistoryRow = {
    version: String(formData.get('version') ?? '').trim(),
    date: String(formData.get('date') ?? '').trim(),
    author: String(formData.get('author') ?? '').trim(),
    changesEn: String(formData.get('changesEn') ?? '').trim() || null,
    changesId: String(formData.get('changesId') ?? '').trim() || null,
  };
  if (!next.version && !next.date && !next.author) return;
  const list = [...((row?.versionHistory as VersionHistoryRow[] | null) ?? []), next];
  await writePentestList(user.id, projectId, 'versionHistory', list);
}

/** Remove the version-history row at the given index. */
export async function removePentestVersionRow(formData: FormData) {
  const user = await requirePermission(Permission.ModifyReport);
  const index = Number(formData.get('index'));
  const { projectId, row } = await getPentestSettings();
  const current = (row?.versionHistory as VersionHistoryRow[] | null) ?? [];
  if (!Number.isInteger(index) || index < 0 || index >= current.length) return;
  const list = current.filter((_, i) => i !== index);
  await writePentestList(user.id, projectId, 'versionHistory', list);
}

/** Append one row to the RETEST report Document-Control version history (GUI repeater, no JSON). */
export async function addPentestRetestVersionRow(formData: FormData) {
  const user = await requirePermission(Permission.ModifyReport);
  const { projectId, row } = await getPentestSettings();
  const next: VersionHistoryRow = {
    version: String(formData.get('version') ?? '').trim(),
    date: String(formData.get('date') ?? '').trim(),
    author: String(formData.get('author') ?? '').trim(),
    changesEn: String(formData.get('changesEn') ?? '').trim() || null,
    changesId: String(formData.get('changesId') ?? '').trim() || null,
  };
  if (!next.version && !next.date && !next.author) return;
  const list = [...((row?.retestVersionHistory as VersionHistoryRow[] | null) ?? []), next];
  await writePentestList(user.id, projectId, 'retestVersionHistory', list);
}

/** Remove the retest version-history row at the given index. */
export async function removePentestRetestVersionRow(formData: FormData) {
  const user = await requirePermission(Permission.ModifyReport);
  const index = Number(formData.get('index'));
  const { projectId, row } = await getPentestSettings();
  const current = (row?.retestVersionHistory as VersionHistoryRow[] | null) ?? [];
  if (!Number.isInteger(index) || index < 0 || index >= current.length) return;
  const list = current.filter((_, i) => i !== index);
  await writePentestList(user.id, projectId, 'retestVersionHistory', list);
}

/** Append one row to the pentest report distribution list (GUI repeater, no JSON). */
export async function addPentestDistributionRow(formData: FormData) {
  const user = await requirePermission(Permission.ModifyReport);
  const { projectId, row } = await getPentestSettings();
  const next: DistributionRow = {
    positionEn: String(formData.get('positionEn') ?? '').trim(),
    positionId: String(formData.get('positionId') ?? '').trim() || null,
    company: String(formData.get('company') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    name: String(formData.get('name') ?? '').trim() || null,
  };
  if (!next.positionEn && !next.name && !next.email) return;
  const list = [...((row?.distributionList as DistributionRow[] | null) ?? []), next];
  await writePentestList(user.id, projectId, 'distributionList', list);
}

/** Remove the distribution-list row at the given index. */
export async function removePentestDistributionRow(formData: FormData) {
  const user = await requirePermission(Permission.ModifyReport);
  const index = Number(formData.get('index'));
  const { projectId, row } = await getPentestSettings();
  const current = (row?.distributionList as DistributionRow[] | null) ?? [];
  if (!Number.isInteger(index) || index < 0 || index >= current.length) return;
  const list = current.filter((_, i) => i !== index);
  await writePentestList(user.id, projectId, 'distributionList', list);
}

export async function addSignatoryAction(formData: FormData) {
  await requirePermission(Permission.ModifyReport);
  const projectId = String(formData.get('projectId') ?? '');
  const role = String(formData.get('role') ?? 'prepared');
  const name = String(formData.get('name') ?? '').trim();
  const position = String(formData.get('position') ?? '').trim();
  if (!projectId || !name || !['prepared', 'reviewed', 'approved'].includes(role)) return;
  const order = role === 'prepared' ? 0 : role === 'reviewed' ? 1 : 2;
  const signatureImage = (await imageToDataUrl(formData.get('signatureImageFile'))) ?? null;
  await getDb().insert(reportSignatories).values({ projectId, role, name, position, sortOrder: order, signatureImage });
  revalidatePath('/settings/reports');
  revalidatePath('/settings/pentest-report');
  revalidatePath('/pentest/report-settings');
}

export async function editSignatoryAction(formData: FormData) {
  await requirePermission(Permission.ModifyReport);
  const id = String(formData.get('id') ?? '');
  const role = String(formData.get('role') ?? 'prepared');
  const name = String(formData.get('name') ?? '').trim();
  const position = String(formData.get('position') ?? '').trim();
  if (!id || !name || !['prepared', 'reviewed', 'approved'].includes(role)) return;
  const order = role === 'prepared' ? 0 : role === 'reviewed' ? 1 : 2;
  const values: Record<string, unknown> = { role, name, position, sortOrder: order };
  // Only replace the signature image when a new one is uploaded; keep the existing otherwise.
  const signatureImage = await imageToDataUrl(formData.get('signatureImageFile'));
  if (signatureImage) values.signatureImage = signatureImage;
  await getDb().update(reportSignatories).set(values).where(eq(reportSignatories.id, id));
  revalidatePath('/settings/reports');
}

export async function deleteSignatoryAction(formData: FormData) {
  await requirePermission(Permission.ModifyReport);
  const id = String(formData.get('id') ?? '');
  if (id) await getDb().delete(reportSignatories).where(eq(reportSignatories.id, id));
  revalidatePath('/settings/reports');
  revalidatePath('/settings/pentest-report');
  revalidatePath('/pentest/report-settings');
}
