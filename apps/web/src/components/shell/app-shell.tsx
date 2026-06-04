'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  LayoutDashboard,
  Crosshair,
  Radar,
  FolderKanban,
  KeyRound,
  ShieldAlert,
  FileText,
  Menu,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../ui/button';
import { ThemeToggle } from '../ui/theme-toggle';
import { CommandPalette } from '../ui/command-palette';
import { Badge } from '../ui/badge';
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
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Targets', href: '/targets', icon: Crosshair },
  { label: 'Scans', href: '/scans', icon: Radar },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
];
const soon = [
  { label: 'Threat Intel', icon: ShieldAlert },
  { label: 'Reports', icon: FileText },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Workspace</p>
      {nav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-accent/10 text-accent' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
      <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Coming soon</p>
      {soon.map((item) => (
        <span key={item.label} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-fg-subtle">
          <item.icon className="size-4 shrink-0" />
          {item.label}
          <Badge variant="outline" className="ml-auto text-[10px]">
            soon
          </Badge>
        </span>
      ))}
      <div className="mt-auto" />
      <Link
        href="/settings/tokens"
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          usePathname().startsWith('/settings')
            ? 'bg-accent/10 text-accent'
            : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        )}
      >
        <KeyRound className="size-4 shrink-0" />
        API Tokens
      </Link>
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-5 py-4">
      <span className="flex size-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-fg">
        v
      </span>
      <span className="text-base font-semibold tracking-tight">vacti</span>
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
  const [mobileOpen, setMobileOpen] = React.useState(false);
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <Brand />
        <NavLinks />
      </aside>

      {/* Mobile drawer */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <Brand />
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
          >
            <Menu className="size-4" />
          </Button>
          <CommandPalette />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu email={user.email} isSysAdmin={user.isSysAdmin} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
