import { reportCss, escapeHtml } from './styles';
import { labels } from './i18n';
import { cover, approvalCards, doc, section, kv, statRow, sevBarLegend, findingCard } from './shared';
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

  const exec = `${section('02', l.executiveSummary, 'Overview')}
    <p>This assessment of <strong>${escapeHtml(d.target.domain)}</strong> (scan ${escapeHtml(d.scan.status)}) identified
    <strong>${d.counts.endpoints}</strong> live endpoint(s), <strong>${d.counts.ports}</strong> open port(s) and
    <strong>${total}</strong> vulnerabilit${total === 1 ? 'y' : 'ies'}; <strong>${active}</strong> remain active.</p>
    ${statRow([
      { value: d.counts.endpoints, label: l.endpoints },
      { value: d.counts.ports, label: l.openPorts },
      { value: total, label: l.vulnerabilities },
      { value: active, label: 'Active' },
    ])}
    ${showVuln ? sevBarLegend(counts, d.lang) : ''}
    ${
      showVuln && Object.keys(statusGroups).length
        ? `<div class="note" style="margin-top:14px">Status — ${Object.entries(statusGroups)
            .map(([st, n]) => `${escapeHtml(VULN_STATUS_LABEL[st as VulnStatusValue] ?? st)}: ${n}`)
            .join(' · ')}</div>`
        : ''
    }`;

  const recon = showRecon
    ? `${section('03', l.reconResults, 'Discovery')}
      <h3>${escapeHtml(l.endpoints)} · ${d.endpoints.length}</h3>
      <table><thead><tr><th>URL</th><th>Status</th><th>Title</th><th>Tech</th></tr></thead><tbody>
      ${
        d.endpoints
          .slice(0, 200)
          .map(
            (e) =>
              `<tr><td class="mono">${escapeHtml(e.url)}</td><td>${e.statusCode ?? ''}</td><td>${escapeHtml(e.title ?? '')}</td><td>${escapeHtml((e.tech ?? []).slice(0, 3).join(', '))}${e.isWordpress ? ' · WordPress' : ''}</td></tr>`,
          )
          .join('') || `<tr><td colspan="4" class="idx">${escapeHtml(l.none)}</td></tr>`
      }
      </tbody></table>
      <h3 style="margin-top:18px">${escapeHtml(l.openPorts)} · ${d.ports.length}</h3>
      ${d.ports.length ? `<p class="mono" style="color:#5b7480">${d.ports.map((p) => `${escapeHtml(p.ip)}:${p.port}`).join('   ')}</p>` : `<div class="empty">${escapeHtml(l.none)}</div>`}
      <h3 style="margin-top:18px">Subdomains · ${d.subdomains.length}</h3>
      ${d.subdomains.length ? `<p class="mono" style="color:#5b7480">${d.subdomains.map(escapeHtml).join('   ')}</p>` : `<div class="empty">${escapeHtml(l.none)}</div>`}`
    : '';

  const findings = showVuln
    ? `${section('04', l.vulnerabilities, 'Findings')}
      ${
        d.vulns.length
          ? d.vulns
              .map((v, i) =>
                findingCard({
                  index: i + 1,
                  severity: v.severity,
                  lang: d.lang,
                  title: v.name,
                  tags: [VULN_STATUS_LABEL[v.status as VulnStatusValue] ?? v.status, ...(v.type ? [v.type] : [])],
                  blocks: [
                    { label: 'Location', text: v.url ?? v.matchedAt ?? '' },
                    { label: 'Description', text: v.aiDescription ?? '' },
                    { label: 'Impact', text: v.aiImpact ?? '' },
                    { label: 'Remediation', text: v.aiRemediation ?? '' },
                  ],
                }),
              )
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
        Findings: String(total),
      },
    }) +
    approvalCards(d.signatories, d.lang) +
    section('01', l.scope, 'Engagement') +
    kv([
      [l.project, d.target.domain],
      [l.status, d.scan.status],
      ['Started', d.scan.startedAt ? new Date(d.scan.startedAt).toISOString().slice(0, 19).replace('T', ' ') : '—'],
      ['Finished', d.scan.finishedAt ? new Date(d.scan.finishedAt).toISOString().slice(0, 19).replace('T', ' ') : '—'],
    ]) +
    exec +
    recon +
    findings +
    `<div class="end">— ${escapeHtml(l.endOfReport)} —</div>`;

  return doc(l.vaTitle, css, body);
}
