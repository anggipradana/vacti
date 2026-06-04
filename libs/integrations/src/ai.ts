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

const SYSTEM = `You are a senior application security engineer. For the given vulnerability finding, write a concise, technically accurate report in EXACTLY three sections with these headings:
Description:
Impact:
Remediation:
Use plain text, no markdown bullets in headings. Be specific and actionable.`;

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
  return parseEnrichment(await provider.generate(SYSTEM, buildVulnPrompt(v)));
}

/** Build a concrete provider via the Vercel AI SDK. Returns null when no key/config (graceful degrade). */
export async function makeProvider(cfg: AiConfig): Promise<AiProvider | null> {
  try {
    if (cfg.provider === 'anthropic') {
      if (!cfg.anthropicKey) return null;
      const [{ generateText }, { createAnthropic }] = await Promise.all([import('ai'), import('@ai-sdk/anthropic')]);
      const anthropic = createAnthropic({ apiKey: cfg.anthropicKey });
      return {
        generate: async (system, prompt) => (await generateText({ model: anthropic(cfg.model), system, prompt })).text,
      };
    }
    if (cfg.provider === 'openai') {
      if (!cfg.openaiKey) return null;
      const [{ generateText }, { createOpenAI }] = await Promise.all([import('ai'), import('@ai-sdk/openai')]);
      const openai = createOpenAI({ apiKey: cfg.openaiKey });
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
