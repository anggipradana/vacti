import { createHash } from 'node:crypto';

export interface AiProvider {
  generate(system: string, prompt: string): Promise<string>;
}

export interface AiConfig {
  provider: 'anthropic' | 'openai' | 'ollama';
  model: string;
  anthropicKey?: string;
  openaiKey?: string;
  ollamaBaseUrl?: string;
  /**
   * Optional override endpoint for Anthropic/OpenAI-compatible APIs (a local proxy or gateway).
   * Blank → the SDK's default vendor cloud endpoint. Does not apply to Ollama (use ollamaBaseUrl).
   */
  baseUrl?: string;
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
