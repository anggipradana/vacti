import Link from 'next/link';
import { cn } from '../lib/cn';

const tabs = [
  { label: 'API Tokens', href: '/settings/tokens' },
  { label: 'Scan Profiles', href: '/settings/profiles' },
  { label: 'Reports', href: '/settings/reports' },
  { label: 'Integrations', href: '/settings/integrations' },
  { label: 'Users', href: '/settings/users', sysAdminOnly: true },
  { label: 'Audit log', href: '/settings/audit', sysAdminOnly: true },
];

export function SettingsTabs({ active, isSysAdmin = true }: { active: string; isSysAdmin?: boolean }) {
  return (
    <div className="mb-6 flex gap-1 border-b border-border">
      {tabs
        .filter((t) => isSysAdmin || !t.sysAdminOnly)
        .map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium',
              active === t.href ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {t.label}
          </Link>
        ))}
    </div>
  );
}
