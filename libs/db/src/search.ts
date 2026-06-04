import { ilike, or, desc } from 'drizzle-orm';
import type { Database } from './client';
import { projects } from './schema';
import { targets, subdomains, endpoints, vulnerabilities } from './recon-schema';

export interface SearchHit {
  kind: 'project' | 'target' | 'scan' | 'subdomain' | 'endpoint' | 'vulnerability';
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

export interface SearchResults {
  query: string;
  hits: SearchHit[];
}

/** Universal search across the main resources (case-insensitive substring), capped per category. */
export async function searchAll(db: Database, query: string, perCategory = 10): Promise<SearchResults> {
  const q = query.trim();
  if (!q) return { query: q, hits: [] };
  const like = `%${q}%`;
  const [proj, tgt, sub, ep, vuln] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(or(ilike(projects.name, like), ilike(projects.slug, like)))
      .limit(perCategory),
    db.select().from(targets).where(ilike(targets.domain, like)).limit(perCategory),
    db.select().from(subdomains).where(ilike(subdomains.host, like)).limit(perCategory),
    db
      .select()
      .from(endpoints)
      .where(or(ilike(endpoints.url, like), ilike(endpoints.title, like)))
      .limit(perCategory),
    db
      .select()
      .from(vulnerabilities)
      .where(ilike(vulnerabilities.name, like))
      .orderBy(desc(vulnerabilities.severity))
      .limit(perCategory),
  ]);
  const hits: SearchHit[] = [
    ...proj.map((p) => ({ kind: 'project' as const, id: p.id, label: p.name, sublabel: p.slug, href: `/projects` })),
    ...tgt.map((t) => ({ kind: 'target' as const, id: t.id, label: t.domain, href: `/targets/${t.id}` })),
    ...sub.map((s) => ({ kind: 'subdomain' as const, id: s.id, label: s.host, href: `/scans/${s.scanId}` })),
    ...ep.map((e) => ({
      kind: 'endpoint' as const,
      id: e.id,
      label: e.url,
      sublabel: e.title ?? undefined,
      href: `/scans/${e.scanId}`,
    })),
    ...vuln.map((v) => ({
      kind: 'vulnerability' as const,
      id: v.id,
      label: v.name,
      sublabel: v.url ?? v.matchedAt ?? undefined,
      href: `/scans/${v.scanId}`,
    })),
  ];
  return { query: q, hits };
}
