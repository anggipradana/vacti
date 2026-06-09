import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { KeyRound } from 'lucide-react';
import { Table, THead, TBody, TR, TH, TD } from '../../../../components/ui/table';
import { SubmitButton } from '../../../../components/ui/submit-button';
import { EmptyState } from '../../../../components/ui/empty-state';
import { apiTokens } from '@vacti/db';
import { getDb } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import { revokeTokenAction } from '../../../../lib/actions';
import CreateToken from './create-token';

export const dynamic = 'force-dynamic';

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
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm">
          <span className="font-medium">API reference:</span> every action is scriptable via the typed REST API (Bearer
          token).{' '}
          <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            Open API docs (Redoc) →
          </a>{' '}
          ·{' '}
          <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            OpenAPI JSON
          </a>
          <div className="mt-1 text-xs text-fg-subtle">
            Usage guide: see <span className="font-mono">docs/tutorials/getting-started.md</span> in the repository.
          </div>
        </div>
        <CreateToken />
        <div data-testid="token-list">
          {rows.length === 0 ? (
            <EmptyState icon={<KeyRound />} title="No tokens yet" description="Create a token to call the vacti API." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Label</TH>
                  <TH>Created</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((t) => (
                  <TR key={t.id}>
                    <TD className="font-medium">{t.label}</TD>
                    <TD className="text-sm text-fg-subtle">{t.createdAt.toISOString().slice(0, 10)}</TD>
                    <TD className="text-right">
                      <form action={revokeTokenAction} className="inline">
                        <input type="hidden" name="id" value={t.id} />
                        <SubmitButton variant="ghost" size="sm" className="text-danger hover:bg-danger/10">
                          Revoke
                        </SubmitButton>
                      </form>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
