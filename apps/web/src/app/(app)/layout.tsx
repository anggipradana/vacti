import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { pentestHelpRequests } from '@vacti/db';
import { AppShell } from '../../components/shell/app-shell';
import { getCurrentUser } from '../../lib/session';
import { getLocale } from '../../lib/locale';
import { getDb } from '../../lib/db';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const locale = await getLocale();
  // Global in-app alert: engagements whose engine raised a help request (login failed, captcha, decision).
  const awaiting = await getDb()
    .select({ engagementId: pentestHelpRequests.engagementId })
    .from(pentestHelpRequests)
    .where(eq(pentestHelpRequests.status, 'awaiting'));
  const helpAlert = awaiting.length
    ? { count: awaiting.length, href: awaiting.length === 1 ? `/pentest/${awaiting[0]!.engagementId}` : '/pentest' }
    : null;
  return (
    <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }} locale={locale} helpAlert={helpAlert}>
      {children}
    </AppShell>
  );
}
