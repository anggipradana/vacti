import { createHash } from 'node:crypto';
import { sql, eq } from 'drizzle-orm';
import {
  scans,
  scanActivity,
  subdomains,
  discoveredUrls,
  exposureFindings,
  ipResolutions,
  ipResolutionSightings,
  type Database,
} from '@vacti/db';
import { fetchVtDomainReport, discoverSubdomains, harvestUndetectedUrls, harvestResolutions } from './virustotal';
import { fetchWaybackUrls } from './wayback';
import { categorizeUrl, buildSuffixIndex } from './categorize';
import { scanExposure } from './exposure';

export interface PassiveScanInput {
  scanId: string;
  projectId: string;
  targetId: string;
  domain: string;
  /** VirusTotal API key (optional — Wayback works without it). */
  vtApiKey?: string | null;
  /** Cap archived URLs pulled from Wayback (0 = unlimited). */
  waybackLimit?: number;
  /** Cap URLs scanned for exposure (bounds work on huge archives). */
  exposureLimit?: number;
  signal?: AbortSignal;
}

export interface PassiveScanResult {
  hosts: string[];
  counts: { passiveSubdomains: number; discoveredUrls: number; exposureFindings: number; ipResolutions: number };
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const norm = (d: string) => d.toLowerCase().replace(/\.$/, '').trim();
const hostOf = (u: string): string | null => {
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.toLowerCase();
  } catch {
    return null;
  }
};

/**
 * Passive recon: pull VirusTotal (passive DNS) + Wayback (archived URLs), consolidate & store
 * discovered URLs (categorised), passive-DNS IP resolutions, and exposure findings (regex over URL
 * strings). Writes scan_activity, merges scans.counts, and returns the discovered host list (so
 * `full` mode can feed it into the active pipeline). Does NOT set terminal scan status — the caller
 * (worker) owns that. Cancellable via signal.
 */
export async function runPassiveScan(
  input: PassiveScanInput,
  deps: { db: Database; onProgress?: (stage: string, message: string) => void },
): Promise<PassiveScanResult> {
  const { db } = deps;
  const target = norm(input.domain);
  const waybackLimit = input.waybackLimit ?? 20_000;
  const exposureLimit = input.exposureLimit ?? 50_000;
  const suffixIdx = buildSuffixIndex();

  const checkAbort = () => {
    if (input.signal?.aborted) throw new Error('cancelled');
  };
  const activity = async (stage: string, status: string, message?: string) => {
    await db.insert(scanActivity).values({ scanId: input.scanId, stage, status, message });
    deps.onProgress?.(stage, message ?? status);
  };

  const hostSet = new Set<string>([target]);
  const urlMap = new Map<string, { url: string; date: Date | null; sources: Set<string> }>();
  const resolutions: { ip: string; host: string; at: Date }[] = [];

  // ── VirusTotal (optional) ──
  checkAbort();
  if (input.vtApiKey) {
    await activity('virustotal', 'running');
    const r = await fetchVtDomainReport({ apiKey: input.vtApiKey, domain: target });
    if (r.status === 200) {
      for (const h of discoverSubdomains(r.data, target)) hostSet.add(h);
      for (const { url, date } of harvestUndetectedUrls(r.data)) {
        const h = hostOf(url);
        if (!h || (h !== target && !h.endsWith(`.${target}`))) continue;
        const ex = urlMap.get(url) ?? { url, date, sources: new Set<string>() };
        if (!ex.date && date) ex.date = date;
        ex.sources.add('virustotal');
        urlMap.set(url, ex);
      }
      for (const res of harvestResolutions(r.data))
        resolutions.push({ ip: res.ipAddress, host: target, at: res.lastResolved });
      await activity('virustotal', 'completed', `${hostSet.size - 1} subdomains, ${resolutions.length} IP resolutions`);
    } else {
      await activity('virustotal', 'failed', `VT status ${r.status}`);
    }
  } else {
    await activity('virustotal', 'skipped', 'no VirusTotal API key');
  }

  // ── Wayback ──
  checkAbort();
  await activity('wayback', 'running');
  const wb = await fetchWaybackUrls(target, { limit: waybackLimit });
  for (const url of wb) {
    const h = hostOf(url);
    if (!h || (h !== target && !h.endsWith(`.${target}`))) continue;
    hostSet.add(h);
    const ex = urlMap.get(url) ?? { url, date: null, sources: new Set<string>() };
    ex.sources.add('wayback');
    urlMap.set(url, ex);
  }
  await activity('wayback', 'completed', `${wb.length} archived URLs`);

  // ── Consolidate: subdomains ──
  checkAbort();
  const hosts = [...hostSet].filter(Boolean);
  const passiveSubs = hosts.filter((h) => h !== target);
  if (passiveSubs.length) {
    await db
      .insert(subdomains)
      .values(passiveSubs.map((host) => ({ scanId: input.scanId, host, source: 'passive' })))
      .onConflictDoNothing();
  }

  // ── Discovered URLs (categorised) ──
  checkAbort();
  const urls = [...urlMap.values()];
  if (urls.length) {
    const rows = urls.map((u) => {
      const cat = categorizeUrl(u.url, suffixIdx);
      return {
        projectId: input.projectId,
        targetId: input.targetId,
        scanId: input.scanId,
        host: hostOf(u.url),
        urlText: u.url,
        urlSha256: sha256(`${input.projectId}:${u.url}`),
        sources: [...u.sources],
        pathnameExtension: cat.extension,
        categorySlug: cat.categorySlug,
        externalSeenAt: u.date,
      };
    });
    // Chunk inserts (archives can be large).
    for (let i = 0; i < rows.length; i += 1000) {
      await db
        .insert(discoveredUrls)
        .values(rows.slice(i, i + 1000))
        .onConflictDoUpdate({
          target: [discoveredUrls.projectId, discoveredUrls.urlSha256],
          set: {
            scanId: sql`excluded.scan_id`,
            sources: sql`excluded.sources`,
            categorySlug: sql`excluded.category_slug`,
          },
        });
    }
  }
  await activity('consolidate', 'completed', `${urls.length} URLs, ${passiveSubs.length} subdomains`);

  // ── IP resolutions (passive DNS) ──
  checkAbort();
  for (const res of resolutions) {
    const [row] = await db
      .insert(ipResolutions)
      .values({ projectId: input.projectId, ipAddress: res.ip, latestResolvedAt: res.at })
      .onConflictDoUpdate({
        target: [ipResolutions.projectId, ipResolutions.ipAddress],
        set: {
          latestResolvedAt: sql`greatest(${ipResolutions.latestResolvedAt}, excluded.latest_resolved_at)`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: ipResolutions.id });
    if (row) {
      await db
        .insert(ipResolutionSightings)
        .values({ ipResolutionId: row.id, scanId: input.scanId, hostname: res.host, lastResolvedAt: res.at })
        .onConflictDoUpdate({
          target: [ipResolutionSightings.ipResolutionId, ipResolutionSightings.hostname],
          set: { lastResolvedAt: sql`greatest(${ipResolutionSightings.lastResolvedAt}, excluded.last_resolved_at)` },
        });
    }
  }

  // ── Exposure findings (regex over URL strings) ──
  checkAbort();
  await activity('exposure', 'running');
  let findingCount = 0;
  const findingRows: (typeof exposureFindings.$inferInsert)[] = [];
  for (const u of urls.slice(0, exposureLimit)) {
    for (const hit of scanExposure(u.url)) {
      findingRows.push({
        projectId: input.projectId,
        scanId: input.scanId,
        source: 'url',
        findingType: hit.type,
        snippet: hit.snippet,
        urlText: u.url,
      });
    }
  }
  if (findingRows.length) {
    for (let i = 0; i < findingRows.length; i += 1000) {
      const res = await db
        .insert(exposureFindings)
        .values(findingRows.slice(i, i + 1000))
        .onConflictDoNothing()
        .returning({ id: exposureFindings.id });
      findingCount += res.length;
    }
  }
  await activity('exposure', 'completed', `${findingCount} exposure finding(s)`);

  const counts = {
    passiveSubdomains: passiveSubs.length,
    discoveredUrls: urls.length,
    exposureFindings: findingCount,
    ipResolutions: resolutions.length,
  };
  // Merge into scans.counts (preserve any active-pipeline counts).
  await db
    .update(scans)
    .set({ counts: sql`coalesce(${scans.counts}, '{}'::jsonb) || ${JSON.stringify(counts)}::jsonb` })
    .where(eq(scans.id, input.scanId));

  return { hosts, counts };
}
