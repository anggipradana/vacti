import { workbookToXlsx, type XlsxSheet, type XlsxImage, type XlsxCell } from './xlsx-rich';

/**
 * BSSN "Data Kerentanan" classification: map a finding's class/title to the Indonesian BSSN Perban no.4
 * control category (a-m) and the OWASP Top 10 2021 category, for the BSSN-format Excel export. Keyword
 * matching on findingClass + title; most-specific rule first.
 */

/** Perban BSSN no.4 control categories (exact labels from the BSSN Data Kerentanan template, dropdown list). */
export const PERBAN_BSSN_CATEGORIES = [
  'a. autentikasi',
  'b. manajemen sesi',
  'c. persyaratan kontrol akses',
  'd. validasi input',
  'e. kriptografi pada verifikasi statis',
  'f. penanganan eror dan pencatatan log',
  'g. proteksi data',
  'h. keamanan komunikasi',
  'i. pengendalian kode berbahaya',
  'j. logika bisnis',
  'k. file',
  'l. keamanan API dan web service',
  'm. keamanan konfigurasi',
] as const;

/** OWASP Top 10 2021 categories (exact labels, dropdown list). */
export const OWASP_TOP10_2021 = [
  'A01:2021-Broken Access Control',
  'A02:2021-Cryptographic Failures',
  'A03:2021-Injection',
  'A04:2021-Insecure Design',
  'A05:2021-Security Misconfiguration',
  'A06:2021-Vulnerable and Outdated Components',
  'A07:2021-Identification and Authentication Failures',
  'A08:2021-Software and Data Integrity Failures',
  'A09:2021-Security Logging and Monitoring Failures',
  'A10:2021-Server-Side Request Forgery',
] as const;

const norm = (findingClass?: string | null, title?: string | null): string =>
  `${findingClass ?? ''} ${title ?? ''}`.toLowerCase();

/** Map a finding to its Perban BSSN no.4 control category (the exact dropdown label). */
export function perbanBssn(findingClass?: string | null, title?: string | null): string {
  const s = norm(findingClass, title);
  // Access control (IDOR/BFLA/BOLA/forced browsing) before auth, since BFLA contains "auth(z)".
  if (
    /idor|bola|bfla|broken[ -]?access|access[ -]?control|\bauthz\b|authoriz|privilege|forced[ -]?brows|horizontal|vertical/.test(
      s,
    )
  )
    return 'c. persyaratan kontrol akses';
  if (/\bsession\b|\bjwt\b|cookie|session[ -]?(fixation|management)|token[ -]?(reuse|fixation)/.test(s))
    return 'b. manajemen sesi';
  if (
    /auth(entication)?[ -]?bypass|\blogin\b|password|\botp\b|\bmfa\b|2fa|credential|brute[ -]?force|rate[ -]?limit|lockout|\botpbypass\b/.test(
      s,
    )
  )
    return 'a. autentikasi';
  if (
    /\bsql\b|sqli|\bxss\b|injection|command[ -]?inj|\brce\b|ssti|\bxxe\b|html[ -]?inj|ldap|nosql|template[ -]?inj|crlf|deserializ/.test(
      s,
    )
  )
    return 'd. validasi input';
  if (/crypto|cipher|\bhash\b|weak[ -]?(key|algo|crypto|cipher|secret)|encrypt|plaintext[ -]?(secret|password)/.test(s))
    return 'e. kriptografi pada verifikasi statis';
  if (
    /stack[ -]?trace|exception|verbose[ -]?(error|message)|logging|monitor|error[ -]?handling|debug[ -]?(log|viewer)/.test(
      s,
    )
  )
    return 'f. penanganan eror dan pencatatan log';
  if (
    /sensitive[ -]?data|\bpii\b|data[ -]?(leak|expos)|information[ -]?disclos|leak|exposes[ -]?(user|full)|user[ -]?data/.test(
      s,
    )
  )
    return 'g. proteksi data';
  if (
    /\bheader\b|\bhsts\b|\bcsp\b|\bcors\b|clickjack|transport[ -]?security|secure[ -]?cookie|mixed[ -]?content|\btls\b|\bssl\b/.test(
      s,
    )
  )
    return 'h. keamanan komunikasi';
  if (/malicious[ -]?code|webshell|web[ -]?shell|backdoor|integrity|supply[ -]?chain|unsigned/.test(s))
    return 'i. pengendalian kode berbahaya';
  if (/business[ -]?logic|\blogic\b|workflow|race[ -]?condition|abuse[ -]?of[ -]?function/.test(s))
    return 'j. logika bisnis';
  if (/file[ -]?(upload|inclusion)|path[ -]?travers|directory[ -]?travers|\blfi\b|\brfi\b|arbitrary[ -]?file/.test(s))
    return 'k. file';
  if (/\bapi\b|web[ -]?service|graphql|\brest\b|\bssrf\b|server[ -]?side[ -]?request/.test(s))
    return 'l. keamanan API dan web service';
  if (
    /misconfig|default[ -]?cred|directory[ -]?listing|version[ -]?disclos|x-powered-by|exposed[ -]?(panel|endpoint|debug)|\bconfig\b/.test(
      s,
    )
  )
    return 'm. keamanan konfigurasi';
  return 'd. validasi input';
}

/** Map a finding to its OWASP Top 10 2021 category (the exact dropdown label). */
export function owaspTop10(findingClass?: string | null, title?: string | null): string {
  const s = norm(findingClass, title);
  if (/\bssrf\b|server[ -]?side[ -]?request/.test(s)) return 'A10:2021-Server-Side Request Forgery';
  if (
    /idor|bola|bfla|broken[ -]?access|access[ -]?control|\bauthz\b|authoriz|privilege|forced[ -]?brows|horizontal|vertical/.test(
      s,
    )
  )
    return 'A01:2021-Broken Access Control';
  if (/\bsql\b|sqli|\bxss\b|injection|command[ -]?inj|\brce\b|ssti|\bxxe\b|html[ -]?inj|ldap|nosql|crlf/.test(s))
    return 'A03:2021-Injection';
  if (
    /crypto|cipher|\bhash\b|weak[ -]?(key|algo|crypto|cipher|secret)|encrypt|\btls\b|\bssl\b|plaintext[ -]?(secret|password)|sensitive[ -]?data|data[ -]?(leak|expos)|\bpii\b/.test(
      s,
    )
  )
    return 'A02:2021-Cryptographic Failures';
  if (
    /auth(entication)?[ -]?bypass|\blogin\b|password|\botp\b|\bmfa\b|2fa|credential|brute[ -]?force|rate[ -]?limit|lockout|\bsession\b|\bjwt\b/.test(
      s,
    )
  )
    return 'A07:2021-Identification and Authentication Failures';
  if (/integrity|deserializ|webshell|web[ -]?shell|supply[ -]?chain|unsigned[ -]?(update|code)/.test(s))
    return 'A08:2021-Software and Data Integrity Failures';
  if (/outdated|vulnerable[ -]?component|known[ -]?cve|end[ -]?of[ -]?life|unpatched/.test(s))
    return 'A06:2021-Vulnerable and Outdated Components';
  if (
    /logging|monitor|stack[ -]?trace|exception|verbose[ -]?(error|message)|error[ -]?handling|debug[ -]?(log|viewer)/.test(
      s,
    )
  )
    return 'A09:2021-Security Logging and Monitoring Failures';
  if (/business[ -]?logic|\blogic\b|workflow|race[ -]?condition/.test(s)) return 'A04:2021-Insecure Design';
  if (
    /misconfig|default[ -]?cred|\bheader\b|\bhsts\b|\bcsp\b|\bcors\b|directory[ -]?listing|version[ -]?disclos|x-powered-by|exposed|\bconfig\b|clickjack|debug/.test(
      s,
    )
  )
    return 'A05:2021-Security Misconfiguration';
  return 'A04:2021-Insecure Design';
}

// ── BSSN "Data Kerentanan" workbook (one sheet per target) ──────────────────────────────────────────

export interface BssnPoc {
  caption: string;
  image: Buffer;
  ext: 'png' | 'jpeg';
  widthPx: number;
  heightPx: number;
}
export interface BssnFinding {
  name: string;
  severity: string; // Critical | High | Medium | Low | Info
  owasp: string; // OWASP Top 10 2021 category (international standard; replaces Perban BSSN)
  cvssVector: string;
  score: number | string;
  affectedLink: string;
  description: string;
  impact: string;
  remediation: string;
  explanation: string;
  pocs: BssnPoc[]; // up to 4 used (Poc_1..Poc_4)
}
export interface BssnTarget {
  appName: string; // sheet name + Nama Aplikasi
  url: string;
  ip?: string;
  version?: string;
  description?: string;
  assetType?: string; // Web/API
  testingNotes?: string;
  screenshot?: { image: Buffer; ext: 'png' | 'jpeg'; widthPx: number; heightPx: number };
  findings: BssnFinding[];
}

const POC_DISPLAY_W = 340; // px each PoC image is scaled to in its cell

/** A safe Excel sheet-name from an app/host (<=31 chars, no []:*?/\). */
function sheetName(s: string, idx: number): string {
  const clean = (s || `Target ${idx + 1}`)
    .replace(/[\\/?*[\]:]/g, '-')
    .slice(0, 31)
    .trim();
  return clean || `Target ${idx + 1}`;
}

function targetSheet(t: BssnTarget, idx: number): XlsxSheet {
  const rows: XlsxCell[][] = [];
  const images: XlsxImage[] = [];
  const merges: string[] = [];

  // Straight to the main findings table (the operator wants the metadata + reference blocks dropped for a
  // clean sheet). The header sits on row 0; findings follow.
  const headerRow = 0;
  const HEAD = [
    'No',
    'Nama Kerentanan',
    'Severity',
    'OWASP Top 10 2021',
    'CVSS Vector String',
    'Score',
    'Link Terdampak',
    'Deskripsi',
    'Dampak',
    'Rekomendasi',
    'Penjelasan',
    'Caption_1',
    'Poc_1',
    'Caption_2',
    'Poc_2',
    'Caption_3',
    'Poc_3',
    'Caption_4',
    'Poc_4',
  ];
  rows[headerRow] = HEAD.map((h) => ({ v: h, style: 2 }));

  const rowHeights: Record<number, number> = {};
  t.findings.forEach((f, fi) => {
    const r = headerRow + 1 + fi;
    const base: XlsxCell[] = [
      fi + 1,
      f.name,
      f.severity,
      f.owasp,
      f.cvssVector,
      f.score,
      f.affectedLink,
      f.description,
      f.impact,
      f.remediation,
      f.explanation,
    ];
    // Caption_N + Poc_N pairs (cols 11..18); image anchored in the Poc_N cell
    let maxH = 60;
    for (let p = 0; p < 4; p++) {
      const poc = f.pocs[p];
      const capCol = 11 + p * 2;
      const pocCol = 12 + p * 2;
      base[capCol] = poc ? poc.caption : '';
      base[pocCol] = '';
      if (poc) {
        const w = POC_DISPLAY_W;
        const h = Math.round(w * (poc.heightPx / Math.max(1, poc.widthPx)));
        images.push({ data: poc.image, ext: poc.ext, col: pocCol, row: r, widthPx: w, heightPx: h });
        maxH = Math.max(maxH, h + 8);
      }
    }
    rows[r] = base;
    rowHeights[r] = Math.round(maxH * 0.75); // px -> points
  });

  // Column widths (Excel "characters"): labels/text wide, PoC columns wide for the images.
  const colWidths: Record<number, number> = {
    0: 5,
    1: 30,
    2: 11,
    3: 24,
    4: 30,
    5: 7,
    6: 26,
    7: 40,
    8: 40,
    9: 40,
    10: 40,
    11: 22,
    12: POC_DISPLAY_W / 7,
    13: 22,
    14: POC_DISPLAY_W / 7,
    15: 22,
    16: POC_DISPLAY_W / 7,
    17: 22,
    18: POC_DISPLAY_W / 7,
  };
  return { name: sheetName(t.appName, idx), rows, images, colWidths, rowHeights, merges };
}

/** Build the BSSN "Data Kerentanan" workbook: one sheet per target, each with metadata + findings + PoC images. */
export function buildBssnWorkbook(targets: BssnTarget[]): Buffer {
  const sheets = (targets.length ? targets : [{ appName: 'Target', url: '', findings: [] }]).map((t, i) =>
    targetSheet(t, i),
  );
  return workbookToXlsx(sheets);
}
