import Link from 'next/link';
import { redirect } from 'next/navigation';
import Nav from '../../components/nav';
import { Severity, SEVERITY_LABEL, type SeverityValue } from '@vacti/core';
import { targets, scans, endpoints, vulnerabilities } from '@vacti/db';
import { getDb } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const [targetRows, scanRows, endpointRows, vulnRows] = await Promise.all([
    db.select().from(targets),
    db.select().from(scans),
    db.select().from(endpoints),
    db.select().from(vulnerabilities),
  ]);

  const byStatus = scanRows.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  const bySeverity = vulnRows.reduce<Record<number, number>>((acc, v) => {
    acc[v.severity] = (acc[v.severity] ?? 0) + 1;
    return acc;
  }, {});
  const severityOrder: SeverityValue[] = [
    Severity.Critical,
    Severity.High,
    Severity.Medium,
    Severity.Low,
    Severity.Info,
  ];

  const Card = ({ label, value }: { label: string; value: number | string }) => (
    <div className="card" style={{ minWidth: 140, textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', fontWeight: 700 }}>{value}</div>
      <div className="muted">{label}</div>
    </div>
  );

  return (
    <>
      <Nav email={user.email} />
      <main>
        <h1>Dashboard</h1>
        <p className="muted" data-testid="welcome">
          Signed in as {user.email}
          {user.isSysAdmin ? ' · SysAdmin' : ''}
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Card label="Targets" value={targetRows.length} />
          <Card label="Scans" value={scanRows.length} />
          <Card label="Live endpoints" value={endpointRows.length} />
          <Card label="Vulnerabilities" value={vulnRows.length} />
        </div>

        <h2>Scans by status</h2>
        <p className="muted">
          {Object.keys(byStatus).length
            ? Object.entries(byStatus)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')
            : 'No scans yet.'}
        </p>

        <h2>Severity breakdown</h2>
        <p className="muted">
          {vulnRows.length
            ? severityOrder
                .filter((s) => bySeverity[s])
                .map((s) => `${SEVERITY_LABEL[s]}: ${bySeverity[s]}`)
                .join(' · ')
            : 'No findings yet.'}
        </p>

        <div className="card">
          Quick start: <Link href="/targets">add a target</Link> → <Link href="/scans">run a scan</Link>. Richer charts
          (Recharts) + Threat Intel cards land as dashboard-ui matures.
        </div>
      </main>
    </>
  );
}
