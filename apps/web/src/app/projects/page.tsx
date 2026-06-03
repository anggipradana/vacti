import { redirect } from 'next/navigation';
import Nav from '../../components/nav';
import { projects } from '@vacti/db';
import { getDb } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';
import { createProjectAction } from '../../lib/actions';

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const rows = await getDb().select().from(projects);
  return (
    <>
      <Nav email={user.email} />
      <main>
        <h1>Projects</h1>
        <div className="card">
          <form action={createProjectAction}>
            <label>
              Name
              <input name="name" data-testid="project-name" required />
            </label>
            <label>
              Slug (kebab-case)
              <input name="slug" data-testid="project-slug" required />
            </label>
            <button type="submit" data-testid="create-project">
              Create project
            </button>
          </form>
        </div>
        <ul data-testid="project-list">
          {rows.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong> <span className="muted">/{p.slug}</span>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
