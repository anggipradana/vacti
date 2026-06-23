// Build the render items: for each finding with swarm-captured exploit req/resp text, parse the REQUEST +
// RESPONSE and derive PoC highlights. Heterogeneous swarm formats: a consolidated *-reqres* blob (REQUEST
// /RESPONSE delimited) OR a separate *-request + *-response pair OR a response-only item.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const EID = process.argv[2];
const SID = process.argv[3];
const q = (sql) =>
  execSync(`docker exec vacti-db-1 psql -U vacti -d vacti -tAc ${JSON.stringify(sql)}`, { encoding: 'utf8' }).trim();
const fetchText = (id) =>
  execSync(`curl -sL -b "vacti_session=${SID}" "http://localhost:3100/api/pentest-evidence/${id}" --max-time 20`, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

// findings (id + title + class) that are accepted
const rows = q(
  `select f.id||E'\t'||coalesce(f.finding_class,'')||E'\t'||replace(f.title,'\t',' ') from pentest_findings f where f.engagement_id='${EID}' and f.status='accepted' order by f.title;`,
)
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [id, cls, title] = l.split('\t');
    return { id, cls, title };
  });

function parseBlocks(text) {
  // consolidated: --- REQUEST ... --- / --- RESPONSE ... ---
  const reqM = text.match(/[-=]{2,}\s*REQUEST[^\n]*\n([\s\S]*?)(?=[-=]{2,}\s*RESPONSE)/i);
  const respM = text.match(/[-=]{2,}\s*RESPONSE[^\n]*\n([\s\S]*?)(?=[-=]{2,}\s*REQUEST|$)/i);
  if (reqM && respM) return { req: reqM[1].trim(), resp: respM[1].trim() };
  // JSON-ish evidence: look for an http request line + a status line
  const r2 = text.match(/((?:GET|POST|PUT|PATCH|DELETE)\s+\/[\s\S]*?)(?=\nHTTP\/|\n\d:\{|$)/i);
  const s2 = text.match(/(HTTP\/\d[\s\S]*?)$/i) || text.match(/(\d:\{[\s\S]*?)$/);
  if (r2 || s2) return { req: (r2 ? r2[1] : '').trim(), resp: (s2 ? s2[1] : text).trim() };
  return null;
}

function highlights(req, resp, cls) {
  const rh = [];
  const sh = [];
  const status = resp.match(/\b(200|201|204|301|302|401|403|500)\b/);
  if (status) sh.push(status[1]);
  for (const k of ['Success', 'success', 'idToken', 'accessToken', 'refreshToken', 'OTP telah diproses', 'token'])
    if (resp.includes(k)) sh.push(k);
  // request: box obvious payload values (otpCode, the bypass token)
  const otp = req.match(/"otpCode"\s*:\s*"([^"]+)"/);
  if (otp) rh.push(otp[1], 'otpCode');
  return { rh: [...new Set(rh)].slice(0, 6), sh: [...new Set(sh)].slice(0, 6) };
}

const items = [];
for (const f of rows) {
  const ev = q(
    `select id||E'\t'||evidence_key from pentest_evidence where finding_id='${f.id}' and kind='request_response' and evidence_key not like 'auto-%' order by captured_at;`,
  )
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [id, key] = l.split('\t');
      return { id, key };
    });
  if (!ev.length) {
    process.stderr.write(`skip ${f.title} (no exploit text)\n`);
    continue;
  }
  // prefer a consolidated reqres blob
  const cons = ev.find((e) => /reqres|reqresp/i.test(e.key));
  let req = '';
  let resp = '';
  if (cons) {
    const p = parseBlocks(fetchText(cons.id));
    if (p) {
      req = p.req;
      resp = p.resp;
    }
  }
  if (!req || !resp) {
    const reqI = ev.find((e) => /(^|[^a-z])req(uest)?([^a-z]|$)/i.test(e.key) && !/resp/i.test(e.key));
    const respI = ev.find((e) => /resp(onse)?/i.test(e.key));
    if (reqI) req = fetchText(reqI.id).trim();
    if (respI) resp = fetchText(respI.id).trim();
  }
  if (!resp) {
    process.stderr.write(`skip ${f.title} (could not parse req/resp)\n`);
    continue;
  }
  if (!req) req = `(* request not captured separately - see response *)`;
  const { rh, sh } = highlights(req, resp, f.cls);
  items.push({
    fid: f.id,
    reqRaw: req.slice(0, 8000),
    respRaw: resp.slice(0, 8000),
    reqHl: rh,
    respHl: sh,
    title: `${(f.cls || 'FINDING').toUpperCase()} - ${f.title}`.slice(0, 120),
  });
  process.stderr.write(`prepped ${f.title} (req ${req.length}, resp ${resp.length})\n`);
}
writeFileSync('/tmp/reqres_all_items.json', JSON.stringify(items));
process.stderr.write(`\nTOTAL prepped: ${items.length}\n`);
