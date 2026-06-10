import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq, and, ne, inArray } from 'drizzle-orm';
import { FileText, Settings2 } from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Table, THead, TBody, TR, TH, TD } from '../../../components/ui/table';
import { StatusPill } from '../../../components/ui/status-pill';
import { EmptyState } from '../../../components/ui/empty-state';
import { Button } from '../../../components/ui/button';
import { ProjectSwitcher } from '../../../components/project-switcher';
import { getActiveProjectId } from '../../../lib/active-project';
import { scans, targets, projects } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';

export const dynamic = 'force-dynamic';

// Reports are generated from finished scans only; running scans would produce partial documents.
const TERMINAL = ['completed', 'failed', 'cancelled'];

function fmt(d: Date | null): string {
  if (!d) return '-';
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const sp = await searchParams;
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const projectId = await getActiveProjectId(sp.project, projectRows);

  const [scanRows, targetRows] = await Promise.all([
    projectId
      ? db
          .select()
          .from(scans)
          .where(and(eq(scans.projectId, projectId), ne(scans.mode, 'passive'), inArray(scans.status, TERMINAL)))
          .orderBy(desc(scans.createdAt))
          .limit(50)
      : Promise.resolve([]),
    projectId ? db.select().from(targets).where(eq(targets.projectId, projectId)) : Promise.resolve([]),
  ]);
  const targetById = new Map(targetRows.map((t) => [t.id, t]));

  return (
    <>
      <PageHeader
        title="Reports"
        description="Generate and download PDF reports for vulnerability assessments and threat intelligence."
        actions={
          <div className="flex items-center gap-2">
            <ProjectSwitcher projects={projectRows} current={projectId} basePath="/reports" />
            <Button asChild variant="outline" size="sm">
              <Link href={`/settings/reports?project=${projectId ?? ''}`}>
                <Settings2 /> Report settings
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Threat Intelligence report</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
          <p className="text-sm text-fg-muted">
            Project-wide CTI summary: risk score, OTX pulses, leaked credentials, indicators, sector news and the AI
            risk analysis. Language and branding follow your report settings.
          </p>
          {projectId ? (
            <Button asChild variant="secondary" size="sm">
              <a href={`/reports/ti/${projectId}`} target="_blank" rel="noopener noreferrer">
                <FileText /> Download PDF
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vulnerability Assessment reports</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="mb-4 text-sm text-fg-muted">
            One report per finished scan. Full includes recon and findings; Recon and Findings are scoped variants.
            AI-enriched analysis is included automatically.
          </p>
          {scanRows.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              title="No finished scans"
              description="Reports become available once a scan completes."
              action={
                <Button asChild variant="secondary">
                  <Link href="/scans">Go to Scans</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Target</TH>
                  <TH>Status</TH>
                  <TH>Findings</TH>
                  <TH>Finished</TH>
                  <TH>Download</TH>
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
                        <StatusPill status={s.status} />
                      </TD>
                      <TD className="tabular text-sm text-fg-muted">
                        {c.endpoints ?? 0} endpoints · {c.ports ?? 0} ports · {c.vulnerabilities ?? 0} vulns
                      </TD>
                      <TD className="text-sm text-fg-subtle">{fmt(s.finishedAt)}</TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Button asChild variant="outline" size="sm">
                            <a href={`/reports/va/${s.id}?type=full`} target="_blank" rel="noopener noreferrer">
                              Full
                            </a>
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <a href={`/reports/va/${s.id}?type=recon`} target="_blank" rel="noopener noreferrer">
                              Recon
                            </a>
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <a href={`/reports/va/${s.id}?type=vuln`} target="_blank" rel="noopener noreferrer">
                              Findings
                            </a>
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
