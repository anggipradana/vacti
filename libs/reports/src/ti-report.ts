import { reportCss, escapeHtml } from './styles';
import { labels } from './i18n';
import { cover, approvalSheet, doc } from './shared';
import type { TiReportData } from './types';

export function renderTiReport(d: TiReportData): string {
  const l = labels(d.lang);
  const s = d.settings;
  const css = reportCss(s.primaryColor, s.secondaryColor, s.footerText ?? '', s.classification ?? '');
  const riskColor = d.risk.color === 'red' ? '#dc2626' : d.risk.color === 'yellow' ? '#d97706' : '#059669';
  const stat = (n: number, label: string) =>
    `<div class="stat"><div class="n">${n}</div><div class="l">${escapeHtml(label)}</div></div>`;

  const exec = `<div class="page-break"></div><h2>${escapeHtml(l.executiveSummary)}</h2>
    <div>${stat(d.risk.score, l.riskScore)}${stat(d.totals.pulses, 'OTX pulses')}${stat(d.totals.malware, 'Malware')}${stat(d.totals.leaks, 'Leaked creds')}</div>
    <div class="risk-meter"><div style="width:${Math.max(0, Math.min(100, d.risk.score))}%;background:${riskColor}"></div></div>
    <p style="text-align:center;font-size:14pt;font-weight:700;color:${riskColor}">${d.risk.score} / 100</p>`;

  const ioc = `<div class="page-break"></div><h2>${escapeHtml(l.iocTitle)}</h2>
    <table><thead><tr><th>Indicator</th><th>Pulses</th><th>Malware</th><th>Reputation</th></tr></thead><tbody>
    ${d.otx.map((o) => `<tr><td class="mono">${escapeHtml(o.indicator)}</td><td>${o.pulses}</td><td>${o.malwareCount}</td><td>${o.reputation}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">${escapeHtml(l.none)}</td></tr>`}
    </tbody></table>
    ${d.indicators.length ? `<h3>Manual indicators</h3><table><thead><tr><th>Type</th><th>Value</th></tr></thead><tbody>${d.indicators.map((i) => `<tr><td>${escapeHtml(i.type)}</td><td class="mono">${escapeHtml(i.value)}</td></tr>`).join('')}</tbody></table>` : ''}`;

  const breach = `<div class="page-break"></div><h2>${escapeHtml(l.breachTitle)}</h2>
    <table><thead><tr><th>Identifier</th><th>Source</th><th>${escapeHtml(l.status)}</th></tr></thead><tbody>
    ${d.leaks.map((x) => `<tr><td class="mono">${escapeHtml(x.identifier)}</td><td>${escapeHtml(x.source ?? '')}</td><td>${escapeHtml(x.status)}</td></tr>`).join('') || `<tr><td colspan="3" class="muted">${escapeHtml(l.none)}</td></tr>`}
    </tbody></table>`;

  const recs = `<div class="page-break"></div><h2>${escapeHtml(l.recommendations)}</h2>
    <ul>
      ${d.totals.leaks ? '<li>Force-reset and rotate all exposed credentials; enable MFA.</li>' : ''}
      ${d.totals.malware ? '<li>Investigate malware associations against affected hosts.</li>' : ''}
      <li>Maintain continuous threat-intelligence monitoring and periodic re-assessment.</li>
    </ul>`;

  const body =
    cover(l.tiTitle, d.project.name, s, {
      [l.reportDate]: new Date().toISOString().slice(0, 10),
      ...(s.documentNumber ? { [l.documentNumber]: s.documentNumber } : {}),
      ...(s.classification ? { [l.classification]: s.classification } : {}),
    }) +
    approvalSheet(d.signatories, d.lang) +
    exec +
    ioc +
    breach +
    recs +
    `<div class="end">— ${escapeHtml(l.endOfReport)} —</div>`;

  return doc(l.tiTitle, css, body);
}
