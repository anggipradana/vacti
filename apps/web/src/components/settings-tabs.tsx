'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../lib/cn';
import { tx, type Locale } from '../lib/i18n';

function buildTabs(locale: Locale) {
  return [
    { label: tx(locale, 'Account', 'Akun'), href: '/settings/account' },
    { label: tx(locale, 'Projects', 'Project'), href: '/settings/projects' },
    { label: tx(locale, 'Schedules', 'Jadwal'), href: '/settings/schedules' },
    { label: tx(locale, 'API Tokens', 'API Token'), href: '/settings/tokens' },
    { label: tx(locale, 'Scan Profiles', 'Scan Profile'), href: '/settings/profiles' },
    { label: tx(locale, 'Reports', 'Laporan'), href: '/settings/reports' },
    { label: tx(locale, 'Pentest Report', 'Laporan Pentest'), href: '/settings/pentest-report' },
    { label: tx(locale, 'Integrations', 'Integrasi'), href: '/settings/integrations' },
    { label: tx(locale, 'Users', 'Pengguna'), href: '/settings/users', sysAdminOnly: true },
    { label: tx(locale, 'Audit log', 'Log audit'), href: '/settings/audit', sysAdminOnly: true },
  ];
}

export function SettingsTabs({ isSysAdmin = true, locale = 'en' }: { isSysAdmin?: boolean; locale?: Locale }) {
  const pathname = usePathname();
  const tabs = buildTabs(locale);
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {tabs
        .filter((t) => isSysAdmin || !t.sysAdminOnly)
        .map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
              pathname === t.href ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {t.label}
          </Link>
        ))}
    </div>
  );
}
