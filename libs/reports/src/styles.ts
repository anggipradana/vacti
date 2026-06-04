/** Paged-media CSS for PDF reports (Chromium print). Modern, branded, redesigned (not WeasyPrint). */
export function reportCss(primary: string, secondary: string, footer: string, classification: string): string {
  return `
  @page {
    size: A4;
    margin: 20mm 16mm 18mm 16mm;
    @top-right { content: string(section); font-size: 8pt; color: #6b7280; }
    @bottom-left { content: ${JSON.stringify(footer || classification || '')}; font-size: 8pt; color: #9ca3af; }
    @bottom-right { content: counter(page) " / " counter(pages); font-size: 8pt; color: #9ca3af; }
  }
  @page :first { margin: 0; @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #111827; font-size: 10.5pt; line-height: 1.5; margin: 0; }
  h1, h2, h3 { color: ${secondary}; }
  h2 { string-set: section content(); font-size: 15pt; border-bottom: 2px solid ${primary}; padding-bottom: 4px; margin-top: 26px; }
  h3 { font-size: 12pt; margin: 16px 0 6px; }
  .cover { height: 297mm; background: ${secondary}; color: #fff; padding: 40mm 24mm; display: flex; flex-direction: column; }
  .cover .brandbar { height: 6px; width: 80px; background: ${primary}; margin-bottom: 24px; }
  .cover h1 { color: #fff; font-size: 30pt; margin: 0 0 8px; }
  .cover .meta { margin-top: auto; font-size: 10pt; color: #cbd5e1; }
  .cover .classif { position: absolute; top: 18mm; right: 24mm; font-size: 9pt; letter-spacing: 1px; color: ${primary}; }
  .page-break { page-break-before: always; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9.5pt; }
  th { text-align: left; background: #f3f4f6; color: #374151; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  td { padding: 6px 8px; border-bottom: 1px solid #eef0f3; vertical-align: top; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin: 8px 0; page-break-inside: avoid; }
  .sev { display: inline-block; padding: 1px 8px; border-radius: 6px; font-size: 8.5pt; font-weight: 600; color: #fff; }
  .sev-critical { background: #dc2626; } .sev-high { background: #ea580c; } .sev-medium { background: #d97706; }
  .sev-low { background: #ca8a04; } .sev-info { background: #0284c7; }
  .stat { display: inline-block; width: 23%; margin-right: 1.5%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; text-align: center; }
  .stat .n { font-size: 20pt; font-weight: 700; color: ${secondary}; }
  .stat .l { font-size: 8.5pt; color: #6b7280; }
  .risk-meter { height: 14px; border-radius: 999px; background: #eef0f3; overflow: hidden; margin: 8px 0; }
  .risk-meter > div { height: 100%; }
  .muted { color: #6b7280; } .mono { font-family: ui-monospace, monospace; font-size: 9pt; }
  .approval td { text-align: center; height: 60px; vertical-align: bottom; }
  .end { text-align: center; color: ${primary}; font-weight: 700; margin-top: 40px; }
  `;
}

export const SEV_CLASS = ['sev-info', 'sev-low', 'sev-medium', 'sev-high', 'sev-critical'];
export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
