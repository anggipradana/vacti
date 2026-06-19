// Lightweight platform i18n. English is the primary language, Indonesian (ID) the second. This module is
// ISOMORPHIC (no next/headers) so both client and server components can translate. The current locale is
// read server-side from the `locale` cookie (see lib/locale.ts) and passed down; the top-right toggle
// (components/ui/language-toggle.tsx) flips it. Findings/reports are already bilingual (en+id) via the
// reports lib, so only the platform UI chrome lives here.

export type Locale = 'en' | 'id';
export const LOCALES: Locale[] = ['en', 'id'];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'locale';

export function isLocale(v: unknown): v is Locale {
  return v === 'en' || v === 'id';
}

type Dict = Record<string, { en: string; id: string }>;

// Translation table. Keys are dotted namespaces. Add entries as modules are localised; a missing key falls
// back to the English text (or the key itself), so partial coverage degrades gracefully.
const DICT: Dict = {
  // Top navigation
  'nav.dashboard': { en: 'Dashboard', id: 'Dasbor' },
  'nav.targets': { en: 'Targets', id: 'Target' },
  'nav.va': { en: 'Vulnerability Assessment', id: 'Penilaian Kerentanan' },
  'nav.surface': { en: 'Attack Surface', id: 'Permukaan Serang' },
  'nav.threat': { en: 'Cyber Threat Intel', id: 'Intel Ancaman Siber' },
  'nav.pentest': { en: 'AI Pentest', id: 'AI Pentest' },
  'nav.reports': { en: 'Reports', id: 'Laporan' },
  'nav.settings': { en: 'Settings', id: 'Pengaturan' },
  'nav.docs': { en: 'Docs', id: 'Dokumentasi' },

  // Shell / common
  'common.signOut': { en: 'Sign out', id: 'Keluar' },
  'common.menu': { en: 'Menu', id: 'Menu' },
  'common.language': { en: 'Language', id: 'Bahasa' },
  'common.back': { en: 'Back', id: 'Kembali' },
  'common.cancel': { en: 'Cancel', id: 'Batal' },
  'common.create': { en: 'Create', id: 'Buat' },
  'common.run': { en: 'Run', id: 'Jalankan' },
  'common.save': { en: 'Save', id: 'Simpan' },
  'common.delete': { en: 'Delete', id: 'Hapus' },
  'common.loading': { en: 'Loading...', id: 'Memuat...' },

  // AI Pentest module
  'pentest.title': { en: 'AI Pentest', id: 'AI Pentest' },
  'pentest.newEngagement': { en: 'New engagement', id: 'Engagement baru' },
  'pentest.continueTesting': { en: 'Continue testing', id: 'Lanjut Tes' },
  'pentest.runConfig': { en: 'Run configuration', id: 'Konfigurasi Run' },
  'pentest.maxRunTime': { en: 'Max run time (minutes)', id: 'Durasi maksimum run (menit)' },
  'pentest.deterministicProbe': { en: 'Deterministic prober', id: 'Prober deterministik' },
  'pentest.aggressiveProbe': { en: 'Aggressive probing', id: 'Probing agresif' },
  'pentest.egressFirewall': { en: 'Egress firewall (scope net)', id: 'Firewall egress (scope net)' },
  'pentest.findings': { en: 'Findings', id: 'Temuan' },
  'pentest.location': { en: 'Location', id: 'Lokasi' },
  'pentest.severity': { en: 'Severity', id: 'Keparahan' },
  'pentest.status': { en: 'Status', id: 'Status' },
  'pentest.swarm': { en: 'Swarm', id: 'Swarm' },
  'pentest.testAccounts': { en: 'Test accounts', id: 'Akun uji' },
  'pentest.inScope': { en: 'In-scope targets', id: 'Target in-scope' },
  'pentest.outScope': { en: 'Out of scope (optional)', id: 'Luar scope (opsional)' },
};

/** Translate a key for a locale, with an optional explicit fallback (else the EN string, else the key). */
export function t(locale: Locale, key: string, fallback?: string): string {
  const entry = DICT[key];
  if (entry) return entry[locale] ?? entry.en;
  return fallback ?? key;
}

/** Bind a translator to a locale: `const tr = makeT(locale); tr('nav.pentest')`. */
export function makeT(locale: Locale): (key: string, fallback?: string) => string {
  return (key, fallback) => t(locale, key, fallback);
}
