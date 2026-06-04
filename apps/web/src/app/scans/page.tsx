import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { Radar } from 'lucide-react';
import { AppShell } from '../../components/shell/app-shell';
import { PageHeader } from '../../components/ui/page-header';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/table';
import { StatusPill } from '../../components/ui/status-pill';
import { EmptyState } from '../../components/ui/empty-state';
import { Button } from '../../components/ui/button';
import { NewScanDialog } from '../../components/new-scan-dialog';
import { scans, targets, scanProfiles } from '@vacti/db';
import { getDb } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';

export const dynamic = 'force-dynamic';

function rel(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function ScansPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const [scanRows, targetRows, profileRows] = await Promise.all([
    db.select().from(scans).orderBy(desc(scans.createdAt)),
    db.select().from(targets).orderBy(desc(targets.createdAt)),
    db.select().from(scanProfiles),
  ]);
  const targetById = new Map(targetRows.map((t) => [t.id, t]));
  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <PageHeader
        title="Scans"
        description="Recon runs across your targets."
        actions={
          <NewScanDialog
            targets={targetRows.map((t) => ({ id: t.id, domain: t.domain }))}
            profiles={profileRows.map((p) => ({ id: p.id, name: p.name }))}
          />
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
        </div>
      )}
    </AppShell>
  );
}
