/** VA vulnerability triage status (see docs/planning/05-FINDING-STATUS.md). */
export const VulnStatus = {
  Open: 'open',
  InProgress: 'in_progress',
  Reopened: 'reopened',
  Resolved: 'resolved',
  RiskAccepted: 'risk_accepted',
  FalsePositive: 'false_positive',
  NoImpact: 'no_impact',
  WafHandled: 'waf_handled',
  Duplicate: 'duplicate',
  OutOfScope: 'out_of_scope',
} as const;

export type VulnStatusValue = (typeof VulnStatus)[keyof typeof VulnStatus];

export const VULN_STATUS_LABEL: Record<VulnStatusValue, string> = {
  open: 'Open',
  in_progress: 'On Progress',
  reopened: 'Reopened',
  resolved: 'Resolved',
  risk_accepted: 'Risk Accepted',
  false_positive: 'False Positive',
  no_impact: 'No Impact',
  waf_handled: 'WAF Handled',
  duplicate: 'Duplicate',
  out_of_scope: 'Out of Scope',
};

/** Statuses that count as active risk (feed the risk score). */
export const VULN_ACTIVE_STATUSES: VulnStatusValue[] = [VulnStatus.Open, VulnStatus.InProgress, VulnStatus.Reopened];

export function isVulnStatus(s: string): s is VulnStatusValue {
  return (Object.values(VulnStatus) as string[]).includes(s);
}

/** Threat-Intel leaked-credential triage status (applies ONLY to LeakCheck findings). */
export const LeakStatus = {
  New: 'new',
  Investigating: 'investigating',
  Confirmed: 'confirmed',
  Remediated: 'remediated',
  FalsePositive: 'false_positive',
  Ignored: 'ignored',
} as const;

export type LeakStatusValue = (typeof LeakStatus)[keyof typeof LeakStatus];

export const LEAK_STATUS_LABEL: Record<LeakStatusValue, string> = {
  new: 'New',
  investigating: 'Investigating',
  confirmed: 'Confirmed',
  remediated: 'Remediated',
  false_positive: 'False Positive',
  ignored: 'Ignored',
};

/** Leak statuses that still drive the credential-exposure component. */
export const LEAK_UNRESOLVED_STATUSES: LeakStatusValue[] = [
  LeakStatus.New,
  LeakStatus.Investigating,
  LeakStatus.Confirmed,
];

export function isLeakStatus(s: string): s is LeakStatusValue {
  return (Object.values(LeakStatus) as string[]).includes(s);
}
