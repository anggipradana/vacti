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

  // --- Pentest report (professional doc-style) settings ---
  /** Issuing-organization phone (the other org fields reuse company*). */
  companyPhone?: string | null;
  /** Running-header style: dark | accent | light. Defaults to dark. */
  headerStyle?: string | null;
  /** Traffic Light Protocol level shown in the header/cover/footer: RED | AMBER | GREEN | CLEAR. */
  tlpLevel?: string | null;
  /** Finding-ID prefix, e.g. "MLPT" -> findings render as MLPT-01. Falls back to a derived code. */
  findingIdPrefix?: string | null;
  /** Assessment type label on the cover + methodology: Blackbox | Greybox | Whitebox. */
  assessmentType?: string | null;
  /** Confidentiality Notice body (bilingual); a sensible default is used when empty. */
  confidentialityText?: string | null;
  confidentialityTextId?: string | null;
  /** Terms and Conditions body (bilingual); a sensible default is used when empty. */
  termsText?: string | null;
  termsTextId?: string | null;
  /** Document Control version history rows. */
  versionHistory?: VersionHistoryRow[] | null;
  /** Document distribution list rows. */
  distributionList?: DistributionRow[] | null;
}

export interface VersionHistoryRow {
  version: string;
  date: string;
  author: string;
  changesEn?: string | null;
  changesId?: string | null;
}

export interface DistributionRow {
  positionEn: string;
  positionId?: string | null;
  company?: string | null;
  email?: string | null;
  name?: string | null;
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
    // Raw HTTP evidence captured by nuclei (proof of finding).
    request?: string | null;
    response?: string | null;
  }[];
  /** CVE ids (upper-case) present in the CISA KEV catalog (actively exploited). */
  kevCves?: string[];
  /** Subset of kevCves CISA flags as used in ransomware campaigns. */
  kevRansomwareCves?: string[];
  /** EPSS exploit probability (0..1) keyed by upper-case CVE id. */
  epss?: Record<string, number>;
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
