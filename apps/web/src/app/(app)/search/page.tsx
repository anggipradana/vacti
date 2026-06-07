import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Search } from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import { Card, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { searchAll } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { q = '' } = await searchParams;
  const { hits } = q.trim() ? await searchAll(getDb(), q) : { hits: [] };

  return (
    <>
      <PageHeader title="Search" description="Find projects, targets, scans, subdomains, endpoints and findings." />
      <Card className="mb-6">
        <CardContent className="pt-5">
          <form method="get" className="flex items-center gap-2">
            <Input name="q" defaultValue={q} placeholder="Search across everything…" autoFocus />
            <Button type="submit">
              <Search className="size-4" /> Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {!q.trim() ? (
        <p className="text-sm text-fg-muted">Type a query above.</p>
      ) : hits.length === 0 ? (
        <EmptyState icon={<Search />} title="No matches" description={`Nothing found for “${q}”.`} />
      ) : (
        <div className="space-y-2">
          {hits.map((h) => (
            <Link key={`${h.kind}-${h.id}`} href={h.href}>
              <Card className="transition-colors hover:border-accent">
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-mono text-sm">{h.label}</span>
                    {h.sublabel ? <span className="ml-2 text-xs text-fg-subtle">{h.sublabel}</span> : null}
                  </div>
                  <Badge variant="neutral">{h.kind}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
