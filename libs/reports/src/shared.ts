import { escapeHtml } from './styles';
import { labels, type Lang } from './i18n';
import type { ReportSettings, Signatory } from './types';

const SEV = ['sev-info', 'sev-low', 'sev-medium', 'sev-high', 'sev-critical'];
export function sevClass(sev: number): string {
  return SEV[Math.max(0, Math.min(4, sev))] ?? 'sev-info';
}
export function sevLabel(sev: number, lang: Lang): string {
  const l = labels(lang);
  return [l.info, l.low, l.medium, l.high, l.critical][Math.max(0, Math.min(4, sev))] ?? l.info;
}

export function cover(title: string, subtitle: string, s: ReportSettings, meta: Record<string, string>): string {
  const rows = Object.entries(meta)
    .map(([k, v]) => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</div>`)
    .join('');
  return `<section class="cover">
    ${s.classification ? `<div class="classif">${escapeHtml(s.classification)}</div>` : ''}
    <div class="brandbar"></div>
    ${s.companyName ? `<div style="font-size:12pt;color:#cbd5e1">${escapeHtml(s.companyName)}</div>` : ''}
    <h1>${escapeHtml(title)}</h1>
    <div style="font-size:13pt;color:${s.primaryColor}">${escapeHtml(subtitle)}</div>
    <div class="meta">
      ${rows}
      ${s.companyWebsite ? `<div>${escapeHtml(s.companyWebsite)}</div>` : ''}
    </div>
  </section>`;
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
        `<td style="text-align:center"><strong>${escapeHtml(s.name)}</strong><br/><span class="muted">${escapeHtml(s.position)}</span></td>`,
    )
    .join('');
  return `<div class="page-break"></div><h2>${escapeHtml(l.approvalSheet)}</h2>
    <table class="approval"><thead><tr>${head}</tr></thead><tbody><tr>${sign}</tr><tr>${names}</tr></tbody></table>`;
}

export function doc(title: string, css: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${css}</style></head><body>${body}</body></html>`;
}
