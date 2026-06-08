import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { ConfirmButton } from '../../../../components/ui/confirm-button';
import { roleFromUser } from '@vacti/core';
import { getCurrentUser } from '../../../../lib/session';
import { changeOwnPasswordAction, changeOwnEmailAction, signOutEverywhereAction } from '../../../../lib/actions';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  current: 'Current password is incorrect.',
  weak: 'New password must be at least 8 characters.',
  mismatch: 'New password and confirmation do not match.',
  email: 'Enter a valid email.',
  emailtaken: 'That email is already in use.',
};

const OK_MESSAGES: Record<string, string> = {
  email: 'Email updated.',
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;
  // Email card owns email errors/ok; password card owns the rest. Keep banners on the right card.
  const isEmailScope = sp.error === 'email' || sp.error === 'emailtaken' || sp.ok === 'email';
  const emailError = sp.error && isEmailScope ? (ERRORS[sp.error] ?? 'Could not update email.') : null;
  const passwordError = sp.error && !isEmailScope ? (ERRORS[sp.error] ?? 'Could not update password.') : null;
  const emailOk = sp.ok === 'email' ? OK_MESSAGES.email : null;
  // Password success historically lands as ?ok=1 (any non-email ok value).
  const passwordOk = sp.ok && sp.ok !== 'email' ? 'Password updated.' : null;

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
          <CardTitle>Email</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {emailOk ? (
            <p className="mb-3 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              {emailOk}
            </p>
          ) : null}
          {emailError ? (
            <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {emailError}
            </p>
          ) : null}
          <form action={changeOwnEmailAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" name="email" type="email" autoComplete="email" defaultValue={user.email} required />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {passwordOk ? (
            <p className="mb-3 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              {passwordOk}
            </p>
          ) : null}
          {passwordError ? (
            <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {passwordError}
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

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-sm text-fg-muted">
            Revoke every active session across all devices. You will be signed out here too.
          </p>
          <form action={signOutEverywhereAction}>
            <ConfirmButton variant="destructive" confirm="Sign out of all sessions, including this one?">
              Sign out of all devices
            </ConfirmButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
