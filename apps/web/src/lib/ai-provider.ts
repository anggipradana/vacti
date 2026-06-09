import { eq } from 'drizzle-orm';
import { aiSettings, aiDefaults } from '@vacti/db';
import { makeProvider, getProjectSecret, resolveAiModel, type AiProvider, type AiConfig } from '@vacti/integrations';
import { getDb, env } from './db';

// Shared (NOT a 'use server' module) so both server actions and internal route handlers can use it.
export type AiProviderName = 'anthropic' | 'openai' | 'deepseek' | 'kimi' | 'ollama';
export const AI_PROVIDERS: AiProviderName[] = ['anthropic', 'openai', 'deepseek', 'kimi', 'ollama'];

/**
 * Resolve the effective AI config for a project: its own ai_settings, else the system default
 * (ai_defaults singleton), else a hardcoded fallback. The per-project vault key (named after the
 * provider) overrides the matching environment key.
 */
export async function resolveAiConfig(projectId: string): Promise<AiConfig> {
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

/** Resolve an AI provider for a project (vault key -> env fallback), or null if unconfigured. */
export async function providerFor(projectId: string): Promise<AiProvider | null> {
  return makeProvider(await resolveAiConfig(projectId));
}
