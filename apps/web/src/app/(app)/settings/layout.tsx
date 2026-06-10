import { redirect } from 'next/navigation';
import { PageHeader } from '../../../components/ui/page-header';
import { SettingsTabs } from '../../../components/settings-tabs';
import { getCurrentUser } from '../../../lib/session';

export const dynamic = 'force-dynamic';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return (
    <>
      <PageHeader
        title="Settings"
        description="Projects, schedules, API tokens, scan profiles, reports, integrations, users, and audit."
      />
      <SettingsTabs isSysAdmin={user.isSysAdmin} />
      {children}
    </>
  );
}
