import { redirect } from 'next/navigation';
import { count, desc } from 'drizzle-orm';
import { FolderKanban } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { SubmitButton } from '../../../../components/ui/submit-button';
import { ConfirmButton } from '../../../../components/ui/confirm-button';
import { Badge } from '../../../../components/ui/badge';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Pagination } from '../../../../components/ui/pagination';
import { Select } from '../../../../components/ui/select';
import { userCan, Permission } from '@vacti/core';
import { SECTORS } from '@vacti/threat-intel';
import { projects } from '@vacti/db';
import { getDb } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import {
  createProjectAction,
  deleteProjectAction,
  setDefaultProjectAction,
  editProjectAction,
} from '../../../../lib/actions';

export const dynamic = 'force-dynamic';

const PAGE = 20;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ ppage?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const canManage = userCan(user, Permission.ModifyTargets);
  const page = Math.max(1, Number((await searchParams).ppage ?? 1) || 1);
  const db = getDb();
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db.select({ n: count() }).from(projects),
  ]);
  const total = Number(countRows[0]?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <>
      <p className="mb-4 text-sm text-fg-muted">Workspaces that scope your targets, scans, and findings.</p>
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
              <SubmitButton data-testid="create-project" className="w-full">
                Create project
              </SubmitButton>
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
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
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
                            <SubmitButton size="sm" variant="outline">
                              Set default
                            </SubmitButton>
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
                  </div>
                  {canManage ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-fg-subtle">Edit</summary>
                      <form action={editProjectAction} className="mt-3 flex flex-wrap items-end gap-3">
                        <input type="hidden" name="id" value={p.id} />
                        <div className="space-y-1.5">
                          <Label htmlFor={`name-${p.id}`}>Name</Label>
                          <Input id={`name-${p.id}`} name="name" defaultValue={p.name} required className="w-48" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`sector-${p.id}`}>Sector</Label>
                          <Select id={`sector-${p.id}`} name="sector" defaultValue={p.sector} className="w-40">
                            {Object.keys(SECTORS).map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`slug-${p.id}`}>Slug</Label>
                          <Input id={`slug-${p.id}`} name="slug" defaultValue={p.slug} className="w-40" />
                        </div>
                        <SubmitButton size="sm">Save</SubmitButton>
                      </form>
                    </details>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            label="projects"
            makeHref={(p) => '/settings/projects?ppage=' + p}
          />
        </div>
      </div>
    </>
  );
}
