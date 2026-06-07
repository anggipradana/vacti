import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { FolderKanban } from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import { Card, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { ConfirmButton } from '../../../components/ui/confirm-button';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { userCan, Permission } from '@vacti/core';
import { projects } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { createProjectAction, deleteProjectAction, setDefaultProjectAction } from '../../../lib/actions';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const canManage = userCan(user, Permission.ModifyTargets);
  const rows = await getDb().select().from(projects).orderBy(desc(projects.createdAt));
  return (
    <>
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      {p.isDefault ? (
                        <Badge variant="accent" className="text-[10px]">
                          Default
                        </Badge>
                      ) : null}
                    </div>
                    <div className="font-mono text-xs text-fg-subtle">/{p.slug}</div>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-1.5">
                      {!p.isDefault ? (
                        <form action={setDefaultProjectAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <Button type="submit" size="sm" variant="outline">
                            Set default
                          </Button>
                        </form>
                      ) : null}
                      <form action={deleteProjectAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmButton
                          size="sm"
                          variant="ghost"
                          className="text-danger hover:bg-danger/10"
                          confirm={`Delete project "${p.name}" and ALL its targets, scans, findings and TI data? This cannot be undone.`}
                        >
                          Delete
                        </ConfirmButton>
                      </form>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
