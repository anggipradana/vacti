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
  /** Company logo as a data: URL, embedded on the cover (falls back to a monogram). */
  companyLogo?: string | null;
  /** When set, use the analyst-authored executive summary instead of the auto-generated one. */
  showExecutiveSummary?: boolean | null;
  executiveSummary?: string | null;
  executiveSummaryId?: string | null;
  /** Optional AI-generated general recommendations (overrides the deterministic fallback). */
  aiRecommendations?: string | null;
  aiRecommendationsId?: string | null;
}

export interface Signatory {
  role: 'prepared' | 'reviewed' | 'approved';
  name: string;
  position: string;
  /** Signature image as a data: URL, embedded on the approval sheet. */
  signatureImage?: string | null;
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
    // From the nuclei template (non-AI).
    cvss?: number | null;
    cveIds?: string[];
    references?: string[];
    description?: string | null;
    remediation?: string | null;
  }[];
}

export interface TiReportData {
  lang: Lang;
  settings: ReportSettings;
  signatories: Signatory[];
  project: { name: string };
  risk: { score: number; color: string; components?: Record<string, number> };
  /** Optional AI-generated risk-analysis narrative (G8). */
  aiNarrative?: string | null;
  totals: { pulses: number; malware: number; leaks: number };
  otx: { indicator: string; pulses: number; malwareCount: number; reputation: number }[];
  leaks: { identifier: string; source: string | null; status: string }[];
  indicators: { type: string; value: string }[];
  /** Project sector for the security-news section (e.g. 'banking'). */
  sector?: string;
  /** Curated sector security news (RSS), newest first. */
  news?: { title: string; source: string; link: string; publishedAt: Date | null; status: string }[];
}

export const DEFAULT_VA_SETTINGS: ReportSettings = {
  primaryColor: '#069ec6',
  secondaryColor: '#08222b',
  classification: 'CONFIDENTIAL - FOR INTERNAL USE ONLY',
  footerText: 'CONFIDENTIAL',
};
export const DEFAULT_TI_SETTINGS: ReportSettings = {
  primaryColor: '#069ec6',
  secondaryColor: '#08222b',
  classification: 'CONFIDENTIAL - FOR INTERNAL USE ONLY',
  footerText: 'CONFIDENTIAL',
};
