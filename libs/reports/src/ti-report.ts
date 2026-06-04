import { reportCss, escapeHtml } from './styles';
import { labels } from './i18n';
import { cover, approvalCards, doc, section, statRow } from './shared';
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
  const score = Math.max(0, Math.min(100, d.risk.score));
  const riskColor = d.risk.color === 'red' ? '#DC2626' : d.risk.color === 'yellow' ? '#D97706' : '#059669';
  const riskTint = d.risk.color === 'red' ? '#fef2f2' : d.risk.color === 'yellow' ? '#fffbeb' : '#f0fdf4';
  const level = score >= 71 ? 'HIGH' : score >= 31 ? 'MEDIUM' : 'LOW';
  const leakGroups = d.leaks.reduce<Record<string, number>>((a, x) => ((a[x.status] = (a[x.status] ?? 0) + 1), a), {});
  const muted = 'style="color:#5b7480"';

  const exec = `${section('01', l.executiveSummary, 'Overview')}
    <p>Threat-intelligence assessment for <strong>${escapeHtml(d.project.name)}</strong>, drawing on
    ${d.totals.pulses} threat pulse(s), ${d.totals.malware} malware reference(s), and ${d.totals.leaks} leaked credential(s).</p>
    <div class="risk-wrap">
      <div class="risk-num" style="color:${riskColor}">${score}</div>
      <div class="risk-meter"><div style="width:${score}%;background:${riskColor}"></div></div>
      <div class="risk-level" style="background:${riskTint};color:${riskColor}">${level} · ${score}/100</div>
    </div>
    ${statRow([
      { value: d.totals.pulses, label: 'OTX pulses' },
      { value: d.totals.malware, label: 'Malware' },
      { value: d.totals.leaks, label: 'Leaked creds' },
      { value: d.indicators.length, label: 'Indicators' },
    ])}
    ${
      d.risk.components
        ? `<h3 style="margin-top:18px">Risk score components</h3><table><thead><tr><th>Component</th><th style="text-align:right">Score</th></tr></thead><tbody>
          ${
            Object.entries(d.risk.components)
              .filter(([, v]) => v > 0)
              .map(
                ([k, v]) =>
                  `<tr><td>${escapeHtml(COMPONENT_LABEL[k] ?? k)}</td><td style="text-align:right">${Math.round(v)}</td></tr>`,
              )
              .join('') || '<tr><td colspan="2" class="idx">No active risk contributors.</td></tr>'
          }
          </tbody></table>`
        : ''
    }`;

  const ioc = `${section('02', l.iocTitle, 'Threat Data')}
    <table><thead><tr><th>Indicator</th><th>Pulses</th><th>Malware</th><th>Reputation</th></tr></thead><tbody>
    ${d.otx.map((o) => `<tr><td class="mono">${escapeHtml(o.indicator)}</td><td>${o.pulses}</td><td>${o.malwareCount}</td><td>${o.reputation}</td></tr>`).join('') || `<tr><td colspan="4" class="idx">${escapeHtml(l.none)} — configure OTX_API_KEY to populate.</td></tr>`}
    </tbody></table>
    ${d.indicators.length ? `<h3 style="margin-top:18px">Manual indicators (${d.indicators.length})</h3><table><thead><tr><th>Type</th><th>Value</th></tr></thead><tbody>${d.indicators.map((i) => `<tr><td>${escapeHtml(i.type)}</td><td class="mono">${escapeHtml(i.value)}</td></tr>`).join('')}</tbody></table>` : ''}`;

  const breach = `${section('03', l.breachTitle, 'Exposure')}
    <p ${muted}>${d.leaks.length} leaked credential(s)${
      Object.keys(leakGroups).length
        ? ` — ${Object.entries(leakGroups)
            .map(([k, n]) => `${escapeHtml(k)}: ${n}`)
            .join(' · ')}`
        : ''
    }.</p>
    ${
      d.leaks.length
        ? `<table><thead><tr><th>Identifier</th><th>Source</th><th>${escapeHtml(l.status)}</th></tr></thead><tbody>
          ${d.leaks
            .slice(0, 200)
            .map(
              (x) =>
                `<tr><td class="mono">${escapeHtml(x.identifier)}</td><td>${escapeHtml(x.source ?? '')}</td><td>${escapeHtml(x.status)}</td></tr>`,
            )
            .join('')}
          </tbody></table>`
        : `<div class="empty">${escapeHtml(l.none)} — configure LEAKCHECK_API_KEY to populate.</div>`
    }`;

  const recs = `${section('04', l.recommendations, 'Actions')}
    <ul>
      ${d.totals.leaks ? '<li>Force-reset and rotate exposed credentials; enforce MFA on affected accounts.</li>' : ''}
      ${d.totals.malware ? '<li>Investigate malware associations against affected hosts and block related IoCs.</li>' : ''}
      ${score >= 31 ? '<li>Prioritise remediation of active findings driving the elevated risk score.</li>' : ''}
      <li>Maintain continuous threat-intelligence monitoring and schedule periodic re-assessment.</li>
    </ul>`;

  const body =
    cover({
      kicker: 'Threat Intelligence',
      title: l.tiTitle,
      target: d.project.name,
      settings: s,
      meta: {
        [l.reportDate]: new Date().toISOString().slice(0, 10),
        [l.riskScore]: `${score} / 100 · ${level}`,
        Leaks: String(d.totals.leaks),
      },
    }) +
    approvalCards(d.signatories, d.lang) +
    exec +
    ioc +
    breach +
    recs +
    `<div class="end">— ${escapeHtml(l.endOfReport)} —</div>`;

  return doc(l.tiTitle, css, body);
}
