import Link from 'next/link';
import { logoutAction } from '../lib/actions';

export default function Nav({ email }: { email: string }) {
  return (
    <nav>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/projects">Projects</Link>
      <Link href="/targets">Targets</Link>
      <Link href="/scans">Scans</Link>
      <Link href="/settings/tokens">API Tokens</Link>
      <span style={{ marginLeft: 'auto' }} className="muted">
        {email}
      </span>
      <form action={logoutAction}>
        <button type="submit" data-testid="logout">
          Logout
        </button>
      </form>
    </nav>
  );
}
