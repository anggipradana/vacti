import { mapNucleiSeverity } from '../severity';
import type { SeverityValue } from '@vacti/core';

export interface VulnResult {
  templateId: string;
  name: string;
  severity: SeverityValue;
  type?: string;
  host?: string;
  port?: string;
  scheme?: string;
  url?: string;
  matchedAt?: string;
  tags: string[];
  request?: string;
  response?: string;
  /** From the nuclei template's info block (not AI). */
  description?: string;
  remediation?: string;
  cvss?: number;
  cveIds: string[];
  references: string[];
}

export interface NucleiOptions {
  /** e.g. ['critical','high','medium','low'] */
  severities?: string[];
  /** tag filter, e.g. ['wordpress'] for the conditional WordPress pass */
  tags?: string[];
  /** explicit template paths */
  templates?: string[];
  /** custom request headers (per target) */
  headers?: Record<string, string>;
}

export function nucleiArgs(opts: NucleiOptions = {}): string[] {
  const args = ['-jsonl', '-silent', '-no-interactsh', '-no-color'];
  if (opts.severities?.length) args.push('-severity', opts.severities.join(','));
  if (opts.tags?.length) args.push('-tags', opts.tags.join(','));
  for (const t of opts.templates ?? []) args.push('-t', t);
  for (const [k, v] of Object.entries(opts.headers ?? {})) args.push('-H', `${k}: ${v}`);
  return args;
}

interface NucleiRaw {
  'template-id'?: string;
  info?: {
    name?: string;
    severity?: string;
    tags?: string[];
    description?: string;
    remediation?: string;
    reference?: string[] | string;
    classification?: {
      'cvss-metrics'?: string;
      'cvss-score'?: number | string;
      'cve-id'?: string[] | string;
      'cwe-id'?: string[] | string;
    };
  };
  type?: string;
  host?: string;
  port?: string;
  scheme?: string;
  url?: string;
  'matched-at'?: string;
  request?: string;
  response?: string;
}

/** Normalise a nuclei field that may be a string, array, or absent into a string[]. */
function toList(v: string[] | string | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => String(x).trim()).filter(Boolean);
}

export function parseNucleiLine(line: string): VulnResult | null {
  try {
    const j = JSON.parse(line) as NucleiRaw;
    const id = j['template-id'];
    if (!id) return null;
    const cls = j.info?.classification;
    const rawScore = cls?.['cvss-score'];
    const cvss = rawScore != null && rawScore !== '' ? Number(rawScore) : undefined;
    return {
      templateId: id,
      name: j.info?.name ?? id,
      severity: mapNucleiSeverity(j.info?.severity),
      type: j.type,
      host: j.host,
      port: j.port,
      scheme: j.scheme,
      url: j.url,
      matchedAt: j['matched-at'],
      tags: j.info?.tags ?? [],
      request: j.request,
      response: j.response,
      description: j.info?.description?.trim() || undefined,
      remediation: j.info?.remediation?.trim() || undefined,
      cvss: cvss != null && Number.isFinite(cvss) ? cvss : undefined,
      cveIds: toList(cls?.['cve-id']),
      references: toList(j.info?.reference),
    };
  } catch {
    return null;
  }
}
