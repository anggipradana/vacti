/** Paged-media CSS for PDF reports — Claude design language: warm ivory paper, terracotta accent,
 * serif (Fraunces) display headings, clean sans body. Rendered by headless Chromium. */
export function reportCss(primary: string, secondary: string, footer: string, classification: string): string {
  return `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap');
  @page {
    size: A4;
    margin: 20mm 16mm 18mm 16mm;
    @top-right { content: string(section); font-size: 8pt; color: #8a8472; }
    @bottom-left { content: ${JSON.stringify(footer || classification || '')}; font-size: 8pt; color: #a9a293; }
    @bottom-right { content: counter(page) " / " counter(pages); font-size: 8pt; color: #a9a293; }
  }
  @page :first { margin: 0; @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #1a1915; background: #faf9f5; font-size: 10.5pt; line-height: 1.55; margin: 0; }
  h1, h2, h3 { font-family: 'Fraunces', Georgia, serif; color: ${secondary}; letter-spacing: -0.01em; }
  h2 { string-set: section content(); font-size: 17pt; font-weight: 600; border-bottom: 1.5px solid ${primary}; padding-bottom: 5px; margin-top: 28px; }
  h3 { font-size: 12.5pt; margin: 16px 0 6px; }
  .cover { height: 297mm; background: ${secondary}; color: #faf9f5; padding: 42mm 26mm; display: flex; flex-direction: column; position: relative; }
  .cover .brandbar { height: 5px; width: 72px; background: ${primary}; margin-bottom: 26px; border-radius: 4px; }
  .cover h1 { font-family: 'Fraunces', Georgia, serif; color: #faf9f5; font-size: 34pt; font-weight: 600; margin: 0 0 10px; line-height: 1.1; }
  .cover .sub { font-family: 'Fraunces', Georgia, serif; font-size: 15pt; color: ${primary}; }
  .cover .meta { margin-top: auto; font-size: 10pt; color: #d8d3c6; line-height: 1.9; }
  .cover .classif { position: absolute; top: 18mm; right: 26mm; font-size: 8.5pt; letter-spacing: 1.5px; color: ${primary}; }
  .page-break { page-break-before: always; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9.5pt; }
  th { text-align: left; background: #f2f0e9; color: #4a463c; padding: 7px 9px; border-bottom: 1px solid #e6e2d6; font-weight: 600; }
  td { padding: 7px 9px; border-bottom: 1px solid #ece9df; vertical-align: top; }
  .card { border: 1px solid #e6e2d6; border-radius: 10px; padding: 13px 15px; margin: 9px 0; page-break-inside: avoid; background: #fff; }
  .sev { display: inline-block; padding: 1px 9px; border-radius: 7px; font-size: 8.5pt; font-weight: 600; color: #fff; }
  .sev-critical { background: #c0392b; } .sev-high { background: #d35400; } .sev-medium { background: #b9770e; }
  .sev-low { background: #9a7d0a; } .sev-info { background: #2b7a9b; }
  .stat { display: inline-block; width: 23%; margin-right: 1.5%; border: 1px solid #e6e2d6; border-radius: 10px; padding: 12px; text-align: center; background: #fff; }
  .stat .n { font-family: 'Fraunces', Georgia, serif; font-size: 22pt; font-weight: 600; color: ${secondary}; }
  .stat .l { font-size: 8.5pt; color: #6b6657; }
  .risk-meter { height: 14px; border-radius: 999px; background: #ece9df; overflow: hidden; margin: 10px 0; }
  .risk-meter > div { height: 100%; }
  .muted { color: #6b6657; } .mono { font-family: ui-monospace, 'SF Mono', monospace; font-size: 9pt; }
  .approval td { text-align: center; height: 62px; vertical-align: bottom; }
  .end { text-align: center; font-family: 'Fraunces', Georgia, serif; color: ${primary}; font-weight: 600; margin-top: 44px; }
  `;
}

export const SEV_CLASS = ['sev-info', 'sev-low', 'sev-medium', 'sev-high', 'sev-critical'];
export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
