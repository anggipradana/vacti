/** Report design adapted from the BPRS-Hijra reference: teal + navy, Space Grotesk display,
 * IBM Plex Sans/Mono, navy textured cover, eyebrow+numbered sections, finding cards with severity
 * ID squares. Tuned for headless-Chromium print (A4). */
export function reportCss(primary: string, secondary: string, footer: string, classification: string): string {
  return `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
  :root{
    --teal:${primary}; --navy:${secondary}; --ink:#0c2530; --muted:#5b7480;
    --line:#e2e9ec; --line-2:#eef3f5; --soft:#f5f8f9; --paper:#fff;
    --sev-critical:#DC2626; --sev-high:#EA580C; --sev-medium:#D97706; --sev-low:#ca8a04; --sev-info:#2563EB;
  }
  @page {
    size: A4; margin: 22mm 16mm 16mm 16mm;
    @top-left { content: string(doctitle); font-family:'IBM Plex Mono',monospace; font-size: 7.5pt; letter-spacing:.12em; text-transform:uppercase; color: #9bafb7; }
    @top-right { content: string(section); font-family:'IBM Plex Mono',monospace; font-size: 7.5pt; letter-spacing:.1em; color: #9bafb7; }
    @bottom-left { content: ${JSON.stringify((classification || footer || '').toUpperCase())}; font-family:'IBM Plex Mono',monospace; font-size: 7pt; letter-spacing:.16em; color: var(--sev-high); font-weight:600; }
    @bottom-right { content: counter(page) " / " counter(pages); font-family:'IBM Plex Mono',monospace; font-size: 7.5pt; color: #9bafb7; }
  }
  @page :first { margin: 0; @top-left{content:none} @top-right{content:none} @bottom-left{content:none} @bottom-right{content:none} }
  * { box-sizing: border-box; }
  body { font-family: 'IBM Plex Sans', system-ui, sans-serif; color: var(--ink); background: #fff; font-size: 10pt; line-height: 1.55; margin: 0; -webkit-font-smoothing: antialiased; }
  .doctitle { string-set: doctitle content(); position: absolute; left: -9999px; }
  h1,h2,h3,h4 { font-family: 'Space Grotesk', sans-serif; margin: 0; font-weight: 600; color: var(--ink); }
  .mono { font-family: 'IBM Plex Mono', monospace; }
  p { margin: 6px 0; line-height: 1.62; }
  p strong, td strong, li strong { font-weight: 600; color: var(--ink); }
  h3 { font-size: 11pt; font-weight: 600; margin: 0 0 4px; color: var(--ink); }
  ul { margin: 8px 0 0; padding-left: 18px; }
  li { font-size: 10pt; line-height: 1.6; margin: 4px 0; color: #334a54; }

  /* Cover (navy, textured) */
  .cover { height: 297mm; background: var(--navy); color: #eaf4f7; position: relative; overflow: hidden; display: flex; flex-direction: column; padding: 26mm 24mm 24mm; }
  .cover .grid-bg { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px); background-size: 34px 34px; -webkit-mask-image: radial-gradient(120% 90% at 82% 8%,#000 0%,transparent 68%); }
  .cover .glow { position: absolute; width: 460px; height: 460px; border-radius: 50%; right: -150px; top: -140px; background: radial-gradient(circle,rgba(6,158,198,.40),transparent 62%); }
  .cover-top { display: flex; align-items: center; justify-content: space-between; position: relative; }
  .cover-top .mark { display: flex; align-items: center; gap: 11px; }
  .cover-top .mark .m { width: 34px; height: 34px; border-radius: 9px; background: var(--teal); color: #04222c; font-family:'Space Grotesk'; font-weight: 700; font-size: 17pt; display: flex; align-items: center; justify-content: center; }
  .cover-top .mark .nm { font-family:'Space Grotesk'; font-weight: 600; font-size: 13pt; color: #fff; }
  .conf-pill { font-family:'IBM Plex Mono'; font-size: 8.5pt; letter-spacing: .2em; border: 1px solid rgba(234,88,12,.7); color: #ff9d63; padding: 5px 12px; border-radius: 3px; text-transform: uppercase; font-weight: 600; }
  .cover-mid { margin-top: auto; position: relative; }
  .cover .kicker { font-family:'IBM Plex Mono'; font-size: 9.5pt; letter-spacing: .3em; text-transform: uppercase; color: var(--teal); margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
  .cover .kicker::before { content: ''; width: 42px; height: 2px; background: var(--teal); display: inline-block; }
  .cover h1 { font-family:'Space Grotesk'; font-size: 52pt; line-height: .98; letter-spacing: -.02em; color: #fff; font-weight: 700; }
  .cover h1 .l2 { color: var(--teal); }
  .cover .target { margin-top: 26px; display: inline-flex; align-items: center; gap: 10px; font-family:'IBM Plex Mono'; font-size: 14pt; color: #fff; background: rgba(6,158,198,.13); border: 1px solid rgba(6,158,198,.4); padding: 10px 16px; border-radius: 4px; }
  .cover .target .tg { color: var(--teal); }
  .cover-meta { margin-top: 40px; display: grid; grid-template-columns: repeat(3,1fr); border-top: 1px solid rgba(255,255,255,.14); padding-top: 22px; gap: 12px; position: relative; }
  .cover-meta .mk { font-family:'IBM Plex Mono'; font-size: 8pt; letter-spacing: .16em; text-transform: uppercase; color: #6f93a0; }
  .cover-meta .mv { font-family:'IBM Plex Mono'; font-size: 11pt; color: #eaf4f7; margin-top: 6px; font-weight: 500; }
  .cover-foot { margin-top: 28px; font-size: 9.5pt; color: #6f93a0; display: flex; justify-content: space-between; align-items: flex-end; position: relative; }
  .cover-foot .org { color: #bcd7df; font-family:'Space Grotesk'; font-size: 12pt; font-weight: 600; }

  /* Section heads */
  .sec-head { border-bottom: 2px solid var(--ink); padding-bottom: 14px; margin: 30px 0 22px; }
  .eyebrow { font-family:'IBM Plex Mono'; font-size: 8.5pt; letter-spacing: .26em; text-transform: uppercase; color: var(--teal-deep,#067a99); font-weight: 500; }
  .sec-title { display: flex; align-items: baseline; gap: 13px; margin-top: 5px; }
  .sec-title .num { font-family:'Space Grotesk'; font-weight: 600; color: var(--teal); font-size: 14pt; }
  .sec-title h2 { string-set: section content(); font-size: 22pt; letter-spacing: -.01em; line-height: 1.05; }
  .sec-sub { font-size: 10pt; color: var(--muted); margin: 7px 0 0; line-height: 1.55; }

  /* Stat cards */
  .stat-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin: 14px 0; }
  .stat { border: 1px solid var(--line); border-radius: 8px; padding: 16px 16px; position: relative; overflow: hidden; }
  .stat::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--teal); }
  .stat .sv { font-family:'Space Grotesk'; font-size: 30pt; font-weight: 700; line-height: 1; color: var(--ink); }
  .stat .sl { font-size: 8.5pt; color: var(--muted); margin-top: 7px; text-transform: uppercase; letter-spacing: .08em; }

  /* Severity bar + legend */
  .sevbar { display: flex; border-radius: 6px; overflow: hidden; height: 30px; border: 1px solid var(--line); margin: 12px 0; }
  .sevbar .seg { display: flex; align-items: center; justify-content: center; color: #fff; font-family:'IBM Plex Mono'; font-size: 9pt; font-weight: 600; min-width: 26px; }
  .sev-legend { display: grid; grid-template-columns: repeat(3,1fr); gap: 9px 18px; }
  .sev-item { display: flex; align-items: center; gap: 9px; font-size: 9.5pt; }
  .sev-item .sw { width: 11px; height: 11px; border-radius: 3px; flex: none; }
  .sev-item .nm { flex: 1; color: var(--ink); }
  .sev-item .ct { font-family:'IBM Plex Mono'; font-weight: 600; color: var(--ink); }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 8px 0; }
  thead th { background: var(--navy); color: #cfe6ee; font-family:'IBM Plex Mono'; font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; font-weight: 500; text-align: left; padding: 9px 11px; }
  tbody td { padding: 8px 11px; border-bottom: 1px solid var(--line-2); vertical-align: middle; }
  tbody tr:nth-child(even) { background: var(--soft); }
  .idx { color: #9bafb7; font-family:'IBM Plex Mono'; font-size: 9pt; }

  /* Finding cards */
  .finding { border: 1px solid var(--line); border-radius: 9px; overflow: hidden; margin-bottom: 16px; page-break-inside: avoid; }
  .finding-head { padding: 15px 18px; display: flex; align-items: flex-start; gap: 14px; border-bottom: 1px solid var(--line); }
  .finding-head .fid { font-family:'Space Grotesk'; font-weight: 700; font-size: 12pt; color: #fff; width: 34px; height: 34px; border-radius: 7px; display: flex; align-items: center; justify-content: center; flex: none; }
  .finding-head .fttl { flex: 1; }
  .finding-head .fttl .fn { font-family:'Space Grotesk'; font-size: 14pt; font-weight: 600; line-height: 1.15; }
  .finding-head .fttl .fmeta { display: flex; gap: 7px; align-items: center; margin-top: 7px; flex-wrap: wrap; }
  .tag { font-family:'IBM Plex Mono'; font-size: 7.5pt; letter-spacing: .08em; text-transform: uppercase; background: var(--soft); color: var(--muted); padding: 3px 7px; border-radius: 3px; border: 1px solid var(--line); }
  .badge { font-family:'IBM Plex Mono'; font-size: 7.5pt; font-weight: 600; letter-spacing: .06em; padding: 3px 8px; border-radius: 3px; color: #fff; text-transform: uppercase; }
  .finding-body { padding: 16px 18px; }
  .fblock { margin-bottom: 13px; } .fblock:last-child { margin-bottom: 0; }
  .fblock .flabel { font-family:'IBM Plex Mono'; font-size: 8pt; letter-spacing: .16em; text-transform: uppercase; color: #067a99; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
  .fblock .flabel::after { content: ''; flex: 1; height: 1px; background: var(--line); }
  .fblock p { font-size: 10pt; color: #334a54; margin: 0; }

  /* TOC */
  .toc-item { display: flex; align-items: center; gap: 14px; padding: 14px 4px; border-bottom: 1px solid var(--line); }
  .toc-item .tnum { font-family:'IBM Plex Mono'; font-size: 11pt; color: var(--teal); width: 28px; font-weight: 600; }
  .toc-item .tt { font-family:'Space Grotesk'; font-size: 13pt; font-weight: 600; color: var(--ink); flex: 1; }
  .toc-item .te { font-size: 9.5pt; color: var(--muted); }

  /* Approval */
  .approve-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin-top: 12px; }
  .approve-card { border: 1px solid var(--line); border-radius: 8px; padding: 22px 20px; }
  .approve-card .acrole { font-family:'IBM Plex Mono'; font-size: 8.5pt; letter-spacing: .16em; text-transform: uppercase; color: #067a99; }
  .approve-card .acsig { height: 56px; border-bottom: 1px dashed var(--line); margin: 16px 0 12px; }
  .approve-card .acname { font-family:'Space Grotesk'; font-size: 13pt; font-weight: 600; }
  .approve-card .acpos { font-size: 10pt; color: var(--muted); margin-top: 3px; }

  /* Misc */
  .kv { display: grid; grid-template-columns: 170px 1fr; gap: 9px 18px; font-size: 10pt; }
  .kv .k { color: var(--muted); } .kv .v { color: var(--ink); font-weight: 500; }
  .note { background: var(--soft); border-left: 3px solid var(--teal); padding: 13px 17px; border-radius: 0 6px 6px 0; font-size: 10pt; color: #334a54; }
  .risk-wrap { display: flex; align-items: center; gap: 18px; margin: 12px 0; }
  .risk-num { font-family:'Space Grotesk'; font-size: 30pt; font-weight: 700; line-height: 1; }
  .risk-meter { flex: 1; height: 14px; border-radius: 999px; background: var(--soft); overflow: hidden; }
  .risk-meter > div { height: 100%; }
  .risk-level { font-family:'IBM Plex Mono'; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; padding: 4px 12px; border-radius: 3px; }
  .empty { border: 1px dashed var(--line); border-radius: 8px; padding: 16px; text-align: center; color: #9bafb7; font-size: 9.5pt; }
  .end { text-align: center; font-family:'IBM Plex Mono'; color: var(--teal); font-weight: 600; letter-spacing: .22em; text-transform: uppercase; font-size: 9pt; margin-top: 42px; }
  `;
}

export const SEV_KEYS = ['info', 'low', 'med', 'high', 'crit'];
export const SEV_HEX = ['#2563EB', '#ca8a04', '#D97706', '#EA580C', '#DC2626'];
export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
