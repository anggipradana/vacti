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
  /**
   * Set when the lookup failed (HTTP error, timeout, or LeakCheck returned `success:false`) so callers
   * can show a real error instead of an empty "no leaks found". Absent on success (incl. genuine 0 rows).
   */
  error?: string;
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

/** Free-form LeakCheck query types (v2 auto-detects when `type` is omitted/`auto`). */
export type LeakSearchType = 'auto' | 'email' | 'domain' | 'username' | 'phone' | 'hash' | 'keyword';

/**
 * Free-form leak search against the LeakCheck API v2 (`GET /api/v2/query/<query>?type=`, `X-API-Key`).
 * Unlike `fetchLeaks` (which is domain-scoped and walks the v2 domain/origin indexes), this runs a
 * single arbitrary query and `type` defaults to `auto` so LeakCheck detects whether the input is an
 * email/username/phone/keyword/etc. Uses the SAME v2 key as `fetchLeaks` (the older public `?key=` API
 * needed a different key). Returns the same normalized `LeakRecord` rows. Empty result without a key.
 */
export async function searchLeaks(
  query: string,
  opts: { key?: string; type?: LeakSearchType; fetchImpl?: FetchLike } = {},
): Promise<LeakResult> {
  const { key, type = 'auto', fetchImpl = fetch } = opts;
  const q = query.trim();
  if (!key || !q) return { records: [], found: 0, truncated: false };
  // Never block on the network without a bound: abort after 20s so a hung LeakCheck request surfaces a
  // timeout error instead of leaving the page (and its pending overlay) spinning forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    // LeakCheck API v2 (the SAME endpoint + key as fetchLeaks): GET /api/v2/query/<query>?type=&limit=
    // with the `X-API-Key` header. (The old public API `?key=&check=` needs a separate public-API key,
    // which the operator's v2 key is NOT - that mismatch is why the search silently failed.) `auto` is
    // the v2 default, so the param is omitted unless an explicit type is requested.
    const typeParam = type && type !== 'auto' ? `&type=${encodeURIComponent(type)}` : '';
    const url = `${BASE}/${encodeURIComponent(q)}?limit=${QUERY_LIMIT}${typeParam}`;
    const res = await fetchImpl(url, {
      headers: { 'X-API-Key': key, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      // 400 = bad query/type, 401/403 = bad/missing key, 429 = rate limited; bubble a real message up.
      let msg = `LeakCheck request failed (HTTP ${res.status})`;
      try {
        const e = (await res.json()) as { error?: string };
        if (e?.error) msg = `LeakCheck: ${e.error}`;
      } catch {
        /* non-JSON error body */
      }
      return { records: [], found: 0, truncated: false, error: msg };
    }
    const body = (await res.json()) as { success?: boolean; error?: string; found?: number; result?: LeakRaw[] };
    if (body.success === false || body.error) {
      return { records: [], found: 0, truncated: false, error: body.error || 'LeakCheck rejected the query' };
    }
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
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      records: [],
      found: 0,
      truncated: false,
      error: aborted ? 'LeakCheck request timed out' : 'Could not reach LeakCheck',
    };
  } finally {
    clearTimeout(timer);
  }
}

export function md5(input: string): string {
  return createHash('md5').update(input).digest('hex');
}
