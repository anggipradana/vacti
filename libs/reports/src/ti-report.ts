import { reportCss, escapeHtml } from './styles';
import { labels } from './i18n';
import { cover, approvalSheet, doc } from './shared';
import type { TiReportData } from './types';

const COMPONENT_LABEL: Record<string, string> = {
  va: 'Vulnerability Assessment',
  leak: 'Credential Exposure',
  exposure: 'Threat Exposure',
  reputation: 'Domain Reputation',
  malware: 'Malware Association',
};

export function renderTiReport(d: TiReportData): string {
  const l = labels(d.lang);
  const s = d.settings;
  const css = reportCss(s.primaryColor, s.secondaryColor, s.footerText ?? '', s.classification ?? '');
  const riskColor = d.risk.color === 'red' ? '#dc2626' : d.risk.color === 'yellow' ? '#d97706' : '#059669';
  const level = d.risk.score >= 71 ? 'HIGH' : d.risk.score >= 31 ? 'MEDIUM' : 'LOW';
  const stat = (n: number | string, label: string) =>
    `<div class="stat"><div class="n">${n}</div><div class="l">${escapeHtml(label)}</div></div>`;
  const leakGroups = d.leaks.reduce<Record<string, number>>((a, x) => ((a[x.status] = (a[x.status] ?? 0) + 1), a), {});

  const exec = `<div class="page-break"></div><h2>${escapeHtml(l.executiveSummary)}</h2>
    <p>Threat-intelligence assessment for <strong>${escapeHtml(d.project.name)}</strong>. Overall risk is
    <strong style="color:${riskColor}">${level}</strong> at <strong>${d.risk.score}/100</strong>, derived from
    ${d.totals.pulses} threat pulse(s), ${d.totals.malware} malware reference(s), and ${d.totals.leaks} leaked credential(s).</p>
    <div>${stat(d.risk.score, l.riskScore)}${stat(d.totals.pulses, 'OTX pulses')}${stat(d.totals.malware, 'Malware')}${stat(d.totals.leaks, 'Leaked creds')}</div>
    <div class="risk-meter"><div style="width:${Math.max(0, Math.min(100, d.risk.score))}%;background:${riskColor}"></div></div>
    <p style="text-align:center;font-size:14pt;font-weight:700;color:${riskColor}">${d.risk.score} / 100 · ${level}</p>
    ${
      d.risk.components
        ? `<h3>Risk score components</h3><table><thead><tr><th>Component</th><th>Score</th></tr></thead><tbody>
          ${
            Object.entries(d.risk.components)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `<tr><td>${escapeHtml(COMPONENT_LABEL[k] ?? k)}</td><td>${Math.round(v)}</td></tr>`)
              .join('') || '<tr><td colspan="2" class="muted">No active risk contributors.</td></tr>'
          }
          </tbody></table>`
        : ''
    }`;

  const ioc = `<div class="page-break"></div><h2>${escapeHtml(l.iocTitle)}</h2>
    <table><thead><tr><th>Indicator</th><th>Pulses</th><th>Malware</th><th>Reputation</th></tr></thead><tbody>
    ${d.otx.map((o) => `<tr><td class="mono">${escapeHtml(o.indicator)}</td><td>${o.pulses}</td><td>${o.malwareCount}</td><td>${o.reputation}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">${escapeHtml(l.none)} — configure OTX_API_KEY to populate.</td></tr>`}
    </tbody></table>
    ${d.indicators.length ? `<h3>Manual indicators (${d.indicators.length})</h3><table><thead><tr><th>Type</th><th>Value</th></tr></thead><tbody>${d.indicators.map((i) => `<tr><td>${escapeHtml(i.type)}</td><td class="mono">${escapeHtml(i.value)}</td></tr>`).join('')}</tbody></table>` : ''}`;

  const breach = `<div class="page-break"></div><h2>${escapeHtml(l.breachTitle)}</h2>
    <p class="muted">${d.leaks.length} leaked credential(s)${
      Object.keys(leakGroups).length
        ? ` — ${Object.entries(leakGroups)
            .map(([k, n]) => `${k}: ${n}`)
            .join(' · ')}`
        : ''
    }.</p>
    <table><thead><tr><th>Identifier</th><th>Source</th><th>${escapeHtml(l.status)}</th></tr></thead><tbody>
    ${
      d.leaks
        .slice(0, 200)
        .map(
          (x) =>
            `<tr><td class="mono">${escapeHtml(x.identifier)}</td><td>${escapeHtml(x.source ?? '')}</td><td>${escapeHtml(x.status)}</td></tr>`,
        )
        .join('') ||
      `<tr><td colspan="3" class="muted">${escapeHtml(l.none)} — configure LEAKCHECK_API_KEY to populate.</td></tr>`
    }
    </tbody></table>`;

  const recs = `<div class="page-break"></div><h2>${escapeHtml(l.recommendations)}</h2>
    <ul>
      ${d.totals.leaks ? '<li>Force-reset and rotate exposed credentials; enforce MFA on affected accounts.</li>' : ''}
      ${d.totals.malware ? '<li>Investigate malware associations against affected hosts and block related IoCs.</li>' : ''}
      ${d.risk.score >= 31 ? '<li>Prioritise remediation of active findings driving the elevated risk score.</li>' : ''}
      <li>Maintain continuous threat-intelligence monitoring and schedule periodic re-assessment.</li>
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
