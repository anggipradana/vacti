import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { AppShell } from '../../../components/shell/app-shell';
import { PageHeader } from '../../../components/ui/page-header';
import { SettingsTabs } from '../../../components/settings-tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Role, ROLE_LABEL, roleFromUser, userCan, Permission } from '@vacti/core';
import { users } from '@vacti/db';
import { getDb } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { changeUserRoleAction } from '../../../lib/actions';

export const dynamic = 'force-dynamic';

export default async function UsersSettingsPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  // SysAdmin-only page (requires modify_system_config).
  if (!userCan(me, Permission.ModifySystemConfig)) redirect('/dashboard');
  const rows = await getDb().select().from(users).orderBy(desc(users.createdAt));

  return (
    <AppShell user={{ email: me.email, isSysAdmin: me.isSysAdmin }}>
      <PageHeader
        title="Settings"
        description="Users & roles. Roles are enforced server-side on every mutating action."
      />
      <SettingsTabs active="/settings/users" isSysAdmin />
      <Card>
        <CardHeader>
          <CardTitle>Users & roles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {rows.map((u) => (
            <div key={u.id} className="flex items-center justify-between border-b border-border py-3 last:border-0">
              <div>
                <span className="font-medium">{u.email}</span>
                {u.id === me.id ? (
                  <Badge variant="accent" className="ml-2">
                    you
                  </Badge>
                ) : null}
                <div className="text-xs text-fg-subtle">{ROLE_LABEL[roleFromUser(u)]}</div>
              </div>
              <form action={changeUserRoleAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={u.id} />
                <Select name="role" defaultValue={roleFromUser(u)} className="w-48">
                  <option value={Role.SysAdmin}>{ROLE_LABEL[Role.SysAdmin]}</option>
                  <option value={Role.PenetrationTester}>{ROLE_LABEL[Role.PenetrationTester]}</option>
                  <option value={Role.Auditor}>{ROLE_LABEL[Role.Auditor]}</option>
                </Select>
                <Button type="submit" size="sm" variant="outline">
                  Save
                </Button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="mt-4 text-xs text-fg-subtle">
        Auditor = read-only + reports. Penetration Tester = scans, results, targets, reports (no system config). System
        Admin = everything, incl. integrations &amp; user roles.
      </p>
    </AppShell>
  );
}
