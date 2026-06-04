import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { KeyRound } from 'lucide-react';
import { AppShell } from '../../../components/shell/app-shell';
import { PageHeader } from '../../../components/ui/page-header';
import { SettingsTabs } from '../../../components/settings-tabs';
import { Table, THead, TBody, TR, TH, TD } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { apiTokens } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { revokeTokenAction } from '../../../lib/actions';
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
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>
      <PageHeader title="Settings" description="Manage API tokens, report branding, and signatories." />
      <SettingsTabs active="/settings/tokens" />
      <div className="space-y-6">
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
                        <Button type="submit" variant="ghost" size="sm" className="text-danger hover:bg-danger/10">
                          Revoke
                        </Button>
                      </form>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
