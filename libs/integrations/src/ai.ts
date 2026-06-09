import { createHash } from 'node:crypto';

export interface AiProvider {
  generate(system: string, prompt: string): Promise<string>;
}

export interface AiConfig {
  provider: 'anthropic' | 'openai' | 'deepseek' | 'kimi' | 'ollama';
  model: string;
  anthropicKey?: string;
  openaiKey?: string;
  deepseekKey?: string;
  kimiKey?: string;
  ollamaBaseUrl?: string;
  /**
   * Optional override endpoint for Anthropic/OpenAI-compatible APIs (a local proxy or gateway).
   * Blank → the SDK's default vendor cloud endpoint. Does not apply to Ollama (use ollamaBaseUrl).
   */
  baseUrl?: string;
}

/** Sensible default model per provider, used when none is configured. */
export const DEFAULT_AI_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
  deepseek: 'deepseek-chat',
  kimi: 'kimi-for-coding',
  ollama: 'llama3',
};

/**
 * Pick a model that is actually valid for the provider. Guards against a model left over from a
 * different provider (e.g. switching to Kimi/DeepSeek but keeping the Claude default) - that mismatch
 * makes the provider reject the request, so the AI features silently degrade to no-ops. Kimi Code
 * only accepts `kimi-for-coding`.
 */
export function resolveAiModel(provider: string, model?: string | null): string {
  const m = (model ?? '').trim();
  if (provider === 'kimi') return 'kimi-for-coding';
  if (provider === 'deepseek') return /deepseek/i.test(m) ? m : 'deepseek-chat';
  return m || DEFAULT_AI_MODELS[provider] || 'claude-sonnet-4-6';
}

export interface VulnEnrichmentInput {
  name: string;
  type?: string | null;
  matchedAt?: string | null;
  severity?: number;
}

export interface VulnEnrichment {
  description: string;
  impact: string;
  remediation: string;
}

/**
 * Reports and narration must never contain em/en dashes (— / –). Even with the instruction in the
 * system prompt, models slip them in, so normalise any to a plain hyphen as a hard guarantee.
 */
export function stripEmDash(s: string): string {
  return s.replace(/[—–]/g, '-');
}

const SYSTEM = `You are a senior application security engineer. For the given vulnerability finding, write a concise, technically accurate report in EXACTLY three sections with these headings:
Description:
Impact:
Remediation:
Use plain text, no markdown bullets in headings. Be specific and actionable. Do not use em dashes (the "—" character); use hyphens, commas, or separate sentences instead.`;

export function buildVulnPrompt(v: VulnEnrichmentInput): string {
  return [
    `Finding: ${v.name}`,
    v.type ? `Type: ${v.type}` : '',
    v.matchedAt ? `Location: ${v.matchedAt}` : '',
    typeof v.severity === 'number' ? `Severity (0=info..4=critical): ${v.severity}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Parse the model's three-section output. Tolerant of missing sections. */
export function parseEnrichment(text: string): VulnEnrichment {
  const grab = (label: string, next: string[]): string => {
    const re = new RegExp(`${label}\\s*:?\\s*([\\s\\S]*?)(?=(?:${next.join('|')})\\s*:|$)`, 'i');
    return (text.match(re)?.[1] ?? '').trim();
  };
  return {
    description: grab('Description', ['Impact', 'Remediation']),
    impact: grab('Impact', ['Remediation', 'Description']),
    remediation: grab('Remediation', ['Description', 'Impact']),
  };
}

export async function enrichVulnerability(v: VulnEnrichmentInput, provider: AiProvider): Promise<VulnEnrichment> {
  return parseEnrichment(stripEmDash(await provider.generate(SYSTEM, buildVulnPrompt(v))));
}

/** Build a concrete provider via the Vercel AI SDK. Returns null when no key/config (graceful degrade). */
export async function makeProvider(cfg: AiConfig): Promise<AiProvider | null> {
  try {
    // A blank/whitespace baseUrl must behave exactly like "unset" (vendor default endpoint).
    const baseURL = cfg.baseUrl?.trim() || undefined;
    if (cfg.provider === 'anthropic') {
      if (!cfg.anthropicKey) return null;
      const [{ generateText }, { createAnthropic }] = await Promise.all([import('ai'), import('@ai-sdk/anthropic')]);
      const anthropic = createAnthropic({ apiKey: cfg.anthropicKey, ...(baseURL ? { baseURL } : {}) });
      return {
        generate: async (system, prompt) => (await generateText({ model: anthropic(cfg.model), system, prompt })).text,
      };
    }
    if (cfg.provider === 'openai') {
      if (!cfg.openaiKey) return null;
      const [{ generateText }, { createOpenAI }] = await Promise.all([import('ai'), import('@ai-sdk/openai')]);
      const openai = createOpenAI({ apiKey: cfg.openaiKey, ...(baseURL ? { baseURL } : {}) });
      return {
        generate: async (system, prompt) => (await generateText({ model: openai(cfg.model), system, prompt })).text,
      };
    }
    if (cfg.provider === 'deepseek') {
      if (!cfg.deepseekKey) return null;
      // DeepSeek is OpenAI-compatible, so reuse the OpenAI SDK pointed at its endpoint (no new dep).
      const [{ generateText }, { createOpenAI }] = await Promise.all([import('ai'), import('@ai-sdk/openai')]);
      const deepseek = createOpenAI({
        apiKey: cfg.deepseekKey,
        baseURL: baseURL ?? 'https://api.deepseek.com/v1',
        compatibility: 'compatible',
      });
      return {
        generate: async (system, prompt) => (await generateText({ model: deepseek(cfg.model), system, prompt })).text,
      };
    }
    if (cfg.provider === 'kimi') {
      if (!cfg.kimiKey) return null;
      // Kimi Code API (kimi.com/code) is OpenAI-compatible; reuse the OpenAI SDK pointed at it.
      const [{ generateText }, { createOpenAI }] = await Promise.all([import('ai'), import('@ai-sdk/openai')]);
      const kimi = createOpenAI({
        apiKey: cfg.kimiKey,
        baseURL: baseURL ?? 'https://api.kimi.com/coding/v1',
        compatibility: 'compatible',
      });
      return {
        generate: async (system, prompt) => (await generateText({ model: kimi(cfg.model), system, prompt })).text,
      };
    }
    if (cfg.provider === 'ollama' && cfg.ollamaBaseUrl) {
      const base = cfg.ollamaBaseUrl;
      return {
        generate: async (system, prompt) => {
          const res = await fetch(`${base}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: cfg.model, system, prompt, stream: false }),
          });
          if (!res.ok) throw new Error(`ollama ${res.status}`);
          return ((await res.json()) as { response?: string }).response ?? '';
        },
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ---- News relevance triage (learns from analyst "Irrelevant" marks) ----

export interface NewsTriageInput {
  /** What the news is being monitored for, e.g. "banking sector security news" or "brand: Hijra". */
  context: string;
  /** Titles the analyst previously marked Irrelevant — negative examples to learn from. */
  irrelevantExamples: string[];
  /** Titles the analyst marked Relevant/Actioned — positive examples to learn from. */
  relevantExamples: string[];
  /** Candidate (untriaged) titles to classify, in order. */
  candidates: string[];
}

export function buildNewsTriagePrompt(input: NewsTriageInput): { system: string; prompt: string } {
  const system =
    'You are a cyber threat-intelligence analyst assistant. You triage news headlines for relevance ' +
    "to a monitoring context. Learn from the analyst's past decisions. A headline is IRRELEVANT if it " +
    'is off-topic, marketing/promotional, generic non-security news, or unrelated to the context. ' +
    'Return ONLY a compact JSON array of the 1-based indices of the IRRELEVANT candidates, e.g. [1,4,5]. ' +
    'If every candidate is relevant, return []. Output nothing else.';
  const ex = (label: string, xs: string[]) =>
    xs.length
      ? `${label}:\n${xs
          .slice(0, 15)
          .map((t) => `- ${t}`)
          .join('\n')}`
      : '';
  const prompt = [
    `Monitoring context: ${input.context}`,
    ex('Examples the analyst marked IRRELEVANT', input.irrelevantExamples),
    ex('Examples the analyst marked RELEVANT', input.relevantExamples),
    `Candidates to classify:\n${input.candidates.map((t, i) => `${i + 1}. ${t}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return { system, prompt };
}

/** Parse the model's JSON array of 1-based indices; keep only valid, in-range, unique values. */
export function parseIrrelevantIndices(text: string, max: number): number[] {
  const m = text.match(/\[[\s\S]*?\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]) as unknown;
    if (!Array.isArray(arr)) return [];
    const out = new Set<number>();
    for (const v of arr) {
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      if (Number.isInteger(n) && n >= 1 && n <= max) out.add(n);
    }
    return [...out];
  } catch {
    return [];
  }
}

/** Ask the provider which candidate headlines are irrelevant. Returns 1-based indices. */
export async function triageNewsRelevance(input: NewsTriageInput, provider: AiProvider): Promise<number[]> {
  if (!input.candidates.length) return [];
  const { system, prompt } = buildNewsTriagePrompt(input);
  return parseIrrelevantIndices(await provider.generate(system, prompt), input.candidates.length);
}

export function enrichmentHash(v: VulnEnrichmentInput): string {
  return createHash('sha256')
    .update(`${v.name}|${v.type ?? ''}`)
    .digest('hex');
}

// ---- Executive summary (VA report) ----

export interface ExecSummaryInput {
  target: string;
  lang: 'en' | 'id';
  counts: { subdomains: number; endpoints: number; ports: number; vulns: number; active: number };
  severities: { critical: number; high: number; medium: number; low: number; info: number };
  topFindings: string[];
}

export async function generateExecutiveSummary(input: ExecSummaryInput, provider: AiProvider): Promise<string> {
  const system =
    input.lang === 'id'
      ? 'Anda penulis laporan keamanan senior. Tulis ringkasan eksekutif 2-4 kalimat dalam Bahasa Indonesia untuk pembaca manajemen. Faktual, ringkas, tanpa markdown. Jangan gunakan tanda em dash (karakter "—"); pakai tanda hubung, koma, atau kalimat terpisah.'
      : 'You are a senior security report writer. Write a 2-4 sentence executive summary for a management audience. Factual, concise, no markdown. Do not use em dashes (the "—" character); use hyphens, commas, or separate sentences instead.';
  const prompt = [
    `Target: ${input.target}`,
    `Subdomains: ${input.counts.subdomains}, live endpoints: ${input.counts.endpoints}, open ports: ${input.counts.ports}`,
    `Vulnerabilities: ${input.counts.vulns} (${input.counts.active} active), crit ${input.severities.critical}, high ${input.severities.high}, med ${input.severities.medium}, low ${input.severities.low}, info ${input.severities.info}`,
    input.topFindings.length ? `Notable findings: ${input.topFindings.slice(0, 5).join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return stripEmDash((await provider.generate(system, prompt)).trim());
}

// ---- Threat-intelligence narrative (TI report / page) ----

export interface ThreatNarrativeInput {
  project: string;
  lang: 'en' | 'id';
  riskScore: number;
  riskLevel: string;
  totals: { pulses: number; malware: number; leaks: number };
  components?: Record<string, number>;
}

export async function generateThreatNarrative(input: ThreatNarrativeInput, provider: AiProvider): Promise<string> {
  const system =
    input.lang === 'id'
      ? 'Anda analis threat intelligence senior. Tulis narasi analisis risiko 3-5 kalimat dalam Bahasa Indonesia: jelaskan pendorong utama skor risiko dan rekomendasi prioritas. Faktual, tanpa markdown. Jangan gunakan tanda em dash (karakter "—"); pakai tanda hubung, koma, atau kalimat terpisah.'
      : 'You are a senior threat-intelligence analyst. Write a 3-5 sentence risk-analysis narrative: explain the main drivers of the risk score and the priority recommendation. Factual, no markdown. Do not use em dashes (the "—" character); use hyphens, commas, or separate sentences instead.';
  const prompt = [
    `Project: ${input.project}`,
    `Unified risk score: ${input.riskScore}/100 (${input.riskLevel})`,
    `Threat pulses: ${input.totals.pulses}, malware references: ${input.totals.malware}, leaked credentials: ${input.totals.leaks}`,
    input.components
      ? `Risk components: ${Object.entries(input.components)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k}=${Math.round(v)}`)
          .join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  return stripEmDash((await provider.generate(system, prompt)).trim());
}
