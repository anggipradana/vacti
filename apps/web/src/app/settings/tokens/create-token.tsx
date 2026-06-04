'use client';

import { useActionState } from 'react';
import { Copy } from 'lucide-react';
import { createTokenAction } from '../../../lib/actions';
import { Card, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';

export default function CreateToken() {
  const [state, formAction] = useActionState(createTokenAction, {} as { token?: string });
  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="label">Label</Label>
            <Input id="label" name="label" data-testid="token-label" placeholder="ci-automation" />
          </div>
          <Button type="submit" data-testid="create-token">
            Create token
          </Button>
        </form>
        {state?.token ? (
          <div className="mt-4 rounded-md border border-accent/30 bg-accent/10 p-3">
            <p className="mb-1 text-xs font-medium text-accent">Copy now — shown once</p>
            <div className="flex items-center gap-2">
              <code data-testid="new-token" className="flex-1 break-all font-mono text-xs">
                {state.token}
              </code>
              <Copy className="size-4 shrink-0 text-fg-subtle" />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
