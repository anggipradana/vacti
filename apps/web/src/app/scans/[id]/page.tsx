import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import Nav from '../../../components/nav';
import { SEVERITY_LABEL, type SeverityValue } from '@vacti/core';
import { scans, targets, scanActivity, subdomains, endpoints, ports as portsTable, vulnerabilities } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import AutoRefresh from './auto-refresh';

export const dynamic = 'force-dynamic';

const TERMINAL = ['completed', 'failed', 'cancelled'];

export default async function ScanDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const db = getDb();
  const [scan] = await db.select().from(scans).where(eq(scans.id, id));
  if (!scan) notFound();
  const [target] = await db.select().from(targets).where(eq(targets.id, scan.targetId));
  const [activity, subs, eps, prt, vulns] = await Promise.all([
    db.select().from(scanActivity).where(eq(scanActivity.scanId, id)).orderBy(scanActivity.createdAt),
    db.select().from(subdomains).where(eq(subdomains.scanId, id)),
    db.select().from(endpoints).where(eq(endpoints.scanId, id)),
    db.select().from(portsTable).where(eq(portsTable.scanId, id)),
    db.select().from(vulnerabilities).where(eq(vulnerabilities.scanId, id)),
  ]);
  const terminal = TERMINAL.includes(scan.status);

  return (
    <>
      <Nav email={user.email} />
      <AutoRefresh terminal={terminal} />
      <main>
        <h1>Scan · {target?.domain ?? scan.targetId}</h1>
        <p>
          Status: <strong data-testid="scan-status">{scan.status}</strong>
          {scan.stage ? <span className="muted"> · stage: {scan.stage}</span> : null}
          {!terminal ? <span className="muted"> · live ⟳</span> : null}
        </p>
        {scan.error ? <p style={{ color: '#ff6b6b' }}>Error: {scan.error}</p> : null}

        <h2>Activity</h2>
        <ul data-testid="activity">
          {activity.map((a) => (
            <li key={a.id} className="muted">
              {a.stage}: {a.status}
              {a.message ? ` — ${a.message}` : ''}
            </li>
          ))}
        </ul>

        <h2>Endpoints ({eps.length})</h2>
        <ul>
          {eps.map((e) => (
            <li key={e.id}>
              <code>{e.url}</code>{' '}
              <span className="muted">
                [{e.statusCode}] {e.title ?? ''}
              </span>
              {e.isWordpress ? <span className="muted"> · WordPress</span> : null}
            </li>
          ))}
        </ul>

        <h2>Open ports ({prt.length})</h2>
        <p className="muted">{prt.map((p) => `${p.ip}:${p.port}`).join(', ') || '—'}</p>

        <h2>Subdomains ({subs.length})</h2>
        <p className="muted">{subs.map((s) => s.host).join(', ') || '—'}</p>

        <h2>Vulnerabilities ({vulns.length})</h2>
        <ul>
          {vulns.map((v) => (
            <li key={v.id}>
              <strong>{SEVERITY_LABEL[v.severity as SeverityValue] ?? v.severity}</strong> · {v.name}{' '}
              <span className="muted">{v.matchedAt}</span>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
