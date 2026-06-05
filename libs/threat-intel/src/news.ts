type FetchLike = typeof fetch;

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  summary: string;
  publishedAt: Date | null;
}

/** Sector → relevance keywords (lowercased substring match on title+summary). 'general' = no filter. */
export const SECTORS: Record<string, string[]> = {
  banking: [
    'bank',
    'banking',
    'financial',
    'finance',
    'fintech',
    'swift',
    'payment',
    'atm',
    'card',
    'fraud',
    'credential',
    'phishing',
    'wire transfer',
    'ojk',
  ],
  healthcare: ['hospital', 'health', 'healthcare', 'medical', 'patient', 'ehr', 'pharma', 'clinic'],
  government: [
    'government',
    'govt',
    'public sector',
    'election',
    'municipal',
    'federal',
    'espionage',
    'state-sponsored',
  ],
  energy: ['energy', 'power grid', 'grid', 'scada', 'ics', 'ot security', 'utility', 'oil', 'gas', 'nuclear'],
  technology: ['saas', 'cloud', 'software supply chain', 'zero-day', 'zero day', 'npm', 'github', 'api key', 'devops'],
  retail: ['retail', 'e-commerce', 'ecommerce', 'point of sale', 'pos malware', 'magecart', 'skimmer', 'checkout'],
  general: [],
};

export type SectorName = keyof typeof SECTORS;

export function isSector(s: unknown): s is SectorName {
  return typeof s === 'string' && s in SECTORS;
}

/** Curated, key-less security-news feeds (RSS 2.0 + Atom). */
export const FEEDS: { url: string; source: string }[] = [
  { url: 'https://feeds.feedburner.com/TheHackersNews', source: 'The Hacker News' },
  { url: 'https://www.bleepingcomputer.com/feed/', source: 'BleepingComputer' },
  { url: 'https://krebsonsecurity.com/feed/', source: 'KrebsOnSecurity' },
  { url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', source: 'CISA' },
  { url: 'https://www.securityweek.com/feed/', source: 'SecurityWeek' },
];

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]!) : '';
}

/** Parse an RSS 2.0 (`<item>`) or Atom (`<entry>`) feed into items (pure — no network). */
export function parseFeed(xml: string, source: string): NewsItem[] {
  const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s\S]*?<\/entry>/gi : /<item[\s\S]*?<\/item>/gi) ?? [];
  const items: NewsItem[] = [];
  for (const b of blocks) {
    const title = tag(b, 'title');
    // Atom: <link href="…"/>; RSS: <link>…</link>.
    let link = tag(b, 'link');
    if (!link) link = b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '';
    const dateStr = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated');
    const summary = tag(b, 'description') || tag(b, 'summary') || tag(b, 'content');
    if (!title || !link) continue;
    const d = dateStr ? new Date(dateStr) : null;
    items.push({
      title,
      link,
      source,
      summary: summary.slice(0, 400),
      publishedAt: d && !isNaN(d.getTime()) ? d : null,
    });
  }
  return items;
}

/** Does an item match the sector's keywords? `general` matches everything. */
export function matchesSector(item: NewsItem, sector: string): boolean {
  const kws = SECTORS[sector] ?? [];
  if (!kws.length) return true;
  const hay = `${item.title} ${item.summary}`.toLowerCase();
  return kws.some((k) => hay.includes(k));
}

export interface FetchNewsOptions {
  feeds?: { url: string; source: string }[];
  fetchImpl?: FetchLike;
  limit?: number;
  timeoutMs?: number;
}

/** Aggregate the feeds, filter by sector, dedupe by link, newest first. Degrades per-feed on error. */
export async function fetchSectorNews(sector: string, opts: FetchNewsOptions = {}): Promise<NewsItem[]> {
  const { feeds = FEEDS, fetchImpl = fetch, limit = 30, timeoutMs = 8000 } = opts;
  const all: NewsItem[] = [];
  for (const feed of feeds) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetchImpl(feed.url, { signal: ctrl.signal, headers: { 'user-agent': 'vacti-threatnews/1.0' } });
      clearTimeout(t);
      if (!res.ok) continue;
      all.push(...parseFeed(await res.text(), feed.source).filter((i) => matchesSector(i, sector)));
    } catch {
      // Skip an unreachable/slow feed — never throw.
    }
  }
  const seen = new Set<string>();
  return all
    .filter((i) => (seen.has(i.link) ? false : (seen.add(i.link), true)))
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, limit);
}
