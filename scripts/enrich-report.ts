// Enrich an engagement's findings for the report: AI prose (description/business-impact/remediation) +
// curated references + CVSS 4.0, then engagement-level prose. Mirrors enrichEngagementReportAction but
// runnable standalone (server actions can't be curl'd). Usage: tsx scripts/enrich-report.ts <engagementId>
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { and, eq, inArray } from 'drizzle-orm';
import { pentestEngagements, pentestFindings, pentestEvidence } from '@vacti/db';
import { enrichPentestFinding, makeProvider, generateReportProse } from '@vacti/integrations';
import { pentestReferences, pentestCvss } from '@vacti/integrations';
import { readFileSync } from 'node:fs';

const engagementId = process.argv[2];
const DEEPSEEK = (
  process.env.DEEPSEEK_KEY ??
  readFileSync('/home/anggi/.do/deepseek_key', 'utf8').split('=')[1] ??
  ''
).trim();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const [eng] = await db.select().from(pentestEngagements).where(eq(pentestEngagements.id, engagementId));
if (!eng) {
  console.error('engagement not found');
  process.exit(1);
}
const STATUSES = ['accepted', 'reported', 'confirmed', 'inconclusive', 'needs_redo'] as const;
const rows = await db
  .select()
  .from(pentestFindings)
  .where(
    and(
      eq(pentestFindings.engagementId, engagementId),
      inArray(pentestFindings.status, STATUSES as unknown as string[]),
    ),
  );
console.log(`enriching ${rows.length} findings...`);

const provider = await makeProvider({ provider: 'deepseek', model: 'deepseek-chat', deepseekKey: DEEPSEEK });
if (!provider) {
  console.error('no AI provider');
  process.exit(1);
}

let done = 0;
for (const f of rows) {
  const set: Record<string, unknown> = {};
  set.references = pentestReferences(f.findingClass);
  if (!f.cvssVector || !/^CVSS:4\.0\//.test(f.cvssVector)) set.cvssVector = pentestCvss(f.findingClass).vector;
  if (!f.descriptionEn || f.descriptionEn.trim().length < 40) {
    const ev = await db
      .select({ captionEn: pentestEvidence.captionEn })
      .from(pentestEvidence)
      .where(eq(pentestEvidence.findingId, f.id));
    const evidenceSummary = ev
      .map((e) => e.captionEn)
      .filter(Boolean)
      .slice(0, 8)
      .join('; ');
    try {
      const e = await enrichPentestFinding(
        {
          title: f.title,
          findingClass: f.findingClass,
          severity: f.severity,
          affectedUrl: f.affectedUrl,
          evidenceSummary,
        },
        provider,
      );
      if (e.descriptionEn) {
        set.descriptionEn = e.descriptionEn;
        set.descriptionId = e.descriptionId || e.descriptionEn;
        set.businessImpactEn = e.businessImpactEn;
        set.businessImpactId = e.businessImpactId || e.businessImpactEn;
        set.remediationEn = e.remediationEn;
        set.remediationId = e.remediationId || e.remediationEn;
      }
    } catch (err) {
      console.error(`  finding ${f.title.slice(0, 40)}: ${(err as Error).message}`);
    }
  }
  await db.update(pentestFindings).set(set).where(eq(pentestFindings.id, f.id));
  done++;
  if (done % 5 === 0) console.log(`  ${done}/${rows.length}`);
}

// engagement-level prose
try {
  const fresh = await db
    .select()
    .from(pentestFindings)
    .where(
      and(
        eq(pentestFindings.engagementId, engagementId),
        inArray(pentestFindings.status, STATUSES as unknown as string[]),
      ),
    );
  const prose = await generateReportProse(
    {
      engagementName: eng.name,
      kind: eng.kind,
      scopeIn: eng.scopeIn,
      findings: fresh.map((f) => ({ title: f.title, severity: f.severity, findingClass: f.findingClass })),
    },
    provider,
  );
  if (prose)
    await db
      .update(pentestEngagements)
      .set({ aiReportProse: prose as unknown as object })
      .where(eq(pentestEngagements.id, engagementId));
  console.log('engagement-level prose generated');
} catch (err) {
  console.error(`engagement prose: ${(err as Error).message}`);
}

console.log(`DONE: enriched ${done} findings`);
await pool.end();
