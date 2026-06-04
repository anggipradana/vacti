import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { createAdminAction, loginAction } from '../../lib/actions';
import { getCurrentUser, userCount } from '../../lib/session';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ThemeToggle } from '../../components/ui/theme-toggle';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/dashboard');
  const firstRun = (await userCount()) === 0;
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-accent font-display text-lg font-bold text-accent-fg">
            v
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">vacti</h1>
            <p className="text-sm text-fg-muted">VA &amp; Threat Intelligence platform</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-accent" />
            {firstRun ? 'Create the first admin' : 'Sign in'}
          </div>
          <form action={firstRun ? createAdminAction : loginAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" name="email" data-testid="email" placeholder="you@company.com" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                name="password"
                data-testid="password"
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" data-testid="submit" className="w-full">
              {firstRun ? 'Create admin & continue' : 'Sign in'}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-fg-subtle">
          {firstRun ? 'This account becomes the SysAdmin.' : 'Authorized use only.'}
        </p>
      </div>
    </div>
  );
}
