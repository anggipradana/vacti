import { redirect } from 'next/navigation';
import { createAdminAction, loginAction } from '../../lib/actions';
import { getCurrentUser, userCount } from '../../lib/session';

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/dashboard');
  const firstRun = (await userCount()) === 0;
  return (
    <main>
      <h1>vacti</h1>
      <div className="card">
        <h2>{firstRun ? 'Create the first admin' : 'Sign in'}</h2>
        <form action={firstRun ? createAdminAction : loginAction}>
          <label>
            Email
            <input type="email" name="email" data-testid="email" required />
          </label>
          <label>
            Password
            <input type="password" name="password" data-testid="password" required />
          </label>
          <button type="submit" data-testid="submit">
            {firstRun ? 'Create admin' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
