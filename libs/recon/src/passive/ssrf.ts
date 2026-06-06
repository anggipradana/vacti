import net from 'node:net';

/**
 * SSRF guard for deep-fetch: only http(s), and never internal/cloud-metadata/private targets.
 * Ported from the SCOPTIX guard (Apache-2.0). Deep-fetch MUST pass this before any outbound request.
 */
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata', 'metadata.google.internal', '169.254.169.254']);

export function assertUrlSafeForServerFetch(rawUrl: string): void {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid URL for deep fetch');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) URLs allowed for deep fetch');
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) throw new Error('Blocked host');
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal'))
    throw new Error('Blocked host suffix');
  if (net.isIPv4(host) && isPrivateOrReservedIpv4(host)) throw new Error('Blocked IPv4');
  if (net.isIPv6(host) && isPrivateOrReservedIpv6(host)) throw new Error('Blocked IPv6');
}

/** Convenience boolean wrapper. */
export function isUrlSafeForServerFetch(rawUrl: string): boolean {
  try {
    assertUrlSafeForServerFetch(rawUrl);
    return true;
  } catch {
    return false;
  }
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((x) => parseInt(x, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
  return false;
}
