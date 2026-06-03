import { redirect } from 'next/navigation';
import Nav from '../../components/nav';
import { getCurrentUser } from '../../lib/session';

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return (
    <>
      <Nav email={user.email} />
      <main>
        <h1>Dashboard</h1>
        <p className="muted" data-testid="welcome">
          Signed in as {user.email}
          {user.isSysAdmin ? ' · SysAdmin' : ''}
        </p>
        <div className="card">Recon &amp; Threat Intelligence widgets land in the dashboard-ui epic.</div>
      </main>
    </>
  );
}
