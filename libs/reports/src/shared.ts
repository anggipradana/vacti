import { escapeHtml, SEV_KEYS, SEV_HEX } from './styles';
import { labels, type Lang } from './i18n';
import type { ReportSettings, Signatory } from './types';

export function sevClass(sev: number): string {
  return SEV_KEYS[Math.max(0, Math.min(4, sev))] ?? 'info';
}
export function sevLabel(sev: number, lang: Lang): string {
  const l = labels(lang);
  return [l.info, l.low, l.medium, l.high, l.critical][Math.max(0, Math.min(4, sev))] ?? l.info;
}

export function doc(title: string, css: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${css}</style></head><body><span class="doctitle">${escapeHtml(title)}</span>${body}</body></html>`;
}

export function cover(opts: {
  kicker: string;
  title: string;
  target: string;
  settings: ReportSettings;
  meta: Record<string, string>;
}): string {
  const { kicker, title, target, settings: s, meta } = opts;
  const initial = (s.companyName?.trim()?.[0] ?? 'V').toUpperCase();
  const cells = Object.entries(meta)
    .map(([k, v]) => `<div><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`)
    .join('');
  return `<section class="cover">
    <div class="topstrip"></div>
    <div class="cbody">
      ${s.classification ? `<div class="classif">${escapeHtml(s.classification)}</div>` : ''}
      <div class="brand"><span class="mark">${escapeHtml(initial)}</span><span class="bn">${escapeHtml(s.companyName ?? 'vacti')}</span></div>
      <div class="ckicker">${escapeHtml(kicker)}</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="ctarget">${escapeHtml(target)}</div>
      <div class="metawrap"><div class="metagrid">${cells}</div></div>
    </div>
  </section>`;
}

export function section(num: string, title: string, pageBreak = true): string {
  return `${pageBreak ? '<div class="page-break"></div>' : ''}<div class="secwrap">${num ? `<span class="secnum">${escapeHtml(num)}</span>` : ''}<h2>${escapeHtml(title)}</h2></div>`;
}

export function kv(pairs: [string, string][]): string {
  return `<div class="kv">${pairs.map(([k, v]) => `<div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div>`).join('')}</div>`;
}

/** Severity scorecard: Total + Critical/High/Medium/Low/Info tiles. */
export function scoreTiles(
  counts: { crit: number; high: number; med: number; low: number; info: number },
  lang: Lang,
): string {
  const l = labels(lang);
  const total = counts.crit + counts.high + counts.med + counts.low + counts.info;
  const tile = (cls: string, n: number, label: string) =>
    `<div class="score ${cls}"><div class="num">${n}</div><div class="lbl">${escapeHtml(label)}</div></div>`;
  return `<div class="scorecard">
    ${tile('total', total, l.vulnerabilities)}
    ${tile('crit', counts.crit, l.critical)}
    ${tile('high', counts.high, l.high)}
    ${tile('med', counts.med, l.medium)}
    ${tile('low', counts.low, l.low)}
    ${tile('info', counts.info, l.info)}
  </div>`;
}

export function sevBar(
  counts: { crit: number; high: number; med: number; low: number; info: number },
  lang: Lang,
): string {
  const l = labels(lang);
  const order = [counts.info, counts.low, counts.med, counts.high, counts.crit];
  const total = order.reduce((a, b) => a + b, 0);
  if (!total) return '';
  const labelsArr = [l.info, l.low, l.medium, l.high, l.critical];
  const segs = order
    .map((n, i) =>
      n > 0 ? `<div style="width:${((n / total) * 100).toFixed(1)}%;background:${SEV_HEX[i]}"></div>` : '',
    )
    .join('');
  const legend = order
    .map((n, i) => `<span><i style="background:${SEV_HEX[i]}"></i>${escapeHtml(labelsArr[i] ?? '')} ${n}</span>`)
    .join('');
  return `<div class="sevbar">${segs}</div><div class="legend">${legend}</div>`;
}

export function statusChip(label: string, active: boolean): string {
  return `<span class="status-chip ${active ? 'active' : 'closed'}">${escapeHtml(label)}</span>`;
}

export function approvalSheet(signatories: Signatory[], lang: Lang): string {
  if (!signatories.length) return '';
  const l = labels(lang);
  const roleLabel: Record<string, string> = { prepared: l.preparedBy, reviewed: l.reviewedBy, approved: l.approvedBy };
  const order = ['prepared', 'reviewed', 'approved'];
  const sorted = [...signatories].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  const head = sorted
    .map((s) => `<th style="text-align:center">${escapeHtml(roleLabel[s.role] ?? s.role)}</th>`)
    .join('');
  const sign = sorted.map(() => `<td>&nbsp;</td>`).join('');
  const names = sorted
    .map(
      (s) =>
        `<td><div class="sigline"><strong>${escapeHtml(s.name)}</strong><br/><span class="muted">${escapeHtml(s.position)}</span></div></td>`,
    )
    .join('');
  return `${section('', l.approvalSheet)}<table class="approval"><thead><tr>${head}</tr></thead><tbody><tr>${sign}</tr><tr>${names}</tr></tbody></table>`;
}
