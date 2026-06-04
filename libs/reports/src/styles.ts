/** Paged-media CSS for PDF reports — clean, professional, white-paper design with a refined indigo
 * accent and a crafted sans (Plus Jakarta Sans). Rendered by headless Chromium. */
export function reportCss(primary: string, secondary: string, footer: string, classification: string): string {
  return `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  @page {
    size: A4;
    margin: 20mm 16mm 18mm 16mm;
    @top-right { content: string(section); font-size: 8pt; color: #94a0b8; }
    @bottom-left { content: ${JSON.stringify(footer || classification || '')}; font-size: 8pt; color: #a7b0c0; }
    @bottom-right { content: counter(page) " / " counter(pages); font-size: 8pt; color: #a7b0c0; }
  }
  @page :first { margin: 0; @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }
  * { box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #0f172a; background: #ffffff; font-size: 10.5pt; line-height: 1.55; margin: 0; }
  h1, h2, h3 { color: ${secondary}; letter-spacing: -0.02em; font-weight: 700; }
  h2 { string-set: section content(); font-size: 16pt; border-bottom: 2px solid ${primary}; padding-bottom: 5px; margin-top: 28px; }
  h3 { font-size: 12.5pt; margin: 16px 0 6px; }
  .cover { height: 297mm; background: ${secondary}; color: #fff; padding: 42mm 26mm; display: flex; flex-direction: column; position: relative; }
  .cover .brandbar { height: 5px; width: 64px; background: ${primary}; margin-bottom: 26px; border-radius: 4px; }
  .cover h1 { color: #fff; font-size: 32pt; font-weight: 800; margin: 0 0 10px; line-height: 1.12; }
  .cover .sub { font-size: 14pt; font-weight: 600; color: #c7d2fe; }
  .cover .meta { margin-top: auto; font-size: 10pt; color: #cbd5e1; line-height: 1.9; }
  .cover .classif { position: absolute; top: 18mm; right: 26mm; font-size: 8.5pt; letter-spacing: 1.5px; color: #c7d2fe; }
  .page-break { page-break-before: always; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9.5pt; }
  th { text-align: left; background: #f1f5f9; color: #334155; padding: 7px 9px; border-bottom: 1px solid #e2e8f0; font-weight: 600; }
  td { padding: 7px 9px; border-bottom: 1px solid #eef2f6; vertical-align: top; }
  .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 13px 15px; margin: 9px 0; page-break-inside: avoid; background: #fff; }
  .sev { display: inline-block; padding: 1px 9px; border-radius: 7px; font-size: 8.5pt; font-weight: 700; color: #fff; }
  .sev-critical { background: #dc2626; } .sev-high { background: #ea580c; } .sev-medium { background: #b45309; }
  .sev-low { background: #a16207; } .sev-info { background: #2563eb; }
  .stat { display: inline-block; width: 23%; margin-right: 1.5%; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center; background: #fff; }
  .stat .n { font-size: 22pt; font-weight: 800; color: ${secondary}; }
  .stat .l { font-size: 8.5pt; color: #64748b; }
  .risk-meter { height: 14px; border-radius: 999px; background: #eef2f6; overflow: hidden; margin: 10px 0; }
  .risk-meter > div { height: 100%; }
  .muted { color: #64748b; } .mono { font-family: ui-monospace, 'SF Mono', monospace; font-size: 9pt; }
  .approval td { text-align: center; height: 62px; vertical-align: bottom; }
  .end { text-align: center; color: ${primary}; font-weight: 700; margin-top: 44px; }
  `;
}

export const SEV_CLASS = ['sev-info', 'sev-low', 'sev-medium', 'sev-high', 'sev-critical'];
export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
