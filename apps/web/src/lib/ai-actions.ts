'use server';

import { revalidatePath } from 'next/cache';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { Permission } from '@vacti/core';
import {
  makeProvider,
  enrichVulnerability,
  enrichmentHash,
  getProjectSecret,
  generateExecutiveSummary,
  generateThreatNarrative,
  triageNewsRelevance,
  resolveAiModel,
  type AiProvider,
  type AiConfig,
} from '@vacti/integrations';
import { computeProjectRisk } from '@vacti/threat-intel';
import {
  vulnerabilities,
  scans,
  aiSettings,
  aiDefaults,
  aiCache,
  targets,
  subdomains,
  endpoints,
  ports as portsTable,
  reportSettings,
  threatIntelStatus,
  otxThreatData,
  leakcheckData,
  projects,
  threatNews,
  brandNews,
} from '@vacti/db';
import { getDb, env } from './db';
import { requirePermission } from './authz';
import { recordAudit } from './audit';

// Note: this is a 'use server' module, so it may only EXPORT async functions. Keep these local.
type AiProviderName = 'anthropic' | 'openai' | 'deepseek' | 'kimi' | 'ollama';
const AI_PROVIDERS: AiProviderName[] = ['anthropic', 'openai', 'deepseek', 'kimi', 'ollama'];

/**
 * Resolve the effective AI config for a project: its own ai_settings, else the system default
 * (ai_defaults singleton), else a hardcoded fallback. The per-project vault key (named after the
 * provider) overrides the matching environment key.
 */
async function resolveAiConfig(projectId: string): Promise<AiConfig> {
  const db = getDb();
  const e = env();
  const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.projectId, projectId));
  const [defaults] = await db.select().from(aiDefaults).where(eq(aiDefaults.id, 'default'));
  const prov = (settings?.provider ?? defaults?.provider ?? 'anthropic') as AiProviderName;
  // Use a model valid for the chosen provider (a leftover cross-provider model makes the API reject
  // the call, which would silently disable enrichment).
  const model = resolveAiModel(prov, settings?.model ?? defaults?.model);
  const baseUrl = settings?.baseUrl ?? defaults?.baseUrl ?? undefined;
  // Vault key name == provider name for the cloud providers; falls back to the env key.
  const vaultKey = await getProjectSecret(db, projectId, prov, e.ENCRYPTION_KEY);
  const cfg: AiConfig = { provider: prov, model, baseUrl, ollamaBaseUrl: e.OLLAMA_BASE_URL };
  if (prov === 'anthropic') cfg.anthropicKey = vaultKey ?? e.ANTHROPIC_API_KEY;
  else if (prov === 'openai') cfg.openaiKey = vaultKey ?? e.OPENAI_API_KEY;
  else if (prov === 'deepseek') cfg.deepseekKey = vaultKey ?? e.DEEPSEEK_API_KEY;
  else if (prov === 'kimi') cfg.kimiKey = vaultKey ?? e.KIMI_API_KEY;
  return cfg;
}

/** Resolve an AI provider for a project (vault key → env fallback), or null if unconfigured. */
async function providerFor(projectId: string): Promise<AiProvider | null> {
  return makeProvider(await resolveAiConfig(projectId));
}

export async function enrichVulnAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const id = String(formData.get('id') ?? '');
  const scanId = String(formData.get('scanId') ?? '');
  const db = getDb();
  const [vuln] = await db.select().from(vulnerabilities).where(eq(vulnerabilities.id, id));
  if (!vuln) return;
  const [scan] = await db.select().from(scans).where(eq(scans.id, vuln.scanId));
  const provider = scan ? await providerFor(scan.projectId) : null;
  if (!provider) {
    // No AI key configured - degrade gracefully (no-op).
    if (scanId) revalidatePath(`/scans/${scanId}`);
    return;
  }
  const input = { name: vuln.name, type: vuln.type, matchedAt: vuln.matchedAt, severity: vuln.severity };
  const hash = enrichmentHash(input);
  const [cached] = await db.select().from(aiCache).where(eq(aiCache.hash, hash));
  let enrichment;
  if (cached) {
    enrichment = JSON.parse(cached.output) as { description: string; impact: string; remediation: string };
  } else {
    enrichment = await enrichVulnerability(input, provider);
    await db
      .insert(aiCache)
      .values({ hash, kind: 'vuln', output: JSON.stringify(enrichment) })
      .onConflictDoNothing();
  }
  await db
    .update(vulnerabilities)
    .set({
      aiDescription: enrichment.description,
      aiImpact: enrichment.impact,
      aiRemediation: enrichment.remediation,
      isAiEnriched: true,
    })
    .where(eq(vulnerabilities.id, id));
  if (scanId) revalidatePath(`/scans/${scanId}`);
}

export async function saveAiSettingsAction(formData: FormData) {
  await requirePermission(Permission.ModifySystemConfig);
  const projectId = String(formData.get('projectId') ?? '');
  if (!projectId) return;
  const provider = String(formData.get('provider') ?? 'anthropic');
  // Empty provider = "use system default": drop the per-project override so it follows ai_defaults.
  if (provider === '') {
    await getDb().delete(aiSettings).where(eq(aiSettings.projectId, projectId));
    revalidatePath('/settings/integrations');
    return;
  }
  const model = resolveAiModel(provider, String(formData.get('model') ?? ''));
  const rawBaseUrl = String(formData.get('baseUrl') ?? '').trim();
  // Optional override endpoint; must be a valid http(s) URL when present, else store null (vendor default).
  const baseUrl = rawBaseUrl && /^https?:\/\//i.test(rawBaseUrl) ? rawBaseUrl : null;
  if (!AI_PROVIDERS.includes(provider as AiProviderName)) return;
  await getDb()
    .insert(aiSettings)
    .values({ projectId, provider, model, baseUrl })
    .onConflictDoUpdate({ target: aiSettings.projectId, set: { provider, model, baseUrl } });
  revalidatePath('/settings/integrations');
}

/** Save the system-wide default AI enrichment config (used by projects without their own setting). */
export async function saveAiDefaultsAction(formData: FormData) {
  await requirePermission(Permission.ModifySystemConfig);
  const provider = String(formData.get('provider') ?? 'anthropic');
  const model = resolveAiModel(provider, String(formData.get('model') ?? ''));
  const rawBaseUrl = String(formData.get('baseUrl') ?? '').trim();
  const baseUrl = rawBaseUrl && /^https?:\/\//i.test(rawBaseUrl) ? rawBaseUrl : null;
  if (!AI_PROVIDERS.includes(provider as AiProviderName)) return;
  await getDb()
    .insert(aiDefaults)
    .values({ id: 'default', provider, model, baseUrl, updatedAt: new Date() })
    .onConflictDoUpdate({ target: aiDefaults.id, set: { provider, model, baseUrl, updatedAt: new Date() } });
  revalidatePath('/settings/integrations');
}

/** G7 - generate the VA executive summary (EN+ID) from the project's latest scan, store on report settings. */
export async function generateExecSummaryAction(formData: FormData) {
  await requirePermission(Permission.ModifyReport);
  const projectId = String(formData.get('projectId') ?? '');
  if (!projectId) return;
  const db = getDb();
  const provider = await providerFor(projectId);
  if (!provider) {
    revalidatePath('/settings/reports');
    return;
  }
  const [scan] = await db
    .select()
    .from(scans)
    .where(eq(scans.projectId, projectId))
    .orderBy(desc(scans.createdAt))
    .limit(1);
  if (!scan) return;
  const [target] = await db.select().from(targets).where(eq(targets.id, scan.targetId));
  const [subs, eps, prt, vulns] = await Promise.all([
    db.select().from(subdomains).where(eq(subdomains.scanId, scan.id)),
    db.select().from(endpoints).where(eq(endpoints.scanId, scan.id)),
    db.select().from(portsTable).where(eq(portsTable.scanId, scan.id)),
    db.select().from(vulnerabilities).where(eq(vulnerabilities.scanId, scan.id)),
  ]);
  const sev = (n: number) => vulns.filter((v) => v.severity === n).length;
  const active = vulns.filter((v) => ['open', 'in_progress', 'reopened'].includes(v.status)).length;
  const base = {
    target: target?.domain ?? 'target',
    counts: { subdomains: subs.length, endpoints: eps.length, ports: prt.length, vulns: vulns.length, active },
    severities: { critical: sev(4), high: sev(3), medium: sev(2), low: sev(1), info: sev(0) },
    topFindings: [...new Set(vulns.filter((v) => v.severity >= 3).map((v) => v.name))].slice(0, 5),
  };
  const [en, id] = await Promise.all([
    generateExecutiveSummary({ ...base, lang: 'en' }, provider),
    generateExecutiveSummary({ ...base, lang: 'id' }, provider),
  ]);
  await db
    .insert(reportSettings)
    .values({ projectId, kind: 'va', showExecutiveSummary: true, executiveSummary: en, executiveSummaryId: id })
    .onConflictDoUpdate({
      target: [reportSettings.projectId, reportSettings.kind],
      set: { showExecutiveSummary: true, executiveSummary: en, executiveSummaryId: id },
    });
  revalidatePath('/settings/reports');
}

/** G8 - generate the threat-intelligence narrative for a project, store on the TI status row. */
export async function generateThreatNarrativeAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const projectId = String(formData.get('projectId') ?? '');
  const lang = String(formData.get('lang') ?? 'en') === 'id' ? 'id' : 'en';
  if (!projectId) return;
  const db = getDb();
  const provider = await providerFor(projectId);
  if (!provider) {
    revalidatePath('/threat');
    return;
  }
  const [risk, otx, leaks, [project]] = await Promise.all([
    computeProjectRisk(db, projectId),
    db.select().from(otxThreatData).where(eq(otxThreatData.projectId, projectId)),
    db.select().from(leakcheckData).where(eq(leakcheckData.projectId, projectId)),
    db.select().from(projects).where(eq(projects.id, projectId)),
  ]);
  const score = Math.max(0, Math.min(100, risk.score));
  const narrative = await generateThreatNarrative(
    {
      project: project?.name ?? 'project',
      lang,
      riskScore: score,
      riskLevel: score >= 71 ? 'HIGH' : score >= 31 ? 'MEDIUM' : 'LOW',
      totals: {
        pulses: otx.reduce((a, o) => a + o.pulses, 0),
        malware: otx.reduce((a, o) => a + o.malwareCount, 0),
        leaks: leaks.length,
      },
      components: risk.components,
    },
    provider,
  );
  await db
    .insert(threatIntelStatus)
    .values({ projectId, aiNarrative: narrative })
    .onConflictDoUpdate({ target: threatIntelStatus.projectId, set: { aiNarrative: narrative } });
  revalidatePath('/threat');
}

/**
 * AI relevance triage (opt-in). Looks at untriaged ("new") headlines and, learning from what the
 * analyst previously marked Irrelevant (and Relevant), auto-marks the noise as Irrelevant. Reversible
 * via the per-item dropdown. Degrades to a no-op when no AI provider is configured.
 */
export async function aiTriageNewsAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const projectId = String(formData.get('projectId') ?? '');
  const kind = String(formData.get('kind') ?? 'brand') === 'sector' ? 'sector' : 'brand';
  if (!projectId) return;
  const db = getDb();
  const provider = await providerFor(projectId);
  if (!provider) {
    revalidatePath('/threat');
    return;
  }
  const [proj] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!proj) return;

  // Candidates = untriaged headlines; examples = the analyst's prior decisions (learning signal).
  const CAND_LIMIT = 40;
  let candidates: { id: string; title: string }[];
  let irrelevantExamples: string[];
  let relevantExamples: string[];
  let context: string;
  if (kind === 'sector') {
    const sector = proj.sector;
    const [cand, irr, rel] = await Promise.all([
      db
        .select({ id: threatNews.id, title: threatNews.title })
        .from(threatNews)
        .where(and(eq(threatNews.sector, sector), eq(threatNews.status, 'new')))
        .orderBy(desc(threatNews.publishedAt))
        .limit(CAND_LIMIT),
      db
        .select({ title: threatNews.title })
        .from(threatNews)
        .where(and(eq(threatNews.sector, sector), eq(threatNews.status, 'dismissed')))
        .limit(15),
      db
        .select({ title: threatNews.title })
        .from(threatNews)
        .where(and(eq(threatNews.sector, sector), inArray(threatNews.status, ['relevant', 'actioned'])))
        .limit(15),
    ]);
    candidates = cand;
    irrelevantExamples = irr.map((r) => r.title);
    relevantExamples = rel.map((r) => r.title);
    context = `${sector} sector security news`;
  } else {
    const [cand, irr, rel] = await Promise.all([
      db
        .select({ id: brandNews.id, title: brandNews.title })
        .from(brandNews)
        .where(and(eq(brandNews.projectId, projectId), eq(brandNews.status, 'new')))
        .orderBy(desc(brandNews.publishedAt))
        .limit(CAND_LIMIT),
      db
        .select({ title: brandNews.title })
        .from(brandNews)
        .where(and(eq(brandNews.projectId, projectId), eq(brandNews.status, 'dismissed')))
        .limit(15),
      db
        .select({ title: brandNews.title })
        .from(brandNews)
        .where(and(eq(brandNews.projectId, projectId), inArray(brandNews.status, ['relevant', 'actioned'])))
        .limit(15),
    ]);
    candidates = cand;
    irrelevantExamples = irr.map((r) => r.title);
    relevantExamples = rel.map((r) => r.title);
    context = `brand monitoring for "${proj.brandQuery || proj.name}"`;
  }

  if (!candidates.length) {
    revalidatePath('/threat');
    return;
  }
  const indices = await triageNewsRelevance(
    { context, irrelevantExamples, relevantExamples, candidates: candidates.map((c) => c.title) },
    provider,
  );
  const ids = indices.map((i) => candidates[i - 1]?.id).filter((x): x is string => Boolean(x));
  if (ids.length) {
    const actor = await requirePermission(Permission.ModifyScanResults);
    if (kind === 'sector') {
      await db.update(threatNews).set({ status: 'dismissed' }).where(inArray(threatNews.id, ids));
    } else {
      await db.update(brandNews).set({ status: 'dismissed' }).where(inArray(brandNews.id, ids));
    }
    await recordAudit({
      actorId: actor.id,
      action: 'news.ai_triage',
      resource: `${kind}:${projectId}`,
      projectId,
      metadata: { dismissed: ids.length, candidates: candidates.length },
    });
  }
  revalidatePath('/threat');
}
