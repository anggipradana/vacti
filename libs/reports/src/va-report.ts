import { reportCss, escapeHtml } from './styles';
import { labels } from './i18n';
import { cover, approvalSheet, doc, sevClass, sevLabel } from './shared';
import { VULN_STATUS_LABEL, VULN_ACTIVE_STATUSES, type VulnStatusValue } from '@vacti/core';
import type { VaReportData } from './types';

const SEV_BG = ['#2563eb', '#a16207', '#b45309', '#ea580c', '#dc2626']; // info,low,med,high,crit
const activeSet = new Set<string>(VULN_ACTIVE_STATUSES);

export function renderVaReport(d: VaReportData): string {
  const l = labels(d.lang);
  const s = d.settings;
  const css = reportCss(s.primaryColor, s.secondaryColor, s.footerText ?? '', s.classification ?? '');
  const showRecon = d.type !== 'vuln';
  const showVuln = d.type !== 'recon';

  // Derive everything from the actual data.
  const sevCount = (sv: number) => d.vulns.filter((v) => v.severity === sv).length;
  const counts = { crit: sevCount(4), high: sevCount(3), med: sevCount(2), low: sevCount(1), info: sevCount(0) };
  const total = d.vulns.length;
  const active = d.vulns.filter((v) => activeSet.has(v.status)).length;
  const statusGroups = d.vulns.reduce<Record<string, number>>(
    (acc, v) => ((acc[v.status] = (acc[v.status] ?? 0) + 1), acc),
    {},
  );

  const stat = (n: number | string, label: string) =>
    `<div class="stat"><div class="n">${n}</div><div class="l">${escapeHtml(label)}</div></div>`;

  // Severity distribution bar (proportional to real counts).
  const segs = [counts.info, counts.low, counts.med, counts.high, counts.crit];
  const sevbar =
    total > 0
      ? `<div style="display:flex;height:14px;border-radius:999px;overflow:hidden;margin:6px 0 10px">${segs
          .map((n, i) =>
            n > 0 ? `<div style="width:${((n / total) * 100).toFixed(1)}%;background:${SEV_BG[i]}"></div>` : '',
          )
          .join('')}</div>`
      : '';

  const exec = `<div class="page-break"></div><h2>${escapeHtml(l.executiveSummary)}</h2>
    <p>This assessment of <strong>${escapeHtml(d.target.domain)}</strong> (scan ${escapeHtml(d.scan.status)}) surfaced
    <strong>${d.counts.endpoints}</strong> live endpoint(s), <strong>${d.counts.ports}</strong> open port(s), and
    <strong>${total}</strong> vulnerabilit${total === 1 ? 'y' : 'ies'} — ${counts.crit} critical, ${counts.high} high,
    ${counts.med} medium, ${counts.low} low, ${counts.info} info. ${active} active, ${total - active} closed/triaged.</p>
    <div>${stat(d.counts.endpoints, l.endpoints)}${stat(d.counts.ports, l.openPorts)}${stat(total, l.vulnerabilities)}${stat(counts.crit + counts.high, `${l.critical}+${l.high}`)}</div>
    ${sevbar}`;

  const summary = showVuln
    ? `<h3>${escapeHtml(l.severity)} distribution</h3>
      <table><thead><tr><th>${escapeHtml(l.severity)}</th><th>Count</th></tr></thead><tbody>
        ${[
          ['critical', l.critical, counts.crit],
          ['high', l.high, counts.high],
          ['medium', l.medium, counts.med],
          ['low', l.low, counts.low],
          ['info', l.info, counts.info],
        ]
          .map(
            ([k, lbl, n]) =>
              `<tr><td><span class="sev sev-${k}">${escapeHtml(lbl as string)}</span></td><td>${n}</td></tr>`,
          )
          .join('')}
      </tbody></table>
      <h3>${escapeHtml(l.status)} breakdown</h3>
      <p class="muted">${
        Object.keys(statusGroups).length
          ? Object.entries(statusGroups)
              .map(([st, n]) => `${escapeHtml(VULN_STATUS_LABEL[st as VulnStatusValue] ?? st)}: ${n}`)
              .join(' · ')
          : escapeHtml(l.none)
      }</p>`
    : '';

  const recon = showRecon
    ? `<div class="page-break"></div><h2>${escapeHtml(l.reconResults)}</h2>
      <h3>${escapeHtml(l.endpoints)} (${d.endpoints.length})</h3>
      <table><thead><tr><th>URL</th><th>Status</th><th>Title</th><th>Tech</th></tr></thead><tbody>
      ${
        d.endpoints
          .slice(0, 200)
          .map(
            (e) =>
              `<tr><td class="mono">${escapeHtml(e.url)}</td><td>${e.statusCode ?? ''}</td><td>${escapeHtml(e.title ?? '')}</td><td>${escapeHtml((e.tech ?? []).slice(0, 3).join(', '))}${e.isWordpress ? ' · WordPress' : ''}</td></tr>`,
          )
          .join('') || `<tr><td colspan="4" class="muted">${escapeHtml(l.none)}</td></tr>`
      }
      </tbody></table>
      <h3>${escapeHtml(l.openPorts)} (${d.ports.length})</h3>
      <p class="mono muted">${d.ports.map((p) => `${escapeHtml(p.ip)}:${p.port}`).join(', ') || escapeHtml(l.none)}</p>
      <h3>Subdomains (${d.subdomains.length})</h3>
      <p class="mono muted">${d.subdomains.map(escapeHtml).join(', ') || escapeHtml(l.none)}</p>`
    : '';

  const aiBlock = (v: VaReportData['vulns'][number]) =>
    v.isAiEnriched
      ? `${v.aiDescription ? `<div><strong>Description:</strong> ${escapeHtml(v.aiDescription)}</div>` : ''}
         ${v.aiImpact ? `<div><strong>Impact:</strong> ${escapeHtml(v.aiImpact)}</div>` : ''}
         ${v.aiRemediation ? `<div><strong>Remediation:</strong> ${escapeHtml(v.aiRemediation)}</div>` : ''}`
      : '';

  const vulns = showVuln
    ? `<div class="page-break"></div><h2>${escapeHtml(l.vulnerabilities)}</h2>
      ${
        d.vulns.length
          ? d.vulns
              .map(
                (v) => `<div class="card">
                  <div><span class="sev ${sevClass(v.severity)}">${escapeHtml(sevLabel(v.severity, d.lang))}</span>
                  <strong>${escapeHtml(v.name)}</strong>
                  <span class="muted">· ${escapeHtml(VULN_STATUS_LABEL[v.status as VulnStatusValue] ?? v.status)}</span></div>
                  ${v.url || v.matchedAt ? `<div class="mono muted">${escapeHtml(v.url ?? v.matchedAt ?? '')}</div>` : ''}
                  ${aiBlock(v)}
                </div>`,
              )
              .join('')
          : `<p class="muted">No vulnerabilities identified.</p>`
      }`
    : '';

  const body =
    cover(l.vaTitle, d.target.domain, s, {
      [l.reportDate]: new Date().toISOString().slice(0, 10),
      ...(s.documentNumber ? { [l.documentNumber]: s.documentNumber } : {}),
    }) +
    approvalSheet(d.signatories, d.lang) +
    `<div class="page-break"></div><h2>${escapeHtml(l.scope)}</h2>
      <table><tbody>
        <tr><th>${escapeHtml(l.project)}</th><td>${escapeHtml(d.target.domain)}</td></tr>
        <tr><th>${escapeHtml(l.status)}</th><td>${escapeHtml(d.scan.status)}</td></tr>
        <tr><th>Started</th><td>${d.scan.startedAt ? new Date(d.scan.startedAt).toISOString() : '—'}</td></tr>
        <tr><th>Finished</th><td>${d.scan.finishedAt ? new Date(d.scan.finishedAt).toISOString() : '—'}</td></tr>
      </tbody></table>` +
    exec +
    summary +
    recon +
    vulns +
    `<div class="end">— ${escapeHtml(l.endOfReport)} —</div>`;

  return doc(l.vaTitle, css, body);
}
