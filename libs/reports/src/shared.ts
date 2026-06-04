import { escapeHtml, SEV_KEYS, SEV_HEX } from './styles';
import { labels, type Lang } from './i18n';
import type { ReportSettings, Signatory } from './types';

export function sevClass(sev: number): string {
  return SEV_KEYS[Math.max(0, Math.min(4, sev))] ?? 'info';
}
export function sevHex(sev: number): string {
  return SEV_HEX[Math.max(0, Math.min(4, sev))] ?? '#2563EB';
}
export function sevLabel(sev: number, lang: Lang): string {
  const l = labels(lang);
  return [l.info, l.low, l.medium, l.high, l.critical][Math.max(0, Math.min(4, sev))] ?? l.info;
}

export function doc(title: string, css: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${css}</style></head><body><span class="doctitle">${escapeHtml(title)}</span>${body}</body></html>`;
}

export function cover(opts: {
  kicker: string;
  title: string;
  target: string;
  settings: ReportSettings;
  meta: Record<string, string>;
  org?: string;
}): string {
  const { kicker, title, target, settings: s, meta } = opts;
  const initial = (s.companyName?.trim()?.[0] ?? 'V').toUpperCase();
  const words = title.split(' ');
  const last = words.length > 1 ? words.pop()! : '';
  const h1 = `${escapeHtml(words.join(' '))}${last ? ` <span class="l2">${escapeHtml(last)}</span>` : ''}`;
  const cells = Object.entries(meta)
    .map(([k, v]) => `<div><div class="mk">${escapeHtml(k)}</div><div class="mv">${escapeHtml(v)}</div></div>`)
    .join('');
  return `<section class="cover">
    <div class="grid-bg"></div><div class="glow"></div>
    <div class="cover-top">
      <div class="mark"><span class="m">${escapeHtml(initial)}</span><span class="nm">${escapeHtml(s.companyName ?? 'vacti')}</span></div>
      <span class="conf-pill">${escapeHtml(s.classification ? 'Confidential' : 'Confidential')}</span>
    </div>
    <div class="cover-mid">
      <div class="kicker">${escapeHtml(kicker)}</div>
      <h1>${h1}</h1>
      <div class="target"><span class="tg">▸</span> ${escapeHtml(target)}</div>
      <div class="cover-meta">${cells}</div>
      <div class="cover-foot"><div class="org">${escapeHtml(opts.org ?? s.companyName ?? 'vacti')}</div><div>${escapeHtml(s.classification ?? '')}</div></div>
    </div>
  </section>`;
}

export function section(num: string, title: string, eyebrow: string, sub?: string): string {
  return `<div class="page-break"></div><div class="sec-head">
    <div class="eyebrow">${escapeHtml(eyebrow)}</div>
    <div class="sec-title">${num ? `<span class="num">${escapeHtml(num)}</span>` : ''}<h2>${escapeHtml(title)}</h2></div>
    ${sub ? `<div class="sec-sub">${escapeHtml(sub)}</div>` : ''}
  </div>`;
}

export function kv(pairs: [string, string][]): string {
  return `<div class="kv">${pairs
    .map(([k, v]) => `<div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div>`)
    .join('')}</div>`;
}

export function statRow(items: { value: number | string; label: string }[]): string {
  return `<div class="stat-row">${items
    .map(
      (i) =>
        `<div class="stat"><div class="sv">${escapeHtml(i.value)}</div><div class="sl">${escapeHtml(i.label)}</div></div>`,
    )
    .join('')}</div>`;
}

export function sevBarLegend(
  counts: { crit: number; high: number; med: number; low: number; info: number },
  lang: Lang,
): string {
  const l = labels(lang);
  const order = [
    { n: counts.crit, hex: SEV_HEX[4]!, name: l.critical },
    { n: counts.high, hex: SEV_HEX[3]!, name: l.high },
    { n: counts.med, hex: SEV_HEX[2]!, name: l.medium },
    { n: counts.low, hex: SEV_HEX[1]!, name: l.low },
    { n: counts.info, hex: SEV_HEX[0]!, name: l.info },
  ];
  const total = order.reduce((a, b) => a + b.n, 0);
  const bar = total
    ? `<div class="sevbar">${order
        .filter((o) => o.n > 0)
        .map((o) => `<div class="seg" style="flex:${o.n};background:${o.hex}">${o.n}</div>`)
        .join('')}</div>`
    : '';
  const legend = `<div class="sev-legend">${order
    .map(
      (o) =>
        `<div class="sev-item"><span class="sw" style="background:${o.hex}"></span><span class="nm">${escapeHtml(o.name)}</span><span class="ct">${o.n}</span></div>`,
    )
    .join('')}</div>`;
  return bar + legend;
}

export function findingCard(opts: {
  index: number;
  severity: number;
  lang: Lang;
  title: string;
  tags: string[];
  blocks: { label: string; text: string }[];
}): string {
  const cls = sevClass(opts.severity);
  const hex = sevHex(opts.severity);
  const tags = opts.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const blocks = opts.blocks
    .filter((b) => b.text)
    .map(
      (b) => `<div class="fblock"><div class="flabel">${escapeHtml(b.label)}</div><p>${escapeHtml(b.text)}</p></div>`,
    )
    .join('');
  return `<div class="finding f-${cls}">
    <div class="finding-head">
      <span class="fid" style="background:${hex}">${opts.index}</span>
      <div class="fttl"><div class="fn">${escapeHtml(opts.title)}</div>
        <div class="fmeta"><span class="badge" style="background:${hex}">${escapeHtml(sevLabel(opts.severity, opts.lang))}</span>${tags}</div>
      </div>
    </div>
    ${blocks ? `<div class="finding-body">${blocks}</div>` : ''}
  </div>`;
}

export function approvalCards(signatories: Signatory[], lang: Lang): string {
  if (!signatories.length) return '';
  const l = labels(lang);
  const roleLabel: Record<string, string> = { prepared: l.preparedBy, reviewed: l.reviewedBy, approved: l.approvedBy };
  const order = ['prepared', 'reviewed', 'approved'];
  const sorted = [...signatories].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  const cards = sorted
    .map(
      (s) =>
        `<div class="approve-card"><div class="acrole">${escapeHtml(roleLabel[s.role] ?? s.role)}</div><div class="acsig"></div><div class="acname">${escapeHtml(s.name)}</div><div class="acpos">${escapeHtml(s.position)}</div></div>`,
    )
    .join('');
  return `${section('', l.approvalSheet, 'Sign-off')}<div class="approve-grid">${cards}</div>`;
}
