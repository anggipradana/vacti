import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { Crosshair } from 'lucide-react';
import { AppShell } from '../../components/shell/app-shell';
import { PageHeader } from '../../components/ui/page-header';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { EmptyState } from '../../components/ui/empty-state';
import { projects, targets } from '@vacti/db';
import { getDb } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';
import { createTargetAction } from '../../lib/recon-actions';

export const dynamic = 'force-dynamic';

export default async function TargetsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const [projectRows, targetRows] = await Promise.all([
    db.select().from(projects).orderBy(desc(projects.createdAt)),
    db.select().from(targets).orderBy(desc(targets.createdAt)),
  ]);
  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <PageHeader
        title="Targets"
        description="Domains and organisations to assess. Predefined subdomains skip discovery."
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardContent className="pt-5">
            <form action={createTargetAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="projectId">Project</Label>
                <Select id="projectId" name="projectId" data-testid="target-project" required>
                  {projectRows.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="domain">Domain</Label>
                <Input id="domain" name="domain" data-testid="target-domain" placeholder="example.com" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subs">Predefined subdomains</Label>
                <Input
                  id="subs"
                  name="predefinedSubdomains"
                  data-testid="target-subs"
                  placeholder="a.example.com b.example.com"
                />
                <p className="text-xs text-fg-subtle">Space or comma separated. Skips subfinder when set.</p>
              </div>
              <Button type="submit" data-testid="create-target" className="w-full">
                Add target
              </Button>
            </form>
          </CardContent>
        </Card>
        <div data-testid="target-list" className="space-y-2">
          {targetRows.length === 0 ? (
            <EmptyState icon={<Crosshair />} title="No targets yet" description="Add a domain to scan." />
          ) : (
            targetRows.map((t) => (
              <Card key={t.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="font-mono text-sm">{t.domain}</div>
                  <Badge variant={t.predefinedSubdomains.length ? 'accent' : 'neutral'}>
                    {t.predefinedSubdomains.length
                      ? `${t.predefinedSubdomains.length} predefined subs`
                      : 'discovery on'}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
