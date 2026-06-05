# vacti

> Lightweight, modern, reliable **Vulnerability Assessment + Threat Intelligence** platform.
> A focused rewrite of [ReNgGinaNg](https://github.com/anggipradana/rengginang) (a hardened reNgine
> fork) — the same essential value at a fraction of the weight.

Three services — **app + worker + Postgres**. No Redis, no Celery, no Ruby. End-to-end TypeScript.

---

## What it does

- **Recon / VA** — one straight pipeline: `subfinder (optional) → httpx → naabu → nuclei`, plus
  conditional **nuclei wordfence** templates for hosts detected as WordPress. All-Go tools.
  Per-finding CVSS / CVE / references, AI enrichment, and a triage status workflow.
- **Threat Intelligence** — OTX AlienVault + LeakCheck + manual indicators + a unified **risk score**
  that is identical across the dashboard, the TI page, and the reports.
- **Reports** — redesigned **bilingual (EN/ID) PDF** reports for VA and TI (cover, TOC, donut + bar
  charts, subdomain inventory, vulnerability summary, finding cards, approval sheet), rendered with
  headless Chromium. Per-project branding (logo, colours, classification, signatories, exec summary).
- **Scans** — start/cancel, **scheduled** (cron), **sub-scan** (partial rescan), **diff** two scans,
  live SSE progress, full command + activity audit.
- **Platform** — multi-project workspaces, **RBAC** (SysAdmin / PenetrationTester / Auditor) enforced
  server-side, encrypted **API-key vault** (AES-256-GCM), audit log, universal search.
- **Integrations** — webhooks (Discord rich embed, Google Chat card, Slack, Telegram, generic),
  **AI** enrichment + executive-summary / threat-narrative generation (Claude / OpenAI / Ollama),
  and a **first-class typed REST API** with OpenAPI docs.

## Stack

Next.js 15 · React 19 · Tailwind + shadcn/ui · tRPC + Hono + Zod · PostgreSQL + Drizzle ORM ·
**pg-boss** (queue in Postgres, no Redis) · Vercel AI SDK · Playwright (e2e **and** PDF) ·
argon2id · Nx monorepo · Vitest.

---

## Quick start (local)

**Prerequisites:** Node 22+, PostgreSQL 16+, and the four ProjectDiscovery Go tools on `PATH`
(`subfinder`, `httpx`, `naabu`, `nuclei`) for real scans. Chromium for Playwright is installed on
first `playwright install`.

```bash
# 1. Configure — fill ENCRYPTION_KEY (32-byte base64) + SESSION_SECRET
cp .env.example .env

# 2. Databases (example: local Postgres role vacti/vacti)
createdb vacti

# 3. Migrate + seed default scan profiles
npm run db:migrate
npm run db:seed

# 4. Run the worker and the app (two terminals)
npx tsx apps/worker/src/main.ts
npx next dev apps/web -p 3100
```

Open <http://localhost:3100>. On first run you create the admin; then add a project → target → run a
scan → generate a report. With Docker: `make up` brings up app + worker + Postgres (migrations
auto-run).

### Environment

| Var                                                        | Required | Purpose                                               |
| ---------------------------------------------------------- | -------- | ----------------------------------------------------- |
| `DATABASE_URL`                                             | yes      | Postgres connection string                            |
| `ENCRYPTION_KEY`                                           | yes      | 32-byte base64 — AES-256-GCM vault key                |
| `SESSION_SECRET`                                           | yes      | session signing                                       |
| `OTX_API_KEY`, `LEAKCHECK_API_KEY`                         | no       | Threat-intel sources (else degrade gracefully)        |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OLLAMA_BASE_URL` | no       | AI provider (per-project key overrides via the vault) |

## Using the API

Every endpoint (except `/api/health`, `/api/openapi.json`, `/api/docs`) needs a Bearer **API token**
(create one under Settings → API tokens). Interactive docs at **`/api/docs`** (Redoc); the spec at
`/api/openapi.json`.

```bash
TOKEN=vct_xxx
# Create a target, then start a scan
curl -s -XPOST localhost:3100/api/targets -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"projectId":"<uuid>","domain":"example.com"}'
curl -s -XPOST localhost:3100/api/scans -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"targetId":"<uuid>"}'
# Poll results / cancel / diff
curl -s localhost:3100/api/scans/<id>/results -H "Authorization: Bearer $TOKEN"
```

Reports are HTTP routes that stream a PDF: `/reports/va/<scanId>?type=full&lang=id` and
`/reports/ti/<projectId>`.

## Testing & QA

Three tiers plus end-to-end (see [`docs/how-to/run-tests.md`](docs/how-to/run-tests.md)):

```bash
npm run test:quick        # unit (Vitest)
npm run test:integration  # integration (needs Postgres)
npm run e2e               # Playwright e2e (headless)
npm run e2e:ui            # Playwright UI mode (interactive — WSLg/desktop)
```

CI runs typecheck + lint + all three tiers behind a quality gate.

## Project layout

```text
apps/        web (Next.js), worker (pg-boss)
libs/        @vacti/{core,config,db,auth,queue,ui,recon,threat-intel,reports,api,integrations}
.claude/     ccpm planning — prds/ and epics/<name>/{epic.md, 00N.md}
repo-governance/  six-layer governance (vision → workflows)
docs/        Diátaxis docs (tutorials/how-to/reference/explanation) + planning/ decision records
drizzle/     SQL migrations (0000–…)
```

## Deployment

Designed to sit behind a **Cloudflare Tunnel** (no inbound ports). See
[`docs/how-to/deploy.md`](docs/how-to/deploy.md) and
[`docs/planning/03-API-AND-DEPLOY.md`](docs/planning/03-API-AND-DEPLOY.md).

## Security & scope

Only scan **authorized** targets. Secrets live only in `.env` / the encrypted vault and are never
logged or committed. RBAC is enforced server-side on every mutation. See
[`SECURITY.md`](SECURITY.md). Out-of-scope for v1: bug-bounty sync, screenshots, heavy OSINT,
multi-org, proxying.

## Documentation

- Planning & decisions: [`docs/planning/`](docs/planning/)
- Governance & conventions: [`repo-governance/`](repo-governance/)
- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## License

See [`LICENSE`](LICENSE) if present; otherwise all rights reserved (private repository).
