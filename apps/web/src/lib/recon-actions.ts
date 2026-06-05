'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Permission, isValidCron, buildCron, type ScheduleFrequency } from '@vacti/core';
import { targets, scans, scanSchedules, reconNotes, scanProfiles } from '@vacti/db';
import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { getQueue } from './queue';
import { requirePermission } from './authz';
import { recordAudit } from './audit';

const scanJob = z.object({ scanId: z.string().uuid() });

/** Split a textarea/CSV field into a trimmed string[] (空 → []). */
function list(v: FormDataEntryValue | null): string[] {
  return String(v ?? '')
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
const num = (v: FormDataEntryValue | null): number | undefined => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const ALL_TOOL_KEYS = ['subfinder', 'httpx', 'naabu', 'nuclei', 'wordfence'] as const;
const ALL_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;

/** Create a scan profile with advanced per-tool config (modify_scan_config). */
export async function saveProfileAction(formData: FormData) {
  const actor = await requirePermission(Permission.ModifyScanConfig);
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/settings/profiles?error=invalid');
  const picked = new Set(formData.getAll('tools').map(String));
  const tools = Object.fromEntries(ALL_TOOL_KEYS.map((t) => [t, picked.has(t)]));
  const sev = formData.getAll('severities').map(String).filter(Boolean);
  const config: Record<string, unknown> = {};
  const ua = String(formData.get('userAgent') ?? '').trim();
  if (ua) config.userAgent = ua;
  const rate = num(formData.get('rateLimit'));
  if (rate) config.rateLimit = rate;
  const conc = num(formData.get('concurrency'));
  if (conc) config.concurrency = conc;
  const retries = num(formData.get('retries'));
  if (retries !== undefined) config.retries = retries;
  const nt = list(formData.get('nucleiTags'));
  if (nt.length) config.nucleiTags = nt;
  const ntpl = list(formData.get('nucleiTemplates'));
  if (ntpl.length) config.nucleiTemplates = ntpl;
  const net = list(formData.get('nucleiExcludeTags'));
  if (net.length) config.nucleiExcludeTags = net;
  const ex = list(formData.get('excludeSubdomains'));
  if (ex.length) config.excludeSubdomains = ex;
  const extra = list(formData.get('nucleiExtraArgs'));
  if (extra.length) config.extraArgs = { nuclei: extra };

  await getDb()
    .insert(scanProfiles)
    .values({
      name,
      tools,
      ports: String(formData.get('ports') ?? 'top-100').trim() || 'top-100',
      severities: sev.length ? sev : [...ALL_SEVERITIES.slice(0, 4)],
      rate: rate ?? null,
      config: Object.keys(config).length ? config : null,
    });
  await recordAudit({ actorId: actor.id, action: 'profile.create', resource: `profile:${name}` });
  revalidatePath('/settings/profiles');
}

export async function deleteProfileAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanConfig);
  const id = String(formData.get('id') ?? '');
  if (id) await getDb().delete(scanProfiles).where(eq(scanProfiles.id, id));
  revalidatePath('/settings/profiles');
}

/** Parse "Key: value" lines into a headers object (ignores blank/malformed lines). */
function parseHeaders(raw: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && v) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export async function createTargetAction(formData: FormData) {
  await requirePermission(Permission.ModifyTargets);
  const projectId = String(formData.get('projectId') ?? '');
  const domain = String(formData.get('domain') ?? '').trim();
  const subsRaw = String(formData.get('predefinedSubdomains') ?? '').trim();
  const headersRaw = String(formData.get('customHeaders') ?? '').trim();
  if (!projectId || !domain) redirect('/targets?error=invalid');
  const predefinedSubdomains = subsRaw
    ? subsRaw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const customHeaders = headersRaw ? parseHeaders(headersRaw) : null;
  await getDb().insert(targets).values({ projectId, domain, predefinedSubdomains, customHeaders });
  revalidatePath('/targets');
}

export async function startScanAction(formData: FormData) {
  const actor = await requirePermission(Permission.InitiateScans);
  const targetId = String(formData.get('targetId') ?? '');
  const profileId = String(formData.get('profileId') ?? '').trim() || null;
  const [target] = await getDb().select().from(targets).where(eq(targets.id, targetId));
  if (!target) redirect('/scans?error=notarget');
  const [scan] = await getDb()
    .insert(scans)
    .values({ projectId: target.projectId, targetId: target.id, profileId })
    .returning();
  await recordAudit({
    actorId: actor.id,
    action: 'scan.start',
    resource: `scan:${scan!.id}`,
    projectId: target.projectId,
    metadata: { targetId },
  });
  const q = await getQueue();
  await q.enqueue('scan', scanJob, { scanId: scan!.id });
  redirect(`/scans/${scan!.id}`);
}

/** Request cancellation of a running/queued scan (worker polls the flag and aborts). */
export async function cancelScanAction(formData: FormData) {
  const actor = await requirePermission(Permission.InitiateScans);
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const db = getDb();
  const [scan] = await db.select().from(scans).where(eq(scans.id, id));
  if (!scan || ['completed', 'failed', 'cancelled'].includes(scan.status)) return;
  await recordAudit({ actorId: actor.id, action: 'scan.cancel', resource: `scan:${id}`, projectId: scan.projectId });
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
  const profileId = String(formData.get('profileId') ?? '').trim() || null;
  // Build the cron from the friendly schedule pickers (frequency + time + day).
  const freq = String(formData.get('freq') ?? 'daily') as ScheduleFrequency;
  const [hh, mm] = String(formData.get('time') ?? '02:00').split(':');
  const cron = buildCron({
    freq,
    hour: Number(hh) || 0,
    minute: Number(mm) || 0,
    dow: Number(formData.get('dow') ?? 1),
    dom: Number(formData.get('dom') ?? 1),
  });
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

// ---- Recon notes / TODOs (per target) ----
export async function addNoteAction(formData: FormData) {
  await requirePermission(Permission.ModifyTargets);
  const targetId = String(formData.get('targetId') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!targetId || !body) return;
  await getDb().insert(reconNotes).values({ targetId, body });
  revalidatePath(`/targets/${targetId}`);
}

export async function toggleNoteAction(formData: FormData) {
  await requirePermission(Permission.ModifyTargets);
  const id = String(formData.get('id') ?? '');
  const targetId = String(formData.get('targetId') ?? '');
  if (!id) return;
  const [row] = await getDb().select().from(reconNotes).where(eq(reconNotes.id, id));
  if (row) await getDb().update(reconNotes).set({ done: !row.done }).where(eq(reconNotes.id, id));
  if (targetId) revalidatePath(`/targets/${targetId}`);
}

export async function deleteNoteAction(formData: FormData) {
  await requirePermission(Permission.ModifyTargets);
  const id = String(formData.get('id') ?? '');
  const targetId = String(formData.get('targetId') ?? '');
  if (id) await getDb().delete(reconNotes).where(eq(reconNotes.id, id));
  if (targetId) revalidatePath(`/targets/${targetId}`);
}
