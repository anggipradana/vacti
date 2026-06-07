import { describe, it, expect } from 'vitest';
import { scanExposure, EXPOSURE_RULES } from './exposure';
import { pathnameExtension, categorizeUrl, buildSuffixIndex, DEFAULT_CATEGORIES } from './categorize';
import { assertUrlSafeForServerFetch, isUrlSafeForServerFetch } from './ssrf';
import { deepFetch } from './deepfetch';
import { analyzeEndpoints } from './endpoints';
import { fetchWaybackUrls } from './wayback';
import {
  discoverSubdomains,
  harvestResolutions,
  harvestUndetectedUrls,
  hostUnderTarget,
  fetchVtDomainReport,
  type VtDomainReport,
} from './virustotal';

describe('exposure regex', () => {
  it('detects an AWS key and a github token', () => {
    const hits = scanExposure('start AKIAIOSFODNN7EXAMPLE then ghp_' + 'a'.repeat(36) + ' end');
    const types = hits.map((h) => h.type);
    expect(types).toContain('aws-key');
    expect(types).toContain('github-token');
  });

  it('extracts the value (capture group) for credential-like, not the prefix', () => {
    const hits = scanExposure('config: password=Sup3rSecretValue&x=1');
    const cred = hits.find((h) => h.type === 'credential-like');
    expect(cred?.snippet).toBe('Sup3rSecretValue');
  });

  it('claims overlaps by priority (specific wins over generic email)', () => {
    // basic-auth-url (priority 20) overlaps an email-looking host; both rules touch the span.
    const hits = scanExposure('https://user:secretpw@host.example.com/path');
    expect(hits.some((h) => h.type === 'basic-auth-url')).toBe(true);
  });

  it('detects stealer/combo-list credentials', () => {
    const hits = scanExposure('https://site.com/login:victim@mail.com:hunter2pass');
    expect(hits.some((h) => h.type === 'combo-list-cred')).toBe(true);
  });

  it('returns nothing for clean text and is prefilter-fast', () => {
    expect(scanExposure('just an ordinary sentence with no secrets')).toEqual([]);
    expect(scanExposure('')).toEqual([]);
  });

  it('honours a filtered rule set (analyst toggles)', () => {
    const onlyAws = EXPOSURE_RULES.filter((r) => r.type === 'aws-key');
    const hits = scanExposure('AKIAIOSFODNN7EXAMPLE ghp_' + 'b'.repeat(36), onlyAws);
    expect(hits.map((h) => h.type)).toEqual(['aws-key']);
  });
});

describe('url categorization', () => {
  it('extracts pathname extension ignoring query', () => {
    expect(pathnameExtension('https://x.com/a/b/backup.sql?v=1')).toBe('.sql');
    expect(pathnameExtension('https://x.com/no-ext')).toBeNull();
  });

  it('categorises sensitive files', () => {
    const idx = buildSuffixIndex();
    expect(categorizeUrl('https://x.com/db/backup.sql', idx).categorySlug).toBe('db-dumps');
    expect(categorizeUrl('https://x.com/.env', idx).categorySlug).toBe('configs');
    expect(categorizeUrl('https://x.com/id_rsa.pem', idx).categorySlug).toBe('keys');
  });

  it('prefers the longest multi-part suffix (.tar.gz over .gz)', () => {
    const res = categorizeUrl('https://x.com/site-backup.tar.gz');
    expect(res.extension).toBe('.tar.gz');
    expect(res.categorySlug).toBe('backups');
  });

  it('default categories include backups/configs/keys', () => {
    const slugs = DEFAULT_CATEGORIES.map((c) => c.slug);
    expect(slugs).toEqual(expect.arrayContaining(['backups', 'configs', 'keys', 'db-dumps']));
  });
});

describe('ssrf guard', () => {
  it('allows a normal public https URL', () => {
    expect(isUrlSafeForServerFetch('https://example.com/app.js')).toBe(true);
  });
  it('blocks localhost, metadata, private + reserved IPs and non-http', () => {
    expect(isUrlSafeForServerFetch('http://localhost/x')).toBe(false);
    expect(isUrlSafeForServerFetch('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isUrlSafeForServerFetch('http://10.0.0.5/')).toBe(false);
    expect(isUrlSafeForServerFetch('http://192.168.1.1/')).toBe(false);
    expect(isUrlSafeForServerFetch('http://127.0.0.1/')).toBe(false);
    expect(isUrlSafeForServerFetch('ftp://example.com/')).toBe(false);
    expect(isUrlSafeForServerFetch('http://api.internal/')).toBe(false);
    expect(() => assertUrlSafeForServerFetch('not a url')).toThrow();
  });
});

describe('virustotal harvesters', () => {
  const report: VtDomainReport = {
    subdomains: ['www.example.com', 'API.example.com.'],
    domain_siblings: ['sibling.example.com'],
    undetected_urls: [
      ['https://hidden.example.com/app.js', 0, 0, 0, '2026-04-17 02:50:25'],
      'https://other.notexample.com/x',
    ],
    resolutions: [
      { ip_address: '203.0.113.7', last_resolved: '2026-01-02 03:04:05' },
      { ip_address: 'bad', last_resolved: 'nope' },
    ],
  };

  it('discovers subdomains from list + siblings + urls (under target only)', () => {
    const subs = discoverSubdomains(report, 'example.com');
    expect(subs).toEqual(
      expect.arrayContaining(['www.example.com', 'api.example.com', 'sibling.example.com', 'hidden.example.com']),
    );
    expect(subs).not.toContain('other.notexample.com');
  });

  it('parses undetected urls with VT dates', () => {
    const urls = harvestUndetectedUrls(report);
    expect(urls[0]!.url).toBe('https://hidden.example.com/app.js');
    expect(urls[0]!.date?.toISOString()).toBe('2026-04-17T02:50:25.000Z');
  });

  it('parses resolutions and drops malformed rows', () => {
    const res = harvestResolutions(report);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ ipAddress: '203.0.113.7' });
  });

  it('hostUnderTarget matches apex + subdomains only', () => {
    expect(hostUnderTarget('https://a.example.com/x', 'example.com')).toBe('a.example.com');
    expect(hostUnderTarget('https://evil.com/x', 'example.com')).toBeNull();
  });

  it('fetchVtDomainReport returns parsed data via injected fetch', async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ subdomains: ['a.example.com'] }), { status: 200 })) as typeof fetch;
    const r = await fetchVtDomainReport({ apiKey: 'k', domain: 'example.com', fetchImpl: fakeFetch });
    expect(r.status).toBe(200);
    expect(r.data.subdomains).toEqual(['a.example.com']);
  });

  it('fetchVtDomainReport maps network error to 599', async () => {
    const boom = (async () => {
      throw new Error('net down');
    }) as typeof fetch;
    const r = await fetchVtDomainReport({ apiKey: 'k', domain: 'x.com', fetchImpl: boom });
    expect(r.status).toBe(599);
  });
});

describe('endpoint/param discovery', () => {
  it('extracts param frequencies and auth endpoints', () => {
    const r = analyzeEndpoints([
      'https://x.com/search?q=a&page=1',
      'https://x.com/list?page=2',
      'https://x.com/admin/login',
      'https://x.com/blog/post',
    ]);
    expect(r.params[0]).toEqual({ name: 'page', count: 2 }); // most frequent first
    expect(r.params.map((p) => p.name)).toContain('q');
    expect(r.authEndpoints).toContain('https://x.com/admin/login');
    expect(r.authEndpoints).not.toContain('https://x.com/blog/post');
  });

  it('handles junk input safely', () => {
    const r = analyzeEndpoints(['not a url', '']);
    expect(r.paramCount).toBe(0);
    expect(r.authCount).toBe(0);
  });
});

describe('deep-fetch', () => {
  it('blocks SSRF targets before any fetch', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('x', { status: 200 });
    }) as typeof fetch;
    const r = await deepFetch('http://169.254.169.254/latest/meta-data', { fetchImpl: spy });
    expect(r.blocked).toBe(true);
    expect(called).toBe(false);
  });

  it('fetches a public URL body (size-capped) via injected fetch', async () => {
    const fakeFetch = (async () => new Response('AKIAIOSFODNN7EXAMPLE secret body', { status: 200 })) as typeof fetch;
    const r = await deepFetch('https://example.com/app.js', { fetchImpl: fakeFetch, maxBytes: 10 });
    expect(r.blocked).toBe(false);
    expect(r.status).toBe(200);
    expect(r.body.length).toBeLessThanOrEqual(10);
  });
});

describe('wayback client', () => {
  it('parses CDX text lines into URLs via injected fetch', async () => {
    const fakeFetch = (async () =>
      new Response('https://example.com/a\nhttps://example.com/b\n', { status: 200 })) as typeof fetch;
    const urls = await fetchWaybackUrls('example.com', { fetchImpl: fakeFetch });
    expect(urls).toEqual(['https://example.com/a', 'https://example.com/b']);
  });

  it('returns [] on non-ok and respects limit', async () => {
    const ok = (async () => new Response('a\nb\nc\n', { status: 200 })) as typeof fetch;
    expect(await fetchWaybackUrls('x', { fetchImpl: ok, limit: 2 })).toEqual(['a', 'b']);
    const bad = (async () => new Response('', { status: 404 })) as typeof fetch;
    expect(await fetchWaybackUrls('x', { fetchImpl: bad })).toEqual([]);
  });
});
