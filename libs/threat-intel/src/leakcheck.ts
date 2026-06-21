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
const QUERY_LIMIT = 1000;

export interface LeakResult {
  records: LeakRecord[];
  /** Highest `found` total LeakCheck reported across the two queries (real breach count for the domain). */
  found: number;
  /** A query hit the per-request limit, so more credentials exist than were returned (silent-cap signal). */
  truncated: boolean;
}

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
 * (identifier + password + origin) is kept as its own record. Also reports LeakCheck's `found`
 * total and whether the per-query 1000-row limit was hit (so the UI can flag truncation instead of
 * silently showing a capped number). Returns an empty result without an API key.
 */
export async function fetchLeaks(
  domain: string,
  opts: { apiKey?: string; fetchImpl?: FetchLike } = {},
): Promise<LeakResult> {
  const { apiKey, fetchImpl = fetch } = opts;
  if (!apiKey) return { records: [], found: 0, truncated: false };
  const query = async (type: 'domain' | 'origin'): Promise<{ records: LeakRecord[]; found: number }> => {
    try {
      const res = await fetchImpl(`${BASE}/${encodeURIComponent(domain)}?type=${type}&limit=${QUERY_LIMIT}`, {
        headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
      });
      if (!res.ok) return { records: [], found: 0 };
      const body = (await res.json()) as { result?: LeakRaw[]; found?: number };
      const records = (body.result ?? []).map((r) => {
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
        } as LeakRecord;
      });
      // `found` is LeakCheck's reported total; fall back to the returned row count when absent.
      return { records, found: Math.max(Number(body.found ?? 0), records.length) };
    } catch {
      return { records: [], found: 0 };
    }
  };
  const [byDomain, byOrigin] = await Promise.all([query('domain'), query('origin')]);
  const seen = new Set<string>();
  const records = [...byDomain.records, ...byOrigin.records].filter((r) =>
    seen.has(r.hashMd5) ? false : (seen.add(r.hashMd5), true),
  );
  const found = Math.max(byDomain.found, byOrigin.found);
  const truncated = byDomain.records.length >= QUERY_LIMIT || byOrigin.records.length >= QUERY_LIMIT;
  return { records, found, truncated };
}

const PUBLIC_BASE = 'https://leakcheck.io/api/public';

/** Free-form LeakCheck query types (the public API auto-detects when `type` is omitted/`auto`). */
export type LeakSearchType = 'auto' | 'email' | 'domain' | 'username' | 'phone' | 'hash' | 'keyword';

/**
 * Free-form leak search against the LeakCheck public API
 * (`https://leakcheck.io/api/public?key=<key>&check=<query>&type=<type>`). Unlike `fetchLeaks` (which
 * is domain-scoped and walks the v2 domain/origin indexes), this runs a single arbitrary query and
 * `type` defaults to `auto` so LeakCheck detects whether the input is an email/username/phone/etc.
 * Returns the same normalized `LeakRecord` rows as `fetchLeaks`. Returns an empty result without a key.
 */
export async function searchLeaks(
  query: string,
  opts: { key?: string; type?: LeakSearchType; fetchImpl?: FetchLike } = {},
): Promise<LeakResult> {
  const { key, type = 'auto', fetchImpl = fetch } = opts;
  const q = query.trim();
  if (!key || !q) return { records: [], found: 0, truncated: false };
  try {
    const url = `${PUBLIC_BASE}?key=${encodeURIComponent(key)}&check=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`;
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return { records: [], found: 0, truncated: false };
    const body = (await res.json()) as { success?: boolean; found?: number; result?: LeakRaw[] };
    if (body.success === false) return { records: [], found: 0, truncated: false };
    const seen = new Set<string>();
    const records = (body.result ?? [])
      .map((r) => {
        const source = r.source?.name ?? 'unknown';
        const identifier = r.email ?? r.username ?? r.line ?? '';
        const password = r.password || undefined;
        const origin = (r.origin ?? []).join(', ') || undefined;
        return {
          source,
          identifier,
          // Free-form results are not tied to the domain/origin index split; tag them as `domain`
          // (the LeakRecord union only allows domain|origin) so the shape stays compatible.
          type: 'domain',
          password,
          origin,
          hashMd5: md5(`${source}:${identifier}:${password ?? ''}:${origin ?? ''}`),
        } as LeakRecord;
      })
      .filter((r) => (seen.has(r.hashMd5) ? false : (seen.add(r.hashMd5), true)));
    const found = Math.max(Number(body.found ?? 0), records.length);
    return { records, found, truncated: records.length >= QUERY_LIMIT };
  } catch {
    return { records: [], found: 0, truncated: false };
  }
}

export function md5(input: string): string {
  return createHash('md5').update(input).digest('hex');
}
