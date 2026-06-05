import { createHash } from 'node:crypto';
import type { FetchLike } from './otx';

export interface LeakRecord {
  source: string;
  identifier: string;
  type: 'domain' | 'origin';
  hashMd5: string;
  /** Plaintext leaked password when the source exposes one (LeakCheck returns it for stealer logs). */
  password?: string;
  /** Where the credential was captured (stealer-log origin hosts). */
  origin?: string;
}

const BASE = 'https://leakcheck.io/api/v2/query';

interface LeakRaw {
  source?: { name?: string };
  email?: string;
  username?: string;
  line?: string;
  password?: string;
  origin?: string[];
}

/**
 * Look up leaked credentials for a domain. Queries both the `domain` and `origin` indexes (deduped
 * across the two) so stealer-log hits keyed by origin are also captured. Each distinct credential
 * (identifier + password + origin) is kept as its own record. Returns [] without an API key.
 */
export async function fetchLeaks(
  domain: string,
  opts: { apiKey?: string; fetchImpl?: FetchLike } = {},
): Promise<LeakRecord[]> {
  const { apiKey, fetchImpl = fetch } = opts;
  if (!apiKey) return [];
  const query = async (type: 'domain' | 'origin'): Promise<LeakRecord[]> => {
    try {
      const res = await fetchImpl(`${BASE}/${encodeURIComponent(domain)}?type=${type}&limit=1000`, {
        headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const body = (await res.json()) as { result?: LeakRaw[] };
      return (body.result ?? []).map((r) => {
        const source = r.source?.name ?? 'unknown';
        const identifier = r.email ?? r.username ?? r.line ?? '';
        const password = r.password || undefined;
        const origin = (r.origin ?? []).join(', ') || undefined;
        // Hash over identifier+password+origin so distinct stolen creds (same email, different
        // password/origin) are kept as separate rows, while exact re-fetches stay idempotent.
        return {
          source,
          identifier,
          type,
          password,
          origin,
          hashMd5: md5(`${source}:${identifier}:${password ?? ''}:${origin ?? ''}`),
        };
      });
    } catch {
      return [];
    }
  };
  const [byDomain, byOrigin] = await Promise.all([query('domain'), query('origin')]);
  const seen = new Set<string>();
  return [...byDomain, ...byOrigin].filter((r) => (seen.has(r.hashMd5) ? false : (seen.add(r.hashMd5), true)));
}

export function md5(input: string): string {
  return createHash('md5').update(input).digest('hex');
}
