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
  endpoints: {
    url: string;
    statusCode?: number | null;
    title?: string | null;
    tech?: string[];
    isWordpress?: boolean;
  }[];
  ports: { ip: string; port: number }[];
  subdomains: string[];
  vulns: {
    name: string;
    severity: number;
    status: string;
    matchedAt?: string | null;
    url?: string | null;
    type?: string | null;
    isAiEnriched?: boolean;
    aiDescription?: string | null;
    aiImpact?: string | null;
    aiRemediation?: string | null;
  }[];
}

export interface TiReportData {
  lang: Lang;
  settings: ReportSettings;
  signatories: Signatory[];
  project: { name: string };
  risk: { score: number; color: string; components?: Record<string, number> };
  totals: { pulses: number; malware: number; leaks: number };
  otx: { indicator: string; pulses: number; malwareCount: number; reputation: number }[];
  leaks: { identifier: string; source: string | null; status: string }[];
  indicators: { type: string; value: string }[];
}

export const DEFAULT_VA_SETTINGS: ReportSettings = {
  primaryColor: '#069ec6',
  secondaryColor: '#08222b',
  classification: 'CONFIDENTIAL — FOR INTERNAL USE ONLY',
  footerText: 'CONFIDENTIAL',
};
export const DEFAULT_TI_SETTINGS: ReportSettings = {
  primaryColor: '#069ec6',
  secondaryColor: '#08222b',
  classification: 'CONFIDENTIAL — FOR INTERNAL USE ONLY',
  footerText: 'CONFIDENTIAL',
};
