/** Pro-grade paged-media design system for PDF reports (clean white, indigo accent, severity-tinted
 * finding cards, scorecard tiles). Rendered by headless Chromium. */
export function reportCss(primary: string, secondary: string, footer: string, classification: string): string {
  return `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  @page {
    size: A4;
    margin: 22mm 17mm 18mm 17mm;
    @top-left { content: string(doctitle); font-size: 7.5pt; color: #aab2c0; letter-spacing: .3px; }
    @top-right { content: string(section); font-size: 7.5pt; color: #aab2c0; }
    @bottom-left { content: ${JSON.stringify(footer || classification || '')}; font-size: 7.5pt; color: #aab2c0; }
    @bottom-right { content: counter(page) " / " counter(pages); font-size: 7.5pt; color: #aab2c0; }
  }
  @page :first { margin: 0; @top-left{content:none} @top-right{content:none} @bottom-left{content:none} @bottom-right{content:none} }
  * { box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #0f172a; background: #fff; font-size: 10pt; line-height: 1.55; margin: 0; }
  .doctitle { string-set: doctitle content(); position: absolute; left: -9999px; }
  .kicker { color: ${primary}; letter-spacing: 2.5px; font-size: 8pt; font-weight: 700; text-transform: uppercase; margin: 0 0 3px; }
  h2 { string-set: section content(); font-size: 17pt; font-weight: 800; letter-spacing: -0.02em; margin: 2px 0 4px; color: #0f172a; }
  .secwrap { margin-top: 30px; border-bottom: 2px solid #eef2f6; padding-bottom: 10px; margin-bottom: 14px; }
  h3 { font-size: 11.5pt; font-weight: 700; letter-spacing: -0.01em; margin: 18px 0 8px; color: #1e293b; }
  p { margin: 6px 0; }

  /* Cover */
  .cover { height: 297mm; background: ${secondary}; color: #fff; position: relative; display: flex; flex-direction: column; padding: 44mm 26mm 30mm; }
  .cover::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 8px; background: ${primary}; }
  .cover .ckicker { color: ${primary}; letter-spacing: 3px; font-size: 9pt; font-weight: 700; text-transform: uppercase; margin-bottom: 16px; }
  .cover h1 { font-size: 36pt; font-weight: 800; line-height: 1.08; letter-spacing: -0.02em; margin: 0 0 14px; color: #fff; }
  .cover .ctarget { font-family: ui-monospace, monospace; font-size: 13pt; color: #cbd5e1; }
  .cover .company { font-size: 11pt; color: #e2e8f0; margin-top: 6px; }
  .cover .metagrid { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 14px 28px; border-top: 1px solid rgba(255,255,255,.16); padding-top: 22px; }
  .cover .metagrid .k { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1.2px; color: #93a1b5; margin-bottom: 2px; }
  .cover .metagrid .v { font-size: 11pt; color: #f1f5f9; }
  .cover .classif { position: absolute; top: 20mm; right: 26mm; font-size: 8pt; letter-spacing: 2px; font-weight: 700; color: ${primary}; }

  /* Key-value */
  .kv { display: grid; grid-template-columns: 170px 1fr; gap: 8px 18px; font-size: 10pt; }
  .kv .k { color: #64748b; }
  .kv .v { color: #0f172a; font-weight: 500; }

  /* Scorecard */
  .scorecard { display: flex; gap: 10px; margin: 14px 0 6px; }
  .score { flex: 1; border: 1px solid #e6ebf1; border-radius: 12px; border-top: 3px solid #cbd5e1; padding: 14px 10px; text-align: center; }
  .score .num { font-size: 26pt; font-weight: 800; line-height: 1; color: #0f172a; }
  .score .lbl { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-top: 7px; }
  .score.crit { border-top-color: #dc2626; } .score.crit .num { color: #dc2626; }
  .score.high { border-top-color: #ea580c; } .score.high .num { color: #ea580c; }
  .score.med  { border-top-color: #d97706; } .score.med .num  { color: #d97706; }
  .score.low  { border-top-color: #ca8a04; } .score.low .num  { color: #ca8a04; }
  .score.info { border-top-color: #2563eb; } .score.info .num { color: #2563eb; }
  .score.total { border-top-color: ${primary}; } .score.total .num { color: ${primary}; }

  /* Severity distribution bar + legend */
  .sevbar { display: flex; height: 12px; border-radius: 999px; overflow: hidden; margin: 14px 0 8px; background: #eef2f6; }
  .legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 8.5pt; color: #475569; }
  .legend span { display: inline-flex; align-items: center; }
  .legend i { width: 9px; height: 9px; border-radius: 3px; margin-right: 6px; display: inline-block; }

  /* Chips */
  .chip { display: inline-block; padding: 2px 9px; border-radius: 6px; font-size: 8pt; font-weight: 700; color: #fff; }
  .chip.crit { background: #dc2626; } .chip.high { background: #ea580c; } .chip.med { background: #d97706; }
  .chip.low { background: #ca8a04; } .chip.info { background: #2563eb; }
  .status-chip { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 8pt; font-weight: 600; background: #eef2f6; color: #475569; }
  .status-chip.active { background: #fef2f2; color: #b91c1c; }
  .status-chip.closed { background: #f0fdf4; color: #15803d; }

  /* Finding cards */
  .finding { border: 1px solid #e6ebf1; border-left: 4px solid #94a3b8; border-radius: 10px; margin: 11px 0; overflow: hidden; page-break-inside: avoid; }
  .finding.f-crit { border-left-color: #dc2626; } .finding.f-high { border-left-color: #ea580c; }
  .finding.f-med { border-left-color: #d97706; } .finding.f-low { border-left-color: #ca8a04; } .finding.f-info { border-left-color: #2563eb; }
  .finding-head { padding: 11px 15px; background: #f8fafc; border-bottom: 1px solid #eef2f6; }
  .finding-head .ftitle { font-size: 11.5pt; font-weight: 700; color: #0f172a; }
  .finding-body { padding: 12px 15px; }
  .finding-meta { font-size: 8.5pt; color: #64748b; margin-bottom: 4px; }
  .block { margin: 9px 0; }
  .block .blabel { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px; color: ${primary}; font-weight: 700; margin-bottom: 3px; }
  .block .btext { font-size: 9.5pt; color: #1e293b; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9.5pt; }
  th { text-align: left; background: #f8fafc; color: #475569; padding: 8px 10px; border-bottom: 1px solid #e6ebf1; font-weight: 600; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .4px; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:nth-child(even) td { background: #fcfdfe; }

  /* Risk meter */
  .risk-wrap { display: flex; align-items: center; gap: 18px; margin: 12px 0; }
  .risk-num { font-size: 30pt; font-weight: 800; line-height: 1; }
  .risk-meter { flex: 1; height: 14px; border-radius: 999px; background: #eef2f6; overflow: hidden; }
  .risk-meter > div { height: 100%; }
  .risk-level { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 3px 12px; border-radius: 999px; }

  .approval { margin-top: 8px; } .approval td { text-align: center; height: 64px; vertical-align: bottom; border-bottom: 0; }
  .approval .sigline { border-top: 1px solid #cbd5e1; padding-top: 6px; }
  .muted { color: #64748b; } .mono { font-family: ui-monospace, 'SF Mono', monospace; font-size: 9pt; }
  .empty { border: 1px dashed #e2e8f0; border-radius: 10px; padding: 18px; text-align: center; color: #94a3b8; font-size: 9.5pt; }
  .end { text-align: center; color: ${primary}; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; font-size: 9pt; margin-top: 46px; }
  `;
}

export const SEV_KEYS = ['info', 'low', 'med', 'high', 'crit']; // index 0..4
export const SEV_HEX = ['#2563eb', '#ca8a04', '#d97706', '#ea580c', '#dc2626'];
export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
