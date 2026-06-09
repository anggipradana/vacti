'use client';

import * as React from 'react';
import { Button, type ButtonProps } from './button';

/**
 * A form that runs a server action and then reloads to show the result. On the heavy integrations
 * page the production client both (a) hangs useFormStatus forever (the action's response is dropped)
 * and (b) fails to re-apply the route flight via router.refresh() or a same-route client nav. So we
 * drive a local pending state, fire the (idempotent) action twice for reliability against the
 * keep-alive POST race, and do a single reload once it has persisted. This is the one page where a
 * reload is necessary; the lighter pages use the normal SubmitButton + revalidate flow.
 */
const PendingContext = React.createContext(false);

export function ActionForm({
  action,
  children,
  onSubmitted,
  ...props
}: {
  action: (formData: FormData) => void | Promise<void>;
  onSubmitted?: () => void;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action'>) {
  const [pending, setPending] = React.useState(false);

  // Why this isn't a plain <form action={...}> + useFormStatus: in the production build the action's
  // POST can land on a keep-alive connection the server is closing. Browsers transparently retry a
  // failed idempotent GET on a fresh connection, but never retry a POST, so the action silently never
  // reaches the server (and useFormStatus would hang on the dropped response). So we call the action
  // ourselves and retry once on failure (the retry opens a fresh connection), drive pending from
  // local state, then soft-refresh (a GET, reliable) to render the persisted result. A second refresh
  // catches actions that persist a little later server-side (e.g. a key validity probe).
  return (
    <form
      {...props}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        // Run the action twice (immediately + once more shortly after). Its POST can land on a
        // keep-alive connection the server is closing; browsers never retry a POST, so a single try
        // can be silently dropped. A second try opens a fresh connection. All these actions are
        // idempotent (upsert / delete / re-probe), so a duplicate run is harmless.
        const fire = () =>
          Promise.resolve()
            .then(() => action(fd))
            .catch(() => {});
        fire();
        window.setTimeout(fire, 600);
        // Neither router.refresh() nor a same-route client nav reliably re-applies the flight on this
        // heavy page in production, so reload once the mutation has persisted to show the result.
        window.setTimeout(() => {
          onSubmitted?.();
          window.location.reload();
        }, 1600);
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

/** Submit button for ActionForm: reflects the transition's pending state (spinner + disabled). */
export function ActionSubmit({ children, pendingText, ...props }: ButtonProps & { pendingText?: string }) {
  const pending = React.useContext(PendingContext);
  return (
    <Button type="submit" loading={pending} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
