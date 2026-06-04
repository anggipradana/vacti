import { createHash } from 'node:crypto';
import type { FetchLike } from './otx';

export interface LeakRecord {
  source: string;
  identifier: string;
  type: 'domain' | 'origin';
  hashMd5: string;
}

const BASE = 'https://leakcheck.io/api/v2/query';

/** Look up leaked credentials for a domain. Returns [] when no API key (graceful degrade). */
export async function fetchLeaks(
  domain: string,
  opts: { apiKey?: string; fetchImpl?: FetchLike } = {},
): Promise<LeakRecord[]> {
  const { apiKey, fetchImpl = fetch } = opts;
  if (!apiKey) return [];
  try {
    const res = await fetchImpl(`${BASE}/${encodeURIComponent(domain)}?type=domain`, {
      headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { result?: { source?: { name?: string }; email?: string; line?: string }[] };
    return (body.result ?? []).map((r) => {
      const source = r.source?.name ?? 'unknown';
      const identifier = r.email ?? r.line ?? '';
      return { source, identifier, type: 'domain' as const, hashMd5: md5(`${source}:${identifier}`) };
    });
  } catch {
    return [];
  }
}

export function md5(input: string): string {
  return createHash('md5').update(input).digest('hex');
}
