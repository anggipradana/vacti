import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import Nav from '../../components/nav';
import { projects, targets } from '@vacti/db';
import { getDb } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';
import { createTargetAction } from '../../lib/recon-actions';

export const dynamic = 'force-dynamic';

export default async function TargetsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb();
  const [projectRows, targetRows] = await Promise.all([
    db.select().from(projects).orderBy(desc(projects.createdAt)),
    db.select().from(targets).orderBy(desc(targets.createdAt)),
  ]);
  return (
    <>
      <Nav email={user.email} />
      <main>
        <h1>Targets</h1>
        <div className="card">
          <form action={createTargetAction}>
            <label>
              Project
              <select name="projectId" data-testid="target-project" required>
                {projectRows.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (/{p.slug})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Domain
              <input name="domain" data-testid="target-domain" placeholder="example.com" required />
            </label>
            <label>
              Predefined subdomains (optional, space/comma separated — skips subfinder)
              <input name="predefinedSubdomains" data-testid="target-subs" placeholder="a.example.com b.example.com" />
            </label>
            <button type="submit" data-testid="create-target">
              Add target
            </button>
          </form>
        </div>
        <ul data-testid="target-list">
          {targetRows.map((t) => (
            <li key={t.id}>
              <strong>{t.domain}</strong>{' '}
              <span className="muted">
                {t.predefinedSubdomains.length
                  ? `${t.predefinedSubdomains.length} predefined subs`
                  : 'no predefined subs'}
              </span>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
