import Link from 'next/link';
import { redirect } from 'next/navigation';
import { count, desc, eq } from 'drizzle-orm';
import { Crosshair } from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import { FormBanner } from '../../../components/ui/form-banner';
import { Card, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../../../components/ui/label';
import { SubmitButton } from '../../../components/ui/submit-button';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { ConfirmButton } from '../../../components/ui/confirm-button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Pagination } from '../../../components/ui/pagination';
import { userCan, Permission } from '@vacti/core';
import { projects, targets } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { createTargetAction, editTargetAction, deleteTargetAction } from '../../../lib/recon-actions';
import { ProjectSwitcher } from '../../../components/project-switcher';
import { getActiveProjectId } from '../../../lib/active-project';

export const dynamic = 'force-dynamic';

const PAGE = 20;

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; tpage?: string; error?: string; ok?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.tpage ?? 1) || 1);
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const projectId = await getActiveProjectId(sp.project, projectRows);
  // Scope targets to the active project (multi-project workspaces, like the Threat page).
  const [targetRows, countRows] = projectId
    ? await Promise.all([
        db
          .select()
          .from(targets)
          .where(eq(targets.projectId, projectId))
          .orderBy(desc(targets.createdAt))
          .limit(PAGE)
          .offset((page - 1) * PAGE),
        db.select({ n: count() }).from(targets).where(eq(targets.projectId, projectId)),
      ])
    : [[], [{ n: 0 }]];
  const total = Number(countRows[0]?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <>
      <PageHeader
        title="Targets"
        description="Domains and organisations to assess. Predefined subdomains skip discovery."
        actions={<ProjectSwitcher projects={projectRows} current={projectId} basePath="/targets" />}
      />
      <FormBanner
        ok={sp.ok}
        error={sp.error}
        messages={{ invalid: 'Enter a valid domain (and select a project) before adding a target.' }}
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardContent className="pt-5">
            <form action={createTargetAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="projectId">Project</Label>
                <Select id="projectId" name="projectId" data-testid="target-project" defaultValue={projectId} required>
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
              <div className="space-y-1.5">
                <Label htmlFor="headers">Custom request headers</Label>
                <Textarea
                  id="headers"
                  name="customHeaders"
                  rows={3}
                  placeholder={'Authorization: Bearer …\nX-Api-Key: …'}
                />
                <p className="text-xs text-fg-subtle">
                  One per line as &quot;Key: value&quot;. Sent by httpx &amp; nuclei.
                </p>
              </div>
              <SubmitButton data-testid="create-target" className="w-full" pendingText="Adding…">
                Add target
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
        <div data-testid="target-list" className="space-y-2">
          {targetRows.length === 0 ? (
            <EmptyState icon={<Crosshair />} title="No targets yet" description="Add a domain to scan." />
          ) : (
            targetRows.map((t) => (
              <Card key={t.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <Link href={`/targets/${t.id}`} className="font-mono text-sm text-accent hover:underline">
                      {t.domain}
                    </Link>
                    <div className="flex items-center gap-2">
                      {t.customHeaders ? <Badge variant="neutral">custom headers</Badge> : null}
                      <Badge variant={t.predefinedSubdomains.length ? 'accent' : 'neutral'}>
                        {t.predefinedSubdomains.length
                          ? `${t.predefinedSubdomains.length} predefined subs`
                          : 'discovery on'}
                      </Badge>
                      {userCan(user, Permission.ModifyTargets) ? (
                        <form action={deleteTargetAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <ConfirmButton
                            size="sm"
                            variant="ghost"
                            className="text-danger hover:bg-danger/10"
                            confirm={`Delete target ${t.domain} and all its scans/results? This cannot be undone.`}
                          >
                            Delete
                          </ConfirmButton>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  {userCan(user, Permission.ModifyTargets) ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-fg-muted hover:text-fg">Edit</summary>
                      <form action={editTargetAction} className="mt-3 space-y-3">
                        <input type="hidden" name="id" value={t.id} />
                        <div className="space-y-1.5">
                          <Label htmlFor={`domain-${t.id}`}>Domain</Label>
                          <Input id={`domain-${t.id}`} name="domain" defaultValue={t.domain} required />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`subs-${t.id}`}>Predefined subdomains</Label>
                          <Input
                            id={`subs-${t.id}`}
                            name="predefinedSubdomains"
                            defaultValue={t.predefinedSubdomains.join(' ')}
                            placeholder="a.example.com b.example.com"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`headers-${t.id}`}>Custom request headers</Label>
                          <Textarea
                            id={`headers-${t.id}`}
                            name="customHeaders"
                            rows={3}
                            defaultValue={Object.entries((t.customHeaders ?? {}) as Record<string, string>)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join('\n')}
                            placeholder={'Authorization: Bearer …\nX-Api-Key: …'}
                          />
                        </div>
                        <SubmitButton size="sm" pendingText="Saving…">
                          Save changes
                        </SubmitButton>
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
            label="targets"
            makeHref={(p) => '/targets?project=' + projectId + '&tpage=' + p}
          />
        </div>
      </div>
    </>
  );
}
