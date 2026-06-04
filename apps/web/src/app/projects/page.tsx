import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { FolderKanban } from 'lucide-react';
import { AppShell } from '../../components/shell/app-shell';
import { PageHeader } from '../../components/ui/page-header';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { projects } from '@vacti/db';
import { getDb } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';
import { createProjectAction } from '../../lib/actions';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const rows = await getDb().select().from(projects).orderBy(desc(projects.createdAt));
  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <PageHeader title="Projects" description="Workspaces that scope your targets, scans, and findings." />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardContent className="pt-5">
            <form action={createProjectAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" data-testid="project-name" placeholder="Acme Corp" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" data-testid="project-slug" placeholder="acme-corp" required />
              </div>
              <Button type="submit" data-testid="create-project" className="w-full">
                Create project
              </Button>
            </form>
          </CardContent>
        </Card>
        <div data-testid="project-list" className="space-y-2">
          {rows.length === 0 ? (
            <EmptyState
              icon={<FolderKanban />}
              title="No projects yet"
              description="Create your first workspace to get started."
            />
          ) : (
            rows.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="font-mono text-xs text-fg-subtle">/{p.slug}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
