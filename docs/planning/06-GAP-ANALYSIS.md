# vacti — Gap Analysis vs ReNgGinaNg (re-audit)

> Re-audit of ReNgGinaNg (integration, reports, and all in-scope areas) to catch features vacti
> missed or under-specified. Legend: ✅ have · 🟡 partial · ❌ missing. Action: **ADD** (do soon) ·
> _improve_ · later · skip (out of scope).

**STATUS 2026-06-04** — Priority items 1–3 below (finding status, reports, integrations) are
**SHIPPED**. A code-level audit reconciled the planning with reality: recon, threat-intel, reports,
AI/webhooks and REST/OpenAPI are implemented and CI-green; report parity is component-complete
(logo, signatures, TOC, donut/bars, vuln-summary, CVSS/CVE/refs, custom exec summary). The remaining
backlog is catalogued as **G1–G17** in
[02-FEATURE-PARITY-CHECKLIST.md](02-FEATURE-PARITY-CHECKLIST.md) and mapped to ccpm tasks (see §J).
Epic/task statuses in `.claude/epics/` were synced (30 tasks closed; 12 open carry a
`## Status (2026-06-04)` note describing remaining work).

## A. Findings / vulnerabilities

| Feature                                                      | vacti                      | Action                                     |
| ------------------------------------------------------------ | -------------------------- | ------------------------------------------ |
| Severity scale -1..4                                         | ✅                         | —                                          |
| CVE / CWE / CVSS (score + metrics vector)                    | 🟡 (cve[]/cwe[]/cvss text) | _improve_: add `cvss_metrics`, keep arrays |
| References list (nuclei `reference`)                         | ❌                         | **ADD** `references text[]`                |
| `curl_command` (repro)                                       | ❌                         | **ADD** (nuclei `curl-command`)            |
| `extracted_results` (nuclei matches)                         | ❌                         | **ADD** `extracted_results text[]`         |
| `matcher_name`, template_url                                 | 🟡 (templateId only)       | **ADD** matcher_name + template_url        |
| Triage status (open/closed + lifecycle)                      | 🟡 (planned 05)            | **ADD now** (this task)                    |
| request / response capture                                   | ✅                         | —                                          |
| Dedup                                                        | ✅                         | —                                          |
| `is_ai_enriched` flag + AI desc/impact/remediation           | ❌                         | later (with AI integration)                |
| Manual add/edit vuln, bulk status actions, per-finding notes | ❌                         | later                                      |

## B. Subdomains / endpoints / ports / IPs

| Feature                                                                     | vacti              | Action                                     |
| --------------------------------------------------------------------------- | ------------------ | ------------------------------------------ |
| Endpoint: url/host/port/scheme/title/webserver/status/length/tech/WordPress | ✅                 | —                                          |
| `is_important` flag (subdomain/endpoint)                                    | ❌                 | **ADD** small important/star flag          |
| CNAME / is_cdn / cdn_name                                                   | 🟡 (httpx has cdn) | _improve_: persist cdn + cname on endpoint |
| response_time, content_type                                                 | ❌                 | **ADD** (httpx provides)                   |
| Port `is_uncommon` + service_name                                           | 🟡 (ip/port/proto) | **ADD** is_uncommon flag + service         |
| IP is_cdn / is_private / reverse_pointer / geo                              | ❌                 | later (enrichment)                         |
| Interesting-keyword lookup (title/url/200)                                  | 🟡 (table planned) | **ADD** keyword match + "interesting" mark |

## C. Scan engine / profile config

ReNgGinaNg YAML exposes far more knobs. vacti `scan_profiles` should grow (still simpler than reNgine):

| Option                                             | vacti                       | Action                                         |
| -------------------------------------------------- | --------------------------- | ---------------------------------------------- |
| tools on/off, ports, severities, rate, timeout     | ✅                          | —                                              |
| threads, retries, concurrency                      | ❌                          | **ADD** to profile                             |
| nuclei `tags` + `templates` + `custom_templates`   | 🟡 (severities only)        | **ADD** tags/templates to profile              |
| follow_redirect, intensity                         | ❌                          | _improve_ (optional)                           |
| exclude paths / out-of-scope subdomains (per scan) | ❌                          | **ADD** scan-scoping fields                    |
| custom headers (per target)                        | ✅ (targets.custom_headers) | wire into httpx/nuclei                         |
| proxy support                                      | ❌                          | **ADD** (system/profile proxy → pass to tools) |

## D. Scan lifecycle

| Feature                                                      | vacti                    | Action                               |
| ------------------------------------------------------------ | ------------------------ | ------------------------------------ |
| status states (queued/running/completed/failed/cancelled)    | ✅                       | —                                    |
| scan_activity timeline + commands (audit, exit code, output) | ✅                       | —                                    |
| subscan / rescan                                             | 🟡 (table + planned API) | implement (recon #007/#009)          |
| scan diff / compare                                          | 🟡 (diffScans planned)   | implement + UI                       |
| stop / cancel (AbortSignal)                                  | 🟡 (pipeline ready)      | wire cancel via queue + UI           |
| scheduled scans (cron)                                       | ❌ (planned)             | implement (recon #009)               |
| `initiated_by` / `aborted_by` (actor)                        | ❌                       | **ADD** actor FKs (multi-user audit) |

## E. Target / project

| Feature                                                     | vacti              | Action                                |
| ----------------------------------------------------------- | ------------------ | ------------------------------------- |
| project workspace + scoping                                 | ✅                 | —                                     |
| target domain + predefined subs + custom headers            | ✅                 | —                                     |
| target description / metadata                               | ❌                 | **ADD** description                   |
| Organizations (group targets)                               | ❌                 | later (optional grouping)             |
| target tags, ip_cidr scope                                  | ❌                 | later                                 |
| recon notes / todos (per target/scan, is_done/is_important) | 🟡 (table planned) | **ADD** notes CRUD + UI               |
| WHOIS/DNS metadata (DomainInfo, registrar, historical IP)   | ❌                 | skip v1 (heavy; small optional later) |

## F. Dashboard / analytics

| Feature                                                        | vacti | Action                   |
| -------------------------------------------------------------- | ----- | ------------------------ |
| counts, severity breakdown, 7-day trend, modules, recent scans | ✅    | —                        |
| **Most vulnerable targets** widget                             | ❌    | **ADD** (easy, valuable) |
| **Most common vulnerability** widget                           | ❌    | **ADD** (easy, valuable) |
| Universal search (+ history)                                   | ❌    | later                    |
| In-app notification feed                                       | ❌    | later                    |

## G. Settings / admin / RBAC

| Feature                                        | vacti            | Action                                                                      |
| ---------------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| RBAC SysAdmin/PenTester/Auditor + matrix       | ✅               | —                                                                           |
| Users management UI (assign role)              | 🟡 (planned)     | **ADD** users+roles settings page                                           |
| Scan-profile CRUD UI                           | 🟡 (API planned) | **ADD** profiles settings UI                                                |
| API key vault (encrypted) + UI                 | 🟡 (table only)  | **ADD** vault UI (integrations)                                             |
| Notification settings (per-event, per-project) | ❌               | **ADD** (integrations) — per-project (improves on reNgine global singleton) |
| Proxy settings                                 | ❌               | **ADD**                                                                     |
| External tool version display                  | ❌               | later (small)                                                               |

## H. Reports (build target — match reNgine component-for-component, then improve)

VA report sections (reNgine `default.html`/`modern.html`): cover · TOC · **approval/signatory sheet**
(Prepared/Reviewed/Approved) · executive summary (placeholder vars + optional AI remediation) · quick
summary · assessment timeline · summary-of-findings charts (severity donut, http-status donut) ·
interesting recon · vulnerability summary table · reconnaissance results (subdomains/IPs/ports) ·
**vulnerability details** (severity badge, source, CVSS score+metrics, CVE, CWE, description, impact,
remediation, vulnerable URLs, references) · end-of-report. Types: **recon / vuln / full**.

TI report sections (`report_banking.html`): cover (classification) · TOC · approval sheet · document
control · executive summary (risk score + stat cards + **risk meter**) · financial/threat overview
(**banking_keywords** filter) · **IoC** table (+ manual indicators) · **CVE highlights** · **data
breach & exposure monitoring** (checked/unchecked) · **severity & risk assessment** (per-component
breakdown) · **recommended actions** (immediate + ongoing) · end.

Report settings: primary/secondary color, company name/address/email/website/logo, document_number,
classification_label, footer toggle+text, language EN/ID, show_executive_summary, banking_keywords,
exec-summary text (EN+ID with placeholders). **Signatories**: role(prepared/reviewed/approved), name,
position, signature image, order (max 3). **Improvements over reNgine**: render via Playwright (not
WeasyPrint), redesigned modern layout, Recharts/SVG charts, finding-status-aware (exclude resolved/
false-positive from counts), download + inline.

## I. Integrations (build target)

- **Notifications** — channels: Discord (rich embeds, severity colors, rate-limit retry, file attach,
  embed field updates), Slack, Telegram (markdown), Google Chat, Lark. Per-event toggles: scan
  started/finished/failed, vuln found (by severity), interesting found, subdomain changes, TI
  refreshed, report ready, tracebacks. Message enrichment (scan id, status, engine, duration, host,
  link). **Improve**: per-project config (reNgine is a global singleton), retry/backoff, templates.
- **AI** — vuln enrichment (description/impact/remediation/references), attack-suggestion, executive-
  summary remediation; bilingual (EN/ID); cache by content hash. **Improve**: Vercel AI SDK provider
  abstraction (Claude default / OpenAI / Ollama) vs reNgine's OpenAI/Ollama only.
- **API key vault** — OTX, LeakCheck, AI provider keys; **encrypted at rest (AES-256-GCM)** — improves
  on reNgine plaintext. UI to set/rotate, masked display.
- **Public REST + OpenAPI** — already have typed REST (Hono); **ADD** auto OpenAPI doc + Redoc/Swagger.
- **Scheduled jobs** — TI refresh (cron) + nuclei-templates update (cron).
- skip: HackerOne sync, in-app notification center (later).

## J. Priority — status & remaining backlog (updated 2026-06-04)

**Shipped:**

1. ✅ **Finding status** (A triage) — VA + leak status, risk-score-aware.
2. ✅ **Reports** — VA + TI (Playwright), all sections + settings + signatories + parity additions
   (logo, signature images, CVSS/CVE/references, custom exec summary, TOC, donut/bars,
   subdomain-inventory + status pills, vuln-summary). See reports epic 001–007.
3. ✅ **Integrations** — 5-channel webhooks (per-project, per-event), AI enrichment + cache, AI provider
   abstraction (Anthropic/OpenAI/Ollama), REST + OpenAPI/Redoc.
4. ✅ **Folded quick-adds done**: vuln `references`/CVSS/CVE; dashboard "most common vuln" +
   "top targets by active findings".

**Remaining backlog (G1–G17 → ccpm task):**

| Gap | Item                                        | Task                                          |
| --- | ------------------------------------------- | --------------------------------------------- |
| G1  | RBAC enforcement (server-side) — _priority_ | platform-foundation #005                      |
| G2  | Scan cancel UI + API route                  | recon-engine #007 + dashboard-ui #004         |
| G3  | Scheduled scans (pg-boss cron)              | recon-engine #009                             |
| G4  | Scan diff / compare                         | recon-engine #005 + dashboard-ui #004         |
| G5  | Sub-scan / partial rescan                   | recon-engine #007                             |
| G6  | API key vault UI (per-project)              | platform-foundation #007 + api-and-integ #005 |
| G7  | AI executive summary (auto-generate)        | api-and-integrations #004                     |
| G8  | AI threat-analysis narrative                | api-and-integrations #004                     |
| G9  | argon2id password hashing                   | platform-foundation #004                      |
| G10 | Audit-log writes + viewer                   | platform-foundation #010 (new)                |
| G11 | Server-side datatables                      | dashboard-ui #002                             |
| G12 | Wire custom request headers into httpx      | recon-engine #008                             |
| G13 | Universal search                            | dashboard-ui #006                             |
| G14 | Recon notes / todos                         | recon-engine #008                             |
| G15 | Interesting keywords                        | recon-engine #008                             |
| G16 | Seed / fixtures                             | platform-foundation #011 (new)                |
| G17 | Onboarding walkthrough                      | dashboard-ui #007 (new)                       |

Suggested order: **G1 → G2 → G3 → G6 → G4/G5 → rest.** Out of v1: proxy support, multi-org, WHOIS,
in-app notification feed.
