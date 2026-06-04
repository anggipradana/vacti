import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import Nav from '../../components/nav';
import { scans, targets } from '@vacti/db';
import { getDb } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';
import { startScanAction } from '../../lib/recon-actions';

export const dynamic = 'force-dynamic';

export default async function ScansPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const [scanRows, targetRows] = await Promise.all([
    db.select().from(scans).orderBy(desc(scans.createdAt)),
    db.select().from(targets).orderBy(desc(targets.createdAt)),
  ]);
  const targetById = new Map(targetRows.map((t) => [t.id, t]));
  return (
    <>
      <Nav email={user.email} />
      <main>
        <h1>Scans</h1>
        <div className="card">
          <form action={startScanAction}>
            <label>
              Target
              <select name="targetId" data-testid="scan-target" required>
                {targetRows.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.domain}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" data-testid="start-scan">
              Start scan
            </button>
          </form>
          {targetRows.length === 0 ? (
            <p className="muted">
              No targets yet — <Link href="/targets">add one</Link> first.
            </p>
          ) : null}
        </div>
        <table data-testid="scan-list" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th>Target</th>
              <th>Status</th>
              <th>Counts</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {scanRows.map((s) => {
              const c = (s.counts ?? {}) as Record<string, number>;
              return (
                <tr key={s.id}>
                  <td>
                    <Link href={`/scans/${s.id}`}>{targetById.get(s.targetId)?.domain ?? s.targetId}</Link>
                  </td>
                  <td>
                    <span data-testid={`scan-status-${s.id}`}>{s.status}</span>
                  </td>
                  <td className="muted">
                    {c.endpoints ?? 0} ep · {c.ports ?? 0} ports · {c.vulnerabilities ?? 0} vulns
                  </td>
                  <td className="muted">{s.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>
    </>
  );
}
