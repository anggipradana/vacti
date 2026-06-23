import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import pkg from '/opt/vacti-pentest-engine/node_modules/playwright-core/index.js';
const { chromium } = pkg;
const ec = await import('/opt/vacti-pentest-engine/dist/orchestrator/evidence-capture.js');
const items = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const b = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath: '/usr/bin/chromium' });
const ctx = await b.newContext({ viewport: { width: 1560, height: 1000 }, deviceScaleFactor: 2 });
for (const it of items) {
  const dir = `/tmp/render/${it.fid}`;
  mkdirSync(dir, { recursive: true });
  const combined = ec.reqRespPaneHtml(it.reqRaw, it.reqHl, it.respRaw, it.respHl, it.title);
  const reqHtml = ec.singlePaneHtml('Request', it.reqRaw, it.reqHl, it.title);
  const resHtml = ec.singlePaneHtml('Response', it.respRaw, it.respHl, it.title);
  for (const [name, html] of [
    ['proxy-reqres', combined],
    ['req', reqHtml],
    ['res', resHtml],
  ]) {
    const p = await ctx.newPage();
    await p.setContent(html, { waitUntil: 'domcontentloaded' });
    await p.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
    await p.close();
  }
  console.log(`rendered ${it.fid}`);
}
await b.close();
