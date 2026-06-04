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
}

export interface NucleiOptions {
  /** e.g. ['critical','high','medium','low'] */
  severities?: string[];
  /** tag filter, e.g. ['wordpress'] for the conditional WordPress pass */
  tags?: string[];
  /** explicit template paths */
  templates?: string[];
}

export function nucleiArgs(opts: NucleiOptions = {}): string[] {
  const args = ['-jsonl', '-silent', '-no-interactsh', '-no-color'];
  if (opts.severities?.length) args.push('-severity', opts.severities.join(','));
  if (opts.tags?.length) args.push('-tags', opts.tags.join(','));
  for (const t of opts.templates ?? []) args.push('-t', t);
  return args;
}

interface NucleiRaw {
  'template-id'?: string;
  info?: { name?: string; severity?: string; tags?: string[] };
  type?: string;
  host?: string;
  port?: string;
  scheme?: string;
  url?: string;
  'matched-at'?: string;
  request?: string;
  response?: string;
}

export function parseNucleiLine(line: string): VulnResult | null {
  try {
    const j = JSON.parse(line) as NucleiRaw;
    const id = j['template-id'];
    if (!id) return null;
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
    };
  } catch {
    return null;
  }
}
