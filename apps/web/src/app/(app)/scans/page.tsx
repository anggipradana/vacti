import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, count, eq, and, ne } from 'drizzle-orm';
import { Radar } from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import { Table, THead, TBody, TR, TH, TD } from '../../../components/ui/table';
import { StatusPill } from '../../../components/ui/status-pill';
import { EmptyState } from '../../../components/ui/empty-state';
import { Button } from '../../../components/ui/button';
import { Pagination } from '../../../components/ui/pagination';
import { NewScanDialog } from '../../../components/new-scan-dialog';
import { ProjectSwitcher } from '../../../components/project-switcher';
import { getActiveProjectId } from '../../../lib/active-project';
import { scans, targets, scanProfiles, projects } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';

export const dynamic = 'force-dynamic';

function rel(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const PAGE_SIZE = 25;

export default async function ScansPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; project?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const projectId = await getActiveProjectId(sp.project, projectRows);
  // Scope scans + targets to the active project (multi-project workspaces).
  // Scans dashboard is for VA scans only (active/full). Passive-recon-only scans belong to Attack
  // Surface and are excluded here.
  const scanWhere = projectId
    ? and(eq(scans.projectId, projectId), ne(scans.mode, 'passive'))
    : ne(scans.mode, 'passive');
  const [scanRows, targetRows, profileRows, countRows] = await Promise.all([
    db.select().from(scans).where(scanWhere).orderBy(desc(scans.createdAt)).limit(PAGE_SIZE).offset(offset),
    projectId
      ? db.select().from(targets).where(eq(targets.projectId, projectId)).orderBy(desc(targets.createdAt))
      : Promise.resolve([]),
    db.select().from(scanProfiles),
    db.select({ n: count() }).from(scans).where(scanWhere),
  ]);
  const totalScans = Number(countRows[0]?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalScans / PAGE_SIZE));
  const targetById = new Map(targetRows.map((t) => [t.id, t]));
  return (
    <>
      <PageHeader
        title="Vulnerability Assessment"
        description="Recon runs across your targets."
        actions={
          <div className="flex items-center gap-2">
            <ProjectSwitcher projects={projectRows} current={projectId} basePath="/scans" />
            <NewScanDialog
              targets={targetRows.map((t) => ({ id: t.id, domain: t.domain }))}
              profiles={profileRows.map((p) => ({ id: p.id, name: p.name }))}
            />
          </div>
        }
      />
      {scanRows.length === 0 ? (
        <EmptyState
          icon={<Radar />}
          title="No scans yet"
          description="Add a target, then start your first recon scan."
          action={
            <Button asChild variant="secondary">
              <Link href="/targets">Add a target</Link>
            </Button>
          }
        />
      ) : (
        <div data-testid="scan-list">
          <Table>
            <THead>
              <TR>
                <TH>Target</TH>
                <TH>Status</TH>
                <TH>Findings</TH>
                <TH>Started</TH>
              </TR>
            </THead>
            <TBody>
              {scanRows.map((s) => {
                const c = (s.counts ?? {}) as Record<string, number>;
                return (
                  <TR key={s.id}>
                    <TD>
                      <Link href={`/scans/${s.id}`} className="font-mono text-sm text-accent hover:underline">
                        {targetById.get(s.targetId)?.domain ?? s.targetId.slice(0, 8)}
                      </Link>
                    </TD>
                    <TD>
                      <span data-testid={`scan-status-${s.id}`}>
                        <StatusPill status={s.status} />
                      </span>
                    </TD>
                    <TD className="tabular text-sm text-fg-muted">
                      {c.endpoints ?? 0} endpoints · {c.ports ?? 0} ports · {c.vulnerabilities ?? 0} vulns
                    </TD>
                    <TD className="text-sm text-fg-subtle">{rel(s.createdAt)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={totalScans}
            label="scans"
            makeHref={(p) => `/scans?project=${projectId}&page=${p}`}
          />
        </div>
      )}
    </>
  );
}
