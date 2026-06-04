import { reportCss, escapeHtml } from './styles';
import { labels } from './i18n';
import { cover, approvalSheet, doc, sevClass, sevLabel } from './shared';
import type { VaReportData } from './types';

export function renderVaReport(d: VaReportData): string {
  const l = labels(d.lang);
  const s = d.settings;
  const css = reportCss(s.primaryColor, s.secondaryColor, s.footerText ?? '', s.classification ?? '');
  const showRecon = d.type !== 'vuln';
  const showVuln = d.type !== 'recon';
  const [crit, high, med, low, info] = d.severityCounts;
  const total = crit + high + med + low + info;

  const stat = (n: number, label: string) =>
    `<div class="stat"><div class="n">${n}</div><div class="l">${escapeHtml(label)}</div></div>`;

  const summary = `<div class="page-break"></div><h2>${escapeHtml(l.summaryOfFindings)}</h2>
    <div>${stat(d.counts.endpoints, l.endpoints)}${stat(d.counts.ports, l.openPorts)}${stat(total, l.vulnerabilities)}${stat(crit + high, `${l.critical}+${l.high}`)}</div>
    <table><thead><tr><th>${escapeHtml(l.severity)}</th><th>Count</th></tr></thead><tbody>
      <tr><td><span class="sev sev-critical">${escapeHtml(l.critical)}</span></td><td>${crit}</td></tr>
      <tr><td><span class="sev sev-high">${escapeHtml(l.high)}</span></td><td>${high}</td></tr>
      <tr><td><span class="sev sev-medium">${escapeHtml(l.medium)}</span></td><td>${med}</td></tr>
      <tr><td><span class="sev sev-low">${escapeHtml(l.low)}</span></td><td>${low}</td></tr>
      <tr><td><span class="sev sev-info">${escapeHtml(l.info)}</span></td><td>${info}</td></tr>
    </tbody></table>`;

  const recon = showRecon
    ? `<div class="page-break"></div><h2>${escapeHtml(l.reconResults)}</h2>
      <h3>${escapeHtml(l.endpoints)} (${d.endpoints.length})</h3>
      <table><thead><tr><th>URL</th><th>Status</th><th>Title</th></tr></thead><tbody>
      ${
        d.endpoints
          .slice(0, 200)
          .map(
            (e) =>
              `<tr><td class="mono">${escapeHtml(e.url)}</td><td>${e.statusCode ?? ''}</td><td>${escapeHtml(e.title ?? '')}</td></tr>`,
          )
          .join('') || `<tr><td colspan="3" class="muted">${escapeHtml(l.none)}</td></tr>`
      }
      </tbody></table>`
    : '';

  const vulns = showVuln
    ? `<div class="page-break"></div><h2>${escapeHtml(l.vulnerabilities)}</h2>
      ${
        d.vulns.length
          ? d.vulns
              .map(
                (v) =>
                  `<div class="card"><div><span class="sev ${sevClass(v.severity)}">${escapeHtml(sevLabel(v.severity, d.lang))}</span> <strong>${escapeHtml(v.name)}</strong> <span class="muted">· ${escapeHtml(v.status)}</span></div>${v.matchedAt ? `<div class="mono muted">${escapeHtml(l.matchedAt)}: ${escapeHtml(v.matchedAt)}</div>` : ''}</div>`,
              )
              .join('')
          : `<p class="muted">${escapeHtml(l.none)}</p>`
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
    summary +
    recon +
    vulns +
    `<div class="end">— ${escapeHtml(l.endOfReport)} —</div>`;

  return doc(l.vaTitle, css, body);
}
