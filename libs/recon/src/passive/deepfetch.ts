import { assertUrlSafeForServerFetch } from './ssrf';
import type { FetchLike } from './wayback';

export interface DeepFetchResult {
  /** HTTP status, 0 when blocked by the SSRF guard, 598 on timeout/network error. */
  status: number;
  body: string;
  length: number;
  blocked: boolean;
}

const UA = 'vacti-deep-fetch/1.0';

/**
 * Fetch a discovered URL's body for exposure analysis. MUST pass the SSRF guard first (blocks
 * localhost/metadata/private+reserved IPs). Body is size-capped; oversized responses are skipped by
 * Content-Length. Never throws — returns a structured result the caller records.
 */
export async function deepFetch(
  url: string,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number; maxBytes?: number } = {},
): Promise<DeepFetchResult> {
  const { fetchImpl = fetch, timeoutMs = 15_000, maxBytes = 512 * 1024 } = opts;
  try {
    assertUrlSafeForServerFetch(url);
  } catch {
    return { status: 0, body: '', length: 0, blocked: true };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': UA } });
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared && declared > maxBytes * 4) return { status: res.status, body: '', length: declared, blocked: false };
    const full = await res.text();
    return { status: res.status, body: full.slice(0, maxBytes), length: full.length, blocked: false };
  } catch {
    return { status: 598, body: '', length: 0, blocked: false };
  } finally {
    clearTimeout(timer);
  }
}
