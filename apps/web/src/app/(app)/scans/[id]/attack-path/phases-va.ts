// Kill-chain phase inference for the VA Attack Path visualization. VA `vulnerabilities` have no explicit
// phase or findingClass column, so we INFER a phase from a finding's nuclei classifications (tags,
// templateId, name) via lowercase keyword matching. The Phase union, phaseLabel + SEVERITY_COLOR are
// reused from the AI-Pentest attack-path so both visualizations share the same five ordered phases.

import { type Phase, phaseLabel, SEVERITY_COLOR } from '../../../pentest/[id]/attack-path/phases';

export { phaseLabel, SEVERITY_COLOR };
export type { Phase };

// Severity is an int 0-4 on VA findings (4=critical .. 0=info). Map it to the severity name used as the
// SEVERITY_COLOR key so the shared color table applies directly.
const SEVERITY_NAME = ['info', 'low', 'medium', 'high', 'critical'] as const;
export type SeverityName = (typeof SEVERITY_NAME)[number];

export function severityName(severity: number): SeverityName {
  return SEVERITY_NAME[Math.max(0, Math.min(4, severity))] ?? 'info';
}

// Phase -> keyword set. Checked in order; the first phase whose keyword hits a substring of the combined
// (tags + templateId + name), lowercased, wins. Initial-access keywords are checked before recon so an
// "rce"/"sqli" template is not swallowed by a generic "detect"/"info" recon tag it also carries.
const PHASE_KEYWORDS: Array<{ phase: Phase; keywords: string[] }> = [
  {
    phase: 'impact',
    keywords: ['ransom', 'defacement', 'deface', 'dos', 'denial-of-service', 'denial_of_service'],
  },
  {
    phase: 'privilege_escalation',
    keywords: ['privesc', 'privilege', 'sudo', 'suid', 'escalation'],
  },
  {
    phase: 'lateral_movement',
    keywords: ['smb', 'rmi', 'share', 'network', 'proxy', 'lateral', 'pivot'],
  },
  {
    phase: 'initial_access',
    keywords: [
      'rce',
      'sqli',
      'sql-injection',
      'sql_injection',
      'lfi',
      'rfi',
      'ssrf',
      'xxe',
      'injection',
      'default-login',
      'default-credential',
      'weak-credential',
      'auth-bypass',
      'unauth',
      'upload',
      'webshell',
      'backdoor',
      'deserialization',
    ],
  },
  {
    phase: 'recon',
    keywords: ['exposure', 'tech', 'ssl', 'tls', 'misconfig', 'info', 'disclosure', 'default-page', 'detect'],
  },
];

/**
 * Infer a kill-chain phase for a VA finding from its tags, templateId and name (case-insensitive). Checked
 * in PHASE_KEYWORDS order; default for an unknown classification is `recon`.
 */
export function inferPhaseVa(input: { tags: string[]; templateId: string; name: string }): Phase {
  const haystack = [...input.tags, input.templateId, input.name].join(' ').toLowerCase();
  for (const { phase, keywords } of PHASE_KEYWORDS) {
    if (keywords.some((k) => haystack.includes(k))) return phase;
  }
  return 'recon';
}
