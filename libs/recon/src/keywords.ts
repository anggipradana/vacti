/** Default "interesting" keywords - endpoints whose host/url/title match are flagged for triage. */
export const INTERESTING_KEYWORDS = [
  'admin',
  'login',
  'ftp',
  'cpanel',
  'webmail',
  'phpmyadmin',
  'dashboard',
  'portal',
  'dev',
  'staging',
  'test',
  'uat',
  'backup',
  'git',
  'jenkins',
  'grafana',
  'kibana',
  'vpn',
  'internal',
  'api',
];

/** Does an endpoint match any interesting keyword (case-insensitive, in url or title)? */
export function isInterestingEndpoint(
  url: string,
  title: string | null | undefined,
  keywords: string[] = INTERESTING_KEYWORDS,
): boolean {
  const hay = `${url} ${title ?? ''}`.toLowerCase();
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}
