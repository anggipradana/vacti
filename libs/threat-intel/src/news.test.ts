import { describe, it, expect } from 'vitest';
import { parseFeed, matchesSector, fetchSectorNews } from './news';

const RSS = `<?xml version="1.0"?><rss><channel>
  <item><title>Major bank hit by phishing fraud</title><link>https://x/1</link>
    <pubDate>Wed, 04 Jun 2026 10:00:00 GMT</pubDate><description><![CDATA[A <b>bank</b> lost funds to wire transfer fraud.]]></description></item>
  <item><title>New gardening tips for spring</title><link>https://x/2</link>
    <pubDate>Wed, 04 Jun 2026 09:00:00 GMT</pubDate><description>Unrelated lifestyle content.</description></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>CISA advisory on ICS SCADA</title><link href="https://c/1"/>
    <updated>2026-06-04T08:00:00Z</updated><summary>Energy grid SCADA vulnerability.</summary></entry>
</feed>`;

describe('news parseFeed', () => {
  it('parses RSS items (title/link/date/summary, strips html/cdata)', () => {
    const items = parseFeed(RSS, 'Test');
    expect(items).toHaveLength(2);
    expect(items[0]!.title).toContain('bank');
    expect(items[0]!.link).toBe('https://x/1');
    expect(items[0]!.summary).not.toContain('<b>');
    expect(items[0]!.publishedAt).toBeInstanceOf(Date);
  });
  it('parses Atom entries with href links', () => {
    const items = parseFeed(ATOM, 'CISA');
    expect(items).toHaveLength(1);
    expect(items[0]!.link).toBe('https://c/1');
  });
});

describe('matchesSector', () => {
  const items = parseFeed(RSS, 'Test');
  it('keeps sector-relevant items, drops the rest', () => {
    expect(matchesSector(items[0]!, 'banking')).toBe(true);
    expect(matchesSector(items[1]!, 'banking')).toBe(false);
  });
  it('general matches everything', () => {
    expect(matchesSector(items[1]!, 'general')).toBe(true);
  });
});

describe('fetchSectorNews', () => {
  it('aggregates + filters + dedupes + degrades on a bad feed', async () => {
    const feeds = [
      { url: 'ok', source: 'A' },
      { url: 'bad', source: 'B' },
      { url: 'dup', source: 'C' },
    ];
    const fetchImpl = (async (url: string) => {
      if (url === 'bad') throw new Error('network');
      return { ok: true, text: async () => RSS } as Response;
    }) as typeof fetch;
    const news = await fetchSectorNews('banking', { feeds, fetchImpl });
    // Both 'ok' and 'dup' return the same banking item (link https://x/1) → deduped to 1.
    expect(news).toHaveLength(1);
    expect(news[0]!.link).toBe('https://x/1');
  });
});
