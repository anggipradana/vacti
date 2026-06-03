import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import Nav from '../../../components/nav';
import { apiTokens } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { revokeTokenAction } from '../../../lib/actions';
import CreateToken from './create-token';

export default async function TokensPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const rows = await getDb()
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.userId, user.id))
    .orderBy(desc(apiTokens.createdAt));
  return (
    <>
      <Nav email={user.email} />
      <main>
        <h1>API Tokens</h1>
        <CreateToken />
        <ul data-testid="token-list">
          {rows.map((t) => (
            <li key={t.id}>
              <strong>{t.label}</strong> <span className="muted">{t.createdAt.toISOString()}</span>
              <form action={revokeTokenAction} style={{ display: 'inline', marginLeft: '0.5rem' }}>
                <input type="hidden" name="id" value={t.id} />
                <button type="submit">Revoke</button>
              </form>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
