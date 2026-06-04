import type { HttpxResult } from './adapters/httpx';

const WP_URL_PATTERNS = [/wp-content/i, /wp-includes/i, /wp-login\.php/i, /wp-json/i];

/**
 * Layered WordPress detection: httpx tech fingerprint → URL patterns → manual flag.
 * Only hosts flagged here get the conditional nuclei wordfence pass.
 */
export function isWordPress(
  httpx: Pick<HttpxResult, 'tech' | 'url'>,
  opts?: { manual?: boolean; bodyUrls?: string[] },
): boolean {
  if (opts?.manual) return true;
  if (httpx.tech.some((t) => /wordpress/i.test(t))) return true;
  const candidates = [httpx.url, ...(opts?.bodyUrls ?? [])];
  return candidates.some((u) => WP_URL_PATTERNS.some((re) => re.test(u)));
}
