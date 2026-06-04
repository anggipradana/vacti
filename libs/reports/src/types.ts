import type { Lang } from './i18n';

export interface ReportSettings {
  primaryColor: string;
  secondaryColor: string;
  companyName?: string | null;
  companyAddress?: string | null;
  companyEmail?: string | null;
  companyWebsite?: string | null;
  documentNumber?: string | null;
  classification?: string | null;
  footerText?: string | null;
}

export interface Signatory {
  role: 'prepared' | 'reviewed' | 'approved';
  name: string;
  position: string;
}

export interface VaReportData {
  lang: Lang;
  type: 'recon' | 'vuln' | 'full';
  settings: ReportSettings;
  signatories: Signatory[];
  target: { domain: string };
  scan: { status: string; startedAt?: Date | null; finishedAt?: Date | null };
  counts: { subdomains: number; endpoints: number; ports: number };
  severityCounts: [number, number, number, number, number]; // crit, high, med, low, info
  endpoints: { url: string; statusCode?: number | null; title?: string | null }[];
  vulns: { name: string; severity: number; status: string; matchedAt?: string | null; type?: string | null }[];
}

export interface TiReportData {
  lang: Lang;
  settings: ReportSettings;
  signatories: Signatory[];
  project: { name: string };
  risk: { score: number; color: string };
  totals: { pulses: number; malware: number; leaks: number };
  otx: { indicator: string; pulses: number; malwareCount: number; reputation: number }[];
  leaks: { identifier: string; source: string | null; status: string }[];
  indicators: { type: string; value: string }[];
}

export const DEFAULT_VA_SETTINGS: ReportSettings = {
  primaryColor: '#4f46e5',
  secondaryColor: '#0f172a',
  classification: null,
  footerText: null,
};
export const DEFAULT_TI_SETTINGS: ReportSettings = {
  primaryColor: '#4f46e5',
  secondaryColor: '#0b1220',
  classification: 'CONFIDENTIAL — FOR INTERNAL USE ONLY',
  footerText: 'CONFIDENTIAL',
};
