import { Newspaper } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { fetchBrandNews } from '@vacti/threat-intel';

/**
 * Brand monitoring: public news mentioning the project's brand/domain (Google News RSS search,
 * key-less), biased toward security/breach coverage. Streamed via Suspense; degrades to empty.
 */
export async function BrandNews({ brand }: { brand: string }) {
  const [security, general] = await Promise.all([
    fetchBrandNews(brand, { security: true, limit: 10 }),
    fetchBrandNews(brand, { security: false, limit: 10 }),
  ]);
  // Prefer security-relevant hits; backfill with general brand mentions, deduped by link.
  const seen = new Set<string>();
  const items = [...security, ...general]
    .filter((i) => (seen.has(i.link) ? false : (seen.add(i.link), true)))
    .slice(0, 12);

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="size-4 text-accent" /> Brand monitoring · {brand}
        </CardTitle>
        <span className="text-xs text-fg-subtle">public news</span>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="py-2 text-sm text-fg-muted">No recent public news mentioning this brand.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.link} className="py-2">
                <a
                  href={n.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  {n.title}
                </a>
                <div className="mt-0.5 text-xs text-fg-subtle">
                  {n.source}
                  {n.publishedAt ? ` · ${new Date(n.publishedAt).toISOString().slice(0, 10)}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
