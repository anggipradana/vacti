'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, LogOut, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../ui/button';
import { ThemeToggle } from '../ui/theme-toggle';
import { CommandPalette } from '../ui/command-palette';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { logoutAction } from '../../lib/actions';

const nav = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Targets', href: '/targets' },
  { label: 'Scans', href: '/scans' },
  { label: 'Schedules', href: '/schedules' },
  { label: 'Threat Intel', href: '/threat' },
  { label: 'Search', href: '/search' },
  { label: 'Projects', href: '/projects' },
  { label: 'Settings', href: '/settings/tokens' },
];

function isActive(pathname: string, href: string): boolean {
  if (href.startsWith('/settings')) return pathname.startsWith('/settings');
  return pathname === href || pathname.startsWith(href + '/');
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-md bg-accent font-display text-sm font-bold text-accent-fg">
        v
      </span>
      <span className="font-display text-[17px] font-semibold tracking-tight">vacti</span>
    </Link>
  );
}

function UserMenu({ email, isSysAdmin }: { email: string; isSysAdmin: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" data-testid="user-menu">
          <span className="flex size-6 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
            {email.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{email}</span>
          <ChevronDown className="size-3.5 text-fg-subtle" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {email}
          {isSysAdmin ? ' · SysAdmin' : ''}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="logout"
          className="text-danger focus:bg-danger/10"
          onSelect={() => {
            void logoutAction();
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: { email: string; isSysAdmin: boolean };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-6 px-5 sm:px-6">
          <Brand />
          <nav className="hidden h-14 items-center gap-1 md:flex">
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex h-14 items-center px-3 text-sm font-medium transition-colors',
                    active ? 'text-fg' : 'text-fg-muted hover:text-fg',
                  )}
                >
                  {item.label}
                  {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" /> : null}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden md:block">
              <CommandPalette />
            </div>
            <ThemeToggle />
            <UserMenu email={user.email} isSysAdmin={user.isSysAdmin} />
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
            >
              <Menu className="size-4" />
            </Button>
          </div>
        </div>
        {mobileOpen ? (
          <nav className="border-t border-border px-3 py-2 md:hidden">
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'block rounded-md px-3 py-2 text-sm font-medium',
                    active ? 'bg-accent/10 text-accent' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-6">{children}</main>
    </div>
  );
}
