---
name: vacti
description: Lightweight modern recon + threat-intelligence platform — simplified VA pipeline (subfinder/httpx/naabu/nuclei), full Threat Intel, bilingual PDF reports, first-class API & integrations
status: in-progress
created: 2026-06-03T19:04:06Z
---

# PRD: vacti

## Executive Summary

**vacti** is a lightweight, modern, self-hosted **Vulnerability Assessment + Threat Intelligence**
platform — a focused successor to ReNgGinaNg/reNgine. It keeps the high-value capabilities
(a clean recon pipeline, the full Threat Intelligence module, bilingual PDF reporting, AI
enrichment, a first-class API, and webhook integrations) while shedding the heavy infrastructure
(Celery/Redis/Beat, Ollama-required, Nginx multi-stage, 30+ tools, WeasyPrint/Django).

The product is delivered as a **full-stack TypeScript** application (Next.js + tRPC/Hono + Drizzle +
PostgreSQL + pg-boss), with a **pure-Go recon toolset executed by a worker** (subfinder, httpx,
naabu, nuclei — WordPress scanning via nuclei wordfence templates, no Ruby). Reports are redesigned
HTML/CSS rendered to PDF via Playwright. Infra footprint is minimal: app + worker + Postgres.

## Problem Statement

ReNgGinaNg is powerful but **heavy and complex**: dozens of overlapping scanning tools, a
multi-container Celery/Redis/Ollama/Nginx stack, Django 3.2 (aging), and Python WeasyPrint reports.
For teams that need **VA + Threat Intel** specifically, most of that surface is unused weight that
increases operational cost, error surface, and onboarding time. There is room for a tool that does
the essential 20% that delivers 80% of the value — but does it cleanly, reliably, type-safely, with
excellent CI and a modern, polished UI.

**Why now:** the recon toolset (subfinder/httpx/naabu/nuclei) is pure Go and stable; LLM provider
SDKs are mature; Next.js + shadcn make a polished dashboard cheap; pg-boss removes the need for
Redis. The lightweight modern stack is finally low-risk.

## User Stories

### Persona: Security Analyst / Pentester (primary)

- As an analyst, I want to add a target domain (optionally with predefined subdomains) and run a
  simplified VA scan, so I get subdomains → live hosts → open ports → vulnerabilities without
  configuring dozens of tools.
  - **AC:** Given a domain, when I start a scan with the default profile, then subfinder→httpx→naabu→
    nuclei run in order, results stream into the UI, and I can stop the scan mid-run.
  - **AC:** Given I provide a predefined subdomain list, when I enable "skip discovery", then
    subfinder is skipped and the pipeline starts at httpx.
- As an analyst, I want WordPress targets automatically deep-scanned, so I catch WP-specific CVEs.
  - **AC:** Given httpx (or my manual flag) marks a host as WordPress, when nuclei runs, then the
    WordPress/wordfence template set is additionally applied to that host only.
- As an analyst, I want AI-enriched vulnerability details, so triage is faster.
  - **AC:** Given a finding lacks impact/remediation, when AI enrichment is enabled, then a
    provider-abstracted LLM fills description/impact/remediation and the result is cached.

### Persona: Threat Intel Operator

- As a TI operator, I want to refresh OTX + LeakCheck data for all project domains and see a unified
  risk score, so I understand exposure at a glance.
  - **AC:** Given API keys are set, when I click "Refresh all", then per-domain OTX (pulses,
    reputation, malware, passive DNS) and LeakCheck (leaked credentials) are fetched with a live
    progress indicator, and a 0–100 risk score is computed consistently with the dashboard & report.
- As a TI operator, I want to mark leaked credentials as reviewed, so the risk score reflects triage.
  - **AC:** Given unchecked leaked credentials, when I toggle "checked", then the credential-exposure
    component of the risk score decreases proportionally.
- As a TI operator, I want to add manual indicators (domain/subdomain/IP), so I can track items not
  tied to a scanned target.

### Persona: Report Consumer / Manager

- As a manager, I want a polished bilingual (EN/ID) PDF report for VA and for Threat Intel, branded
  per project, so I can share results with stakeholders.
  - **AC:** Given a completed scan/TI refresh, when I generate a report, then a redesigned PDF is
    produced with project branding (logo, colors, doc number, classification, signatories) in the
    selected language.

### Persona: Platform Admin / Integrator

- As an admin, I want role-based access (SysAdmin/PenTester/Auditor) and an API-token, so I can
  automate scans from CI and restrict permissions.
  - **AC:** Given an API token with PenTester role, when I POST to the scan-start endpoint, then a
    scan starts; an Auditor token is denied (403).
- As an integrator, I want scan/finding events pushed to Discord/Slack/Telegram/Google Chat, so my
  team is notified.
  - **AC:** Given a configured webhook and event triggers, when a scan completes or a high/critical
    finding appears, then a formatted message is delivered to the channel.

## Functional Requirements

### FR1 — Recon / VA engine

- Single linear pipeline: **subfinder (optional)** → **httpx** → **naabu** → **nuclei**
  (+ nuclei WordPress/wordfence templates conditionally).
- Scan profiles (lightweight config): which stages enabled, ports (e.g. top-100/custom), nuclei
  severities & tags, rate-limit/threads/timeout. No sprawling YAML.
- Start / stop / status; real-time progress (SSE); per-stage activity log; tool command + output
  captured for audit.
- WordPress detection: httpx tech fingerprint → URL pattern → manual flag.
- Scheduled scans via lightweight cron.

### FR2 — Threat Intelligence (full)

- OTX AlienVault: per-domain general (pulses, reputation, WHOIS), malware, passive DNS, URL list;
  global subscribed pulses feed.
- LeakCheck: domain & origin (stealer-log) credential search; checked/unchecked tracking via hash.
- Manual indicators (domain/subdomain/IP) with OTX lookup.
- `calculateRiskScore()` — single source of truth, 5 components with VA (VA 40 / Leak 30 /
  Exposure 12 / Reputation 10 / Malware 8) and 4-component redistribution without VA; used by
  dashboard, TI page, and reports.
- Refresh-all & per-domain refresh with progress polling/streaming.

### FR3 — Reports

- VA report and Threat Intel report as **redesigned** HTML/CSS → PDF (Playwright; Typst optional).
- Bilingual EN/ID; per-project branding (logo, primary/secondary color, document number,
  classification label, footer, signatories/approval sheet).
- Inline view + download.

### FR4 — Project & target management

- Projects (multi-tenant, slug-scoped); targets (domain/org, predefined subdomains, custom request
  headers); scan history with diff vs previous scan; recon notes (lightweight).

### FR5 — Integrations

- Webhook notifications: Discord, Slack, Telegram, Google Chat (Lark optional); configurable per-event
  triggers (scan status, vuln found, subdomain change).
- AI provider abstraction (Vercel AI SDK): Claude (default), OpenAI, Ollama — vuln enrichment,
  executive summary, threat analysis; response caching.
- Encrypted API key vault: OTX, LeakCheck, AI providers (+ any future source).

### FR6 — API & auth

- Typed internal API (tRPC) + public REST (Hono) with auto-generated OpenAPI.
- Auth: session (UI) + API token (automation).
- RBAC roles: SysAdmin / PenTester / Auditor with permissions {modify_system_config,
  modify_scan_config, modify_scan_results, modify_report, initiate_scans, modify_targets}.
- Realtime scan progress over SSE.

### FR7 — Dashboard & UI

- Project dashboard: target/subdomain/endpoint/vuln counts, severity breakdown, 7-day trends, TI
  summary cards (risk score, pulses, malware, leaks), IoC/CVE/leak analytics.
- Data tables with server-side filtering/sorting/pagination; charts (donut/bar/area); dark mode;
  WCAG AA.

## Non-Functional Requirements

- **Lightweight:** runtime = app + worker + Postgres; image carries 4 Go binaries + nuclei templates
  - Chromium (Playwright). No Redis/Celery/Ollama-required/Ruby.
- **Reliable:** jobs survive worker restarts (pg-boss visibility timeout + retries); scans are
  cancellable; idempotent completion (no stuck "running" scans).
- **Type-safe / low-error:** end-to-end TypeScript types (DB→API→UI) via Drizzle + Zod + tRPC.
- **Secure:** secrets only in `.env.example` template; API keys encrypted at rest; RBAC enforced
  server-side; no secret in logs/commits (hook guards).
- **Performant:** dashboard queries < 300 ms p95 on typical project; report generation < 10 s.
- **Accessible:** WCAG AA contrast, keyboard nav, screen-reader labels.
- **Observable:** structured logs, scan activity timeline, per-tool command/output captured.
- **Tested:** unit (Vitest), integration (Postgres service), e2e (Playwright) — all gated in CI.

## Success Criteria (measurable)

- A user can go Add Target → Run Scan → View Results → Generate bilingual PDF in < 10 minutes on a
  fresh install with only `docker compose up` + Postgres.
- Full VA scan of a single domain (default profile) completes and reports reliably (0 stuck scans
  across 50 consecutive runs in test).
- Risk score is identical (±0) across dashboard, TI page, and PDF for the same data set.
- CI pipeline green on PR with: typecheck, lint, unit, integration, e2e — under ~10 min.
- Cold-start container footprint significantly smaller than ReNgGinaNg (target: ≤ 3 services,
  single app image < 1.5 GB incl. tools + Chromium).
- AI enrichment cache hit ratio > 80% on repeated scans of the same target.

## Constraints & Assumptions

- Self-hosted, single-tenant org deployment (multi-project, not multi-customer SaaS) for v1.
- External APIs (OTX, LeakCheck, LLM providers) require user-supplied keys; features degrade
  gracefully when absent.
- Recon tools are executed as subprocesses (well-maintained Go binaries) — not embedded as libs.
- Scan scale is moderate (self-hosted, bounded targets), not internet-scale concurrency.
- Network egress to scan targets and external APIs is permitted in the deployment environment.

## Out of Scope (v1)

- Bug bounty mode & HackerOne integration (sync/import/submit).
- Screenshots (EyeWitness/Selenium/Firefox).
- Extra subdomain tools (amass, sublist3r, oneforall, ctfr, tlsx, netlas, chaos).
- URL crawling/fetching (gospider, gau, waybackurls, hakrawler, katana) + GF patterns.
- Directory/file fuzzing (ffuf); extra scanners (dalfox, crlfuzz, s3scanner, nmap+NSE).
- Heavy OSINT (theHarvester, dorking/GooFuzz, h8mail, metafinder, CMSeeK), WAF detection.
- Complex WHOIS/domain-info enrichment (Netlas/ViewDNS/historical IP) — may return as a small
  optional add-on later.
- Ruby-based WPScan (replaced by nuclei WordPress/wordfence templates).
- Multi-customer SaaS billing/tenancy.

## Dependencies

- **Runtime tools:** subfinder, httpx, naabu, nuclei (+ nuclei-templates incl. WordPress/wordfence).
- **External APIs:** OTX AlienVault, LeakCheck, LLM providers (Anthropic/OpenAI/Ollama).
- **Core libs:** Next.js, React, tRPC, Hono, Zod, Drizzle ORM, drizzle-kit, pg-boss, PostgreSQL,
  Vercel AI SDK, Playwright (e2e + PDF), Tailwind, shadcn/ui, Recharts/Visx.
- **Tooling:** Nx, Vitest, Playwright, ESLint, Prettier, commitlint, Husky, markdownlint-cli2,
  GitHub Actions.
- **Methodology references:** ccpm (planning), ose-primer (governance/conventions/CI).

## Proposed Epics (decomposition preview)

1. **platform-foundation** — Nx monorepo, Next.js+worker apps, Postgres+Drizzle, CI/Husky/commitlint,
   governance docs, `.env` guards, base auth + RBAC. (Phase 0)
2. **recon-engine** — pg-boss pipeline, tool runners (subfinder/httpx/naabu/nuclei), parsers, scan
   profiles, start/stop/SSE progress, scheduled scans, data models.
3. **threat-intel** — OTX + LeakCheck clients, models, manual indicators, risk score, refresh flow.
4. **reports** — redesigned bilingual VA + TI templates, Playwright PDF service, branding settings.
5. **api-and-integrations** — public REST + OpenAPI, API tokens, webhook notifiers, AI provider
   abstraction + caching, encrypted key vault.
6. **dashboard-ui** — dashboards, data tables, charts, scan results UI, TI page, settings, dark mode.

(Each becomes a ccpm epic under `.claude/epics/<name>/` with numbered tasks.)

## Status & remaining backlog (2026-06-04)

Foundation, recon engine, threat-intel, reports, and API/integrations are **implemented and CI-green**;
reports reached component parity with ReNgGinaNg (incl. logo, signatures, CVSS/CVE/references, custom
exec summary). A code-level audit reconciled `.claude/epics/` with reality (30 tasks closed; 12 open
tasks carry a `## Status (2026-06-04)` note for remaining work).

Remaining v1 backlog is tracked as **G1–G17** with task mapping in
[docs/planning/06-GAP-ANALYSIS.md §J](../../docs/planning/06-GAP-ANALYSIS.md) and the addendum in
[docs/planning/02-FEATURE-PARITY-CHECKLIST.md](../../docs/planning/02-FEATURE-PARITY-CHECKLIST.md).
Top priority: **G1 RBAC enforcement** (roles/matrix exist but are not enforced server-side). Out of
v1: proxy support, multi-org, WHOIS, in-app notification feed.
