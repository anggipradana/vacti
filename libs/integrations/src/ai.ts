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
  kimi: 'kimi-latest',
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
  // Kimi (Moonshot) general models: keep an explicit moonshot/kimi model, else default to kimi-latest
  // (drop a leftover 'kimi-for-coding', which is the coding-agent-only model).
  if (provider === 'kimi') return /^(kimi-latest|kimi-k2|moonshot-)/i.test(m) ? m : 'kimi-latest';
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

// ── Pentest finding reporting (bilingual description / business impact / remediation + references) ──

export interface PentestEnrichmentInput {
  title: string;
  findingClass: string;
  severity?: string | null;
  affectedUrl?: string | null;
  evidenceSummary?: string | null;
}

export interface PentestEnrichment {
  descriptionEn: string;
  descriptionId: string;
  businessImpactEn: string;
  businessImpactId: string;
  remediationEn: string;
  remediationId: string;
}

const PENTEST_SYSTEM = `You are a senior penetration tester writing the formal report entry for a CONFIRMED, exploited web vulnerability. Write accurate, specific, professional prose (no markdown bullets, no em dashes; use hyphens). Produce SIX sections, each introduced by its exact delimiter line on its own line:
== DESCRIPTION_EN ==
== IMPACT_EN ==
== REMEDIATION_EN ==
== DESCRIPTION_ID ==
== IMPACT_ID ==
== REMEDIATION_ID ==
DESCRIPTION = what the vulnerability is and how it was exploited here. IMPACT = the concrete business/security consequence. REMEDIATION = specific, actionable fixes. The _ID sections are natural Bahasa Indonesia translations (not word-for-word). Each section 2-5 sentences.`;

export function buildPentestPrompt(v: PentestEnrichmentInput): string {
  return [
    `Finding: ${v.title}`,
    `Class: ${v.findingClass}`,
    v.severity ? `Severity: ${v.severity}` : '',
    v.affectedUrl ? `Affected: ${v.affectedUrl}` : '',
    v.evidenceSummary ? `Evidence captured: ${v.evidenceSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function parsePentestEnrichment(text: string): PentestEnrichment {
  const grab = (label: string): string => {
    const re = new RegExp(`==\\s*${label}\\s*==\\s*([\\s\\S]*?)(?=\\n==\\s*[A-Z_]+\\s*==|$)`, 'i');
    return (text.match(re)?.[1] ?? '').trim();
  };
  return {
    descriptionEn: grab('DESCRIPTION_EN'),
    businessImpactEn: grab('IMPACT_EN'),
    remediationEn: grab('REMEDIATION_EN'),
    descriptionId: grab('DESCRIPTION_ID'),
    businessImpactId: grab('IMPACT_ID'),
    remediationId: grab('REMEDIATION_ID'),
  };
}

export async function enrichPentestFinding(
  v: PentestEnrichmentInput,
  provider: AiProvider,
): Promise<PentestEnrichment> {
  return parsePentestEnrichment(stripEmDash(await provider.generate(PENTEST_SYSTEM, buildPentestPrompt(v))));
}

/**
 * Authoritative references per vulnerability class (OWASP / CWE / PortSwigger). Curated, not AI-generated,
 * so the URLs are real and stable (no hallucinated links). Matched loosely on the finding-class name; an
 * unmatched class still gets the OWASP WSTG + Top 10 baseline. This is the "web reference" set per finding.
 */
export function pentestReferences(findingClass: string): { title: string; url: string }[] {
  const c = (findingClass ?? '').toLowerCase();
  const R = (title: string, url: string) => ({ title, url });
  const owaspTop10 = R('OWASP Top 10', 'https://owasp.org/www-project-top-ten/');
  const wstg = R('OWASP Web Security Testing Guide', 'https://owasp.org/www-project-web-security-testing-guide/');
  const map: { match: string[]; refs: { title: string; url: string }[] }[] = [
    {
      match: ['sql', 'nosql'],
      refs: [
        R('OWASP SQL Injection', 'https://owasp.org/www-community/attacks/SQL_Injection'),
        R('CWE-89: SQL Injection', 'https://cwe.mitre.org/data/definitions/89.html'),
        R('PortSwigger: SQL injection', 'https://portswigger.net/web-security/sql-injection'),
      ],
    },
    {
      match: ['xss', 'cross-site scripting'],
      refs: [
        R('OWASP XSS', 'https://owasp.org/www-community/attacks/xss/'),
        R('CWE-79: XSS', 'https://cwe.mitre.org/data/definitions/79.html'),
        R('PortSwigger: Cross-site scripting', 'https://portswigger.net/web-security/cross-site-scripting'),
      ],
    },
    {
      match: ['idor', 'broken access', 'bola', 'bac'],
      refs: [
        R('OWASP Broken Access Control', 'https://owasp.org/Top10/A01_2021-Broken_Access_Control/'),
        R('CWE-639: Authorization Bypass', 'https://cwe.mitre.org/data/definitions/639.html'),
        R('PortSwigger: Access control / IDOR', 'https://portswigger.net/web-security/access-control/idor'),
      ],
    },
    {
      match: ['command', 'rce', 'exec'],
      refs: [
        R('OWASP Command Injection', 'https://owasp.org/www-community/attacks/Command_Injection'),
        R('CWE-78: OS Command Injection', 'https://cwe.mitre.org/data/definitions/78.html'),
        R('PortSwigger: OS command injection', 'https://portswigger.net/web-security/os-command-injection'),
      ],
    },
    {
      match: ['upload'],
      refs: [
        R('OWASP Unrestricted File Upload', 'https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload'),
        R('CWE-434: Unrestricted Upload', 'https://cwe.mitre.org/data/definitions/434.html'),
        R('PortSwigger: File upload vulnerabilities', 'https://portswigger.net/web-security/file-upload'),
      ],
    },
    {
      match: ['inclusion', 'lfi', 'rfi', 'traversal', 'path'],
      refs: [
        R('OWASP Path Traversal', 'https://owasp.org/www-community/attacks/Path_Traversal'),
        R('CWE-98: PHP File Inclusion', 'https://cwe.mitre.org/data/definitions/98.html'),
        R('PortSwigger: File path traversal', 'https://portswigger.net/web-security/file-path-traversal'),
      ],
    },
    {
      match: ['ssrf'],
      refs: [
        R('OWASP SSRF', 'https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/'),
        R('CWE-918: SSRF', 'https://cwe.mitre.org/data/definitions/918.html'),
        R('PortSwigger: SSRF', 'https://portswigger.net/web-security/ssrf'),
      ],
    },
    {
      match: ['xxe'],
      refs: [
        R('OWASP XXE', 'https://owasp.org/www-community/vulnerabilities/XML_External_Entity_(XXE)_Processing'),
        R('CWE-611: XXE', 'https://cwe.mitre.org/data/definitions/611.html'),
        R('PortSwigger: XXE injection', 'https://portswigger.net/web-security/xxe'),
      ],
    },
    {
      match: ['ssti', 'template'],
      refs: [
        R('CWE-1336: Template Injection', 'https://cwe.mitre.org/data/definitions/1336.html'),
        R('PortSwigger: SSTI', 'https://portswigger.net/web-security/server-side-template-injection'),
      ],
    },
    {
      match: ['csrf'],
      refs: [
        R('OWASP CSRF', 'https://owasp.org/www-community/attacks/csrf'),
        R('CWE-352: CSRF', 'https://cwe.mitre.org/data/definitions/352.html'),
        R('PortSwigger: CSRF', 'https://portswigger.net/web-security/csrf'),
      ],
    },
    {
      match: ['cors'],
      refs: [
        R('CWE-942: Permissive CORS', 'https://cwe.mitre.org/data/definitions/942.html'),
        R('PortSwigger: CORS', 'https://portswigger.net/web-security/cors'),
      ],
    },
    {
      match: ['redirect'],
      refs: [
        R(
          'OWASP Unvalidated Redirects',
          'https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html',
        ),
        R('CWE-601: Open Redirect', 'https://cwe.mitre.org/data/definitions/601.html'),
      ],
    },
    {
      match: ['jwt'],
      refs: [
        R('PortSwigger: JWT attacks', 'https://portswigger.net/web-security/jwt'),
        R('CWE-347: Improper Signature Verification', 'https://cwe.mitre.org/data/definitions/347.html'),
      ],
    },
    {
      match: ['oauth', 'saml', 'auth-bypass', 'authentication'],
      refs: [
        R(
          'OWASP Authentication Cheat Sheet',
          'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html',
        ),
        R('CWE-287: Improper Authentication', 'https://cwe.mitre.org/data/definitions/287.html'),
        R('PortSwigger: Authentication', 'https://portswigger.net/web-security/authentication'),
      ],
    },
    {
      match: ['default-cred', 'weak', 'brute'],
      refs: [
        R('CWE-1392: Use of Default Credentials', 'https://cwe.mitre.org/data/definitions/1392.html'),
        R('OWASP Credential Stuffing', 'https://owasp.org/www-community/attacks/Credential_stuffing'),
      ],
    },
    {
      match: ['deserial'],
      refs: [
        R('OWASP Deserialization', 'https://owasp.org/www-community/vulnerabilities/Deserialization_of_untrusted_data'),
        R('CWE-502: Deserialization', 'https://cwe.mitre.org/data/definitions/502.html'),
        R('PortSwigger: Insecure deserialization', 'https://portswigger.net/web-security/deserialization'),
      ],
    },
    {
      match: ['prototype'],
      refs: [
        R('PortSwigger: Prototype pollution', 'https://portswigger.net/web-security/prototype-pollution'),
        R('CWE-1321: Prototype Pollution', 'https://cwe.mitre.org/data/definitions/1321.html'),
      ],
    },
    {
      match: ['race'],
      refs: [
        R('PortSwigger: Race conditions', 'https://portswigger.net/web-security/race-conditions'),
        R('CWE-362: Race Condition', 'https://cwe.mitre.org/data/definitions/362.html'),
      ],
    },
    {
      match: ['smuggl'],
      refs: [
        R('PortSwigger: Request smuggling', 'https://portswigger.net/web-security/request-smuggling'),
        R('CWE-444: HTTP Request Smuggling', 'https://cwe.mitre.org/data/definitions/444.html'),
      ],
    },
    {
      match: ['host-header', 'host header'],
      refs: [
        R('PortSwigger: Host header attacks', 'https://portswigger.net/web-security/host-header'),
        R('CWE-644: Host Header Injection', 'https://cwe.mitre.org/data/definitions/644.html'),
      ],
    },
    {
      match: ['mass-assign', 'mass assign'],
      refs: [
        R(
          'OWASP Mass Assignment Cheat Sheet',
          'https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html',
        ),
        R('CWE-915: Mass Assignment', 'https://cwe.mitre.org/data/definitions/915.html'),
      ],
    },
    {
      match: ['graphql'],
      refs: [
        R('OWASP GraphQL Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html'),
        R('PortSwigger: GraphQL API vulnerabilities', 'https://portswigger.net/web-security/graphql'),
      ],
    },
    {
      match: ['cache'],
      refs: [
        R('PortSwigger: Web cache poisoning', 'https://portswigger.net/web-security/web-cache-poisoning'),
        R('CWE-525: Web Cache Poisoning', 'https://cwe.mitre.org/data/definitions/525.html'),
      ],
    },
    {
      match: ['business', 'logic'],
      refs: [
        R(
          'OWASP Business Logic Testing',
          'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/',
        ),
        R('PortSwigger: Business logic vulnerabilities', 'https://portswigger.net/web-security/logic-flaws'),
      ],
    },
    {
      match: ['header', 'security-header'],
      refs: [
        R('OWASP Secure Headers Project', 'https://owasp.org/www-project-secure-headers/'),
        R('MDN: HTTP security headers', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers'),
      ],
    },
    {
      match: ['clickjack'],
      refs: [
        R('OWASP Clickjacking', 'https://owasp.org/www-community/attacks/Clickjacking'),
        R('CWE-1021: UI Redress', 'https://cwe.mitre.org/data/definitions/1021.html'),
      ],
    },
    {
      match: ['tls', 'ssl'],
      refs: [
        R(
          'OWASP TLS Cheat Sheet',
          'https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html',
        ),
      ],
    },
  ];
  const hit = map.find((m) => m.match.some((k) => c.includes(k)));
  return [...(hit?.refs ?? []), owaspTop10, wstg];
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
      // Kimi (Moonshot) general API - OpenAI-compatible, reuse the OpenAI SDK. NOTE: the Kimi Code API
      // (kimi.com/code, kimi-for-coding) is restricted to coding-agent CLIs and refuses general
      // chat/enrichment calls, so enrichment uses the Moonshot platform endpoint instead.
      const [{ generateText }, { createOpenAI }] = await Promise.all([import('ai'), import('@ai-sdk/openai')]);
      const kimi = createOpenAI({
        apiKey: cfg.kimiKey,
        baseURL: baseURL ?? 'https://api.moonshot.ai/v1',
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

// ---- Brand-monitoring sentiment (per headline) ----

export type BrandSentiment = 'positive' | 'negative' | 'neutral';
export type BrandRelevance = 'relevant' | 'irrelevant';
export interface BrandSentimentResult {
  sentiment: BrandSentiment;
  /** Whether the headline is actually about THIS brand/company (vs a coincidental name match). */
  relevance: BrandRelevance;
  reason: string;
}

/**
 * Classify a brand-monitoring headline along two axes TOWARD THE BRAND: (1) sentiment - negative
 * (breach/lawsuit/outage), positive (award/partnership/growth), neutral (routine); (2) relevance -
 * whether it is genuinely about this company vs a coincidental name match / generic industry news.
 * Returns a one-line reason. Falls back to neutral/relevant on an unparseable reply.
 */
export async function generateBrandSentiment(
  input: { brand: string; title: string; summary?: string | null; lang?: 'en' | 'id' },
  provider: AiProvider,
): Promise<BrandSentimentResult> {
  const system =
    input.lang === 'id'
      ? 'Anda analis pemantauan reputasi merek. Nilai sebuah berita pada DUA sumbu TERHADAP MEREK ini: (1) SENTIMENT: negative (kabar buruk: kebocoran data, gugatan, gangguan, penipuan, skandal), positive (kabar baik: penghargaan, kemitraan, pertumbuhan), neutral (liputan rutin/tidak berdampak); (2) RELEVANCE: relevant (memang tentang perusahaan ini) atau irrelevant (kebetulan nama mirip / berita industri umum yang tidak menyangkut perusahaan ini). Balas TEPAT satu baris: "SENTIMENT | RELEVANCE | alasan singkat". Tanpa markdown, tanpa tanda em dash.'
      : 'You are a brand reputation-monitoring analyst. Judge a headline on TWO axes TOWARD THIS BRAND: (1) SENTIMENT: negative (breach, lawsuit, outage, fraud, scandal), positive (award, partnership, growth), neutral (routine/no-impact); (2) RELEVANCE: relevant (genuinely about this company) or irrelevant (coincidental name match / generic industry news not about this company). Reply EXACTLY one line: "SENTIMENT | RELEVANCE | short reason". No markdown, no em dashes.';
  const prompt = [`Brand: ${input.brand}`, `Headline: ${input.title}`, input.summary ? `Summary: ${input.summary}` : '']
    .filter(Boolean)
    .join('\n');
  const raw = stripEmDash((await provider.generate(system, prompt)).trim());
  const parts = raw.split('|');
  const sentToken = (parts[0] ?? '').toLowerCase();
  const relToken = (parts[1] ?? '').toLowerCase();
  const sentiment: BrandSentiment = sentToken.includes('negative')
    ? 'negative'
    : sentToken.includes('positive')
      ? 'positive'
      : 'neutral';
  // Default to relevant unless the model clearly says irrelevant (avoid hiding real hits).
  const relevance: BrandRelevance = relToken.includes('irrelevant') ? 'irrelevant' : 'relevant';
  const reason = (parts.slice(2).join('|').trim() || parts.slice(1).join('|').trim() || raw).slice(0, 280);
  return { sentiment, relevance, reason };
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
