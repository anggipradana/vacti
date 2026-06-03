'use client';

import { useActionState } from 'react';
import { createTokenAction } from '../../../lib/actions';

export default function CreateToken() {
  const [state, formAction] = useActionState(createTokenAction, {} as { token?: string });
  return (
    <div className="card">
      <form action={formAction}>
        <label>
          Label
          <input name="label" data-testid="token-label" placeholder="ci-automation" />
        </label>
        <button type="submit" data-testid="create-token">
          Create token
        </button>
      </form>
      {state?.token ? (
        <p>
          Copy now — shown once: <code data-testid="new-token">{state.token}</code>
        </p>
      ) : null}
    </div>
  );
}
