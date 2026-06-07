'use client';
import { Button, type ButtonProps } from './button';

/**
 * Submit button that asks for confirmation before submitting its form. Use for destructive actions
 * (delete user/project/scan/finding). Pairs with a server action on the surrounding <form>.
 */
export function ConfirmButton({
  confirm = 'Are you sure? This cannot be undone.',
  children,
  ...props
}: ButtonProps & { confirm?: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
