import { redirect } from 'next/navigation';
import { AppShell } from '../../components/shell/app-shell';
import { getCurrentUser } from '../../lib/session';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <AppShell user={{ email: user.email, isSysAdmin: user.isSysAdmin }}>{children}</AppShell>;
}
