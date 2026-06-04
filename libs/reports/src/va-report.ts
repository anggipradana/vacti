import { reportCss, escapeHtml } from './styles';
import { labels } from './i18n';
import { cover, approvalSheet, doc, section, kv, scoreTiles, sevBar, sevClass, sevLabel, statusChip } from './shared';
import { VULN_STATUS_LABEL, VULN_ACTIVE_STATUSES, type VulnStatusValue } from '@vacti/core';
import type { VaReportData } from './types';

const activeSet = new Set<string>(VULN_ACTIVE_STATUSES);

export function renderVaReport(d: VaReportData): string {
  const l = labels(d.lang);
  const s = d.settings;
  const css = reportCss(s.primaryColor, s.secondaryColor, s.footerText ?? '', s.classification ?? '');
  const showRecon = d.type !== 'vuln';
  const showVuln = d.type !== 'recon';

  const sevCount = (sv: number) => d.vulns.filter((v) => v.severity === sv).length;
  const counts = { crit: sevCount(4), high: sevCount(3), med: sevCount(2), low: sevCount(1), info: sevCount(0) };
  const total = d.vulns.length;
  const active = d.vulns.filter((v) => activeSet.has(v.status)).length;
  const statusGroups = d.vulns.reduce<Record<string, number>>(
    (acc, v) => ((acc[v.status] = (acc[v.status] ?? 0) + 1), acc),
    {},
  );

  const exec = `${section('Summary', l.executiveSummary, false)}
    <p>This assessment of <strong>${escapeHtml(d.target.domain)}</strong> (scan ${escapeHtml(d.scan.status)}) identified
    <strong>${d.counts.endpoints}</strong> live endpoint(s), <strong>${d.counts.ports}</strong> open port(s), and
    <strong>${total}</strong> vulnerabilit${total === 1 ? 'y' : 'ies'}. <strong>${active}</strong> remain active;
    ${total - active} are closed or triaged.</p>
    ${showVuln ? scoreTiles(counts, d.lang) + sevBar(counts, d.lang) : ''}
    ${
      showVuln && Object.keys(statusGroups).length
        ? `<p class="muted" style="margin-top:10px">Status — ${Object.entries(statusGroups)
            .map(([st, n]) => `${escapeHtml(VULN_STATUS_LABEL[st as VulnStatusValue] ?? st)}: ${n}`)
            .join(' · ')}</p>`
        : ''
    }`;

  const recon = showRecon
    ? `${section('Reconnaissance', l.reconResults)}
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
      ${d.ports.length ? `<p class="mono muted">${d.ports.map((p) => `${escapeHtml(p.ip)}:${p.port}`).join('  ·  ')}</p>` : `<div class="empty">${escapeHtml(l.none)}</div>`}
      <h3>Subdomains (${d.subdomains.length})</h3>
      ${d.subdomains.length ? `<p class="mono muted">${d.subdomains.map(escapeHtml).join('  ·  ')}</p>` : `<div class="empty">${escapeHtml(l.none)}</div>`}`
    : '';

  const block = (label: string, text?: string | null) =>
    text
      ? `<div class="block"><div class="blabel">${escapeHtml(label)}</div><div class="btext">${escapeHtml(text)}</div></div>`
      : '';

  const findings = showVuln
    ? `${section('Findings', l.vulnerabilities)}
      ${
        d.vulns.length
          ? d.vulns
              .map((v) => {
                const cls = sevClass(v.severity);
                const loc = v.url ?? v.matchedAt ?? '';
                return `<div class="finding f-${cls}">
                  <div class="finding-head"><span class="chip ${cls}">${escapeHtml(sevLabel(v.severity, d.lang))}</span> <span class="ftitle">${escapeHtml(v.name)}</span></div>
                  <div class="finding-body">
                    <div class="finding-meta">${statusChip(VULN_STATUS_LABEL[v.status as VulnStatusValue] ?? v.status, activeSet.has(v.status))}${v.type ? ` · ${escapeHtml(v.type)}` : ''}${loc ? ` · <span class="mono">${escapeHtml(loc)}</span>` : ''}</div>
                    ${block('Description', v.aiDescription)}
                    ${block('Impact', v.aiImpact)}
                    ${block('Remediation', v.aiRemediation)}
                  </div>
                </div>`;
              })
              .join('')
          : `<div class="empty">No vulnerabilities identified.</div>`
      }`
    : '';

  const body =
    cover({
      kicker: 'Security Assessment',
      title: l.vaTitle,
      target: d.target.domain,
      settings: s,
      meta: {
        [l.reportDate]: new Date().toISOString().slice(0, 10),
        [l.status]: d.scan.status,
        ...(s.documentNumber ? { [l.documentNumber]: s.documentNumber } : {}),
        ...(s.companyName ? { Prepared: s.companyName } : {}),
      },
    }) +
    approvalSheet(d.signatories, d.lang) +
    section('Engagement', l.scope) +
    kv([
      [l.project, d.target.domain],
      [l.status, d.scan.status],
      ['Started', d.scan.startedAt ? new Date(d.scan.startedAt).toISOString() : '—'],
      ['Finished', d.scan.finishedAt ? new Date(d.scan.finishedAt).toISOString() : '—'],
    ]) +
    exec +
    recon +
    findings +
    `<div class="end">— ${escapeHtml(l.endOfReport)} —</div>`;

  return doc(l.vaTitle, css, body);
}
