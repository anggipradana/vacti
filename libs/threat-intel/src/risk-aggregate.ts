import { eq, inArray, count } from 'drizzle-orm';
import { Severity, VULN_ACTIVE_STATUSES, LEAK_UNRESOLVED_STATUSES } from '@vacti/core';
import {
  scans,
  vulnerabilities,
  targets,
  leakcheckData,
  otxThreatData,
  exposureFindings,
  type Database,
} from '@vacti/db';
import { calculateRiskScore, type RiskResult } from './risk-score';

const activeVuln = new Set<string>(VULN_ACTIVE_STATUSES);
const unresolvedLeak = new Set<string>(LEAK_UNRESOLVED_STATUSES);

/** Aggregate a project's VA + Threat-Intel data into the unified risk score (status-aware). */
export async function computeProjectRisk(db: Database, projectId: string): Promise<RiskResult> {
  const scanRows = await db.select({ id: scans.id }).from(scans).where(eq(scans.projectId, projectId));
  const scanIds = scanRows.map((s) => s.id);

  const vuln = { critical: 0, high: 0, medium: 0, low: 0 };
  if (scanIds.length) {
    const vrows = await db
      .select({ severity: vulnerabilities.severity, status: vulnerabilities.status })
      .from(vulnerabilities)
      .where(inArray(vulnerabilities.scanId, scanIds));
    for (const v of vrows) {
      if (!activeVuln.has(v.status)) continue; // only active findings feed the score
      if (v.severity === Severity.Critical) vuln.critical++;
      else if (v.severity === Severity.High) vuln.high++;
      else if (v.severity === Severity.Medium) vuln.medium++;
      else if (v.severity === Severity.Low) vuln.low++;
    }
  }

  const targetRows = await db.select({ id: targets.id }).from(targets).where(eq(targets.projectId, projectId));
  const leaks = await db.select().from(leakcheckData).where(eq(leakcheckData.projectId, projectId));
  const otx = await db.select().from(otxThreatData).where(eq(otxThreatData.projectId, projectId));
  const [exp] = await db.select({ n: count() }).from(exposureFindings).where(eq(exposureFindings.projectId, projectId));

  return calculateRiskScore({
    hasVa: scanIds.length > 0,
    vuln,
    domainCount: Math.max(1, targetRows.length),
    uncheckedLeaks: leaks.filter((l) => unresolvedLeak.has(l.status)).length,
    threatIndicators: otx.reduce((a, o) => a + o.pulses, 0),
    reputation: otx.length ? Math.max(...otx.map((o) => o.reputation)) / 100 : 0,
    malwareCount: otx.reduce((a, o) => a + o.malwareCount, 0),
    exposureFindings: Number(exp?.n ?? 0),
  });
}
