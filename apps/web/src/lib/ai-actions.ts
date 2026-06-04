'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { Permission } from '@vacti/core';
import { makeProvider, enrichVulnerability, enrichmentHash, getProjectSecret } from '@vacti/integrations';
import { vulnerabilities, scans, aiSettings, aiCache } from '@vacti/db';
import { getDb, env } from './db';
import { requirePermission } from './authz';

export async function enrichVulnAction(formData: FormData) {
  await requirePermission(Permission.ModifyScanResults);
  const id = String(formData.get('id') ?? '');
  const scanId = String(formData.get('scanId') ?? '');
  const db = getDb();
  const [vuln] = await db.select().from(vulnerabilities).where(eq(vulnerabilities.id, id));
  if (!vuln) return;
  const [scan] = await db.select().from(scans).where(eq(scans.id, vuln.scanId));
  const [settings] = scan ? await db.select().from(aiSettings).where(eq(aiSettings.projectId, scan.projectId)) : [];
  const e = env();
  const prov = (settings?.provider as 'anthropic' | 'openai' | 'ollama') ?? 'anthropic';
  // Per-project vault key overrides the environment default for the chosen provider.
  const vaultKey = scan ? await getProjectSecret(db, scan.projectId, prov, e.ENCRYPTION_KEY) : null;
  const provider = await makeProvider({
    provider: prov,
    model: settings?.model ?? 'claude-sonnet-4-6',
    anthropicKey: prov === 'anthropic' ? (vaultKey ?? e.ANTHROPIC_API_KEY) : e.ANTHROPIC_API_KEY,
    openaiKey: prov === 'openai' ? (vaultKey ?? e.OPENAI_API_KEY) : e.OPENAI_API_KEY,
    ollamaBaseUrl: e.OLLAMA_BASE_URL,
  });
  if (!provider) {
    // No AI key configured — degrade gracefully (no-op).
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
  const provider = String(formData.get('provider') ?? 'anthropic');
  const model = String(formData.get('model') ?? '').trim() || 'claude-sonnet-4-6';
  if (!projectId || !['anthropic', 'openai', 'ollama'].includes(provider)) return;
  await getDb()
    .insert(aiSettings)
    .values({ projectId, provider, model })
    .onConflictDoUpdate({ target: aiSettings.projectId, set: { provider, model } });
  revalidatePath('/settings/integrations');
}
