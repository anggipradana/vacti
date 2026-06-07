import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { roleFromUser } from '@vacti/core';
import { getCurrentUser } from '../../../../lib/session';
import { changeOwnPasswordAction } from '../../../../lib/actions';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  current: 'Current password is incorrect.',
  weak: 'New password must be at least 8 characters.',
  mismatch: 'New password and confirmation do not match.',
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;
  const error = sp.error ? (ERRORS[sp.error] ?? 'Could not update password.') : null;

  return (
    <div className="grid max-w-xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>My account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-fg-muted">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-fg-muted">Role</span>
            <Badge variant="neutral">{roleFromUser(user)}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {sp.ok ? (
            <p className="mb-3 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              Password updated.
            </p>
          ) : null}
          {error ? (
            <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <form action={changeOwnPasswordAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current">Current password</Label>
              <Input id="current" name="current" type="password" autoComplete="current-password" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next">New password</Label>
              <Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <Button type="submit">Update password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
