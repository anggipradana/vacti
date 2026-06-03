# vacti

> Lightweight, modern, reliable **Vulnerability Assessment + Threat Intelligence** platform.
> A focused rewrite of [ReNgGinaNg](https://github.com/anggipradana/rengginang) (a hardened reNgine
> fork) — same essential value, a fraction of the weight.

## What it does

- **Recon / VA** — one straight pipeline: `subfinder (optional) → httpx → naabu → nuclei`, plus
  conditional **nuclei wordfence** templates for hosts detected as WordPress. All-Go tools, no Ruby.
- **Threat Intelligence** — OTX AlienVault + LeakCheck + manual indicators + a unified **risk score**,
  consistent across dashboard, TI page, and reports.
- **Reports** — redesigned bilingual (EN/ID) PDF reports for VA and TI, rendered with Playwright.
- **Project management**, **first-class typed API** (OpenAPI), **webhook + AI integrations**, **RBAC**.

## Stack

Next.js 15 · React 19 · Tailwind + shadcn/ui · tRPC + Hono + Zod (OpenAPI) · PostgreSQL + Drizzle ORM ·
**pg-boss** (queue in Postgres, no Redis) · Vercel AI SDK (Claude/OpenAI/Ollama) · Playwright
(e2e + PDF) · Nx monorepo · Vitest. Runtime = **app + worker + Postgres**.

## Quick start

```bash
cp .env.example .env   # fill ENCRYPTION_KEY, SESSION_SECRET
make up                # app + worker + postgres (migrations auto-run)
```

## Project layout

```
apps/        web (Next.js), worker (pg-boss)
libs/        @vacti/{core,config,db,auth,queue,ui,recon,threat-intel,reports,api,integrations}
.claude/     ccpm planning — prds/ and epics/<name>/{epic.md, 00N.md}
repo-governance/  six-layer governance (vision→workflows)
docs/        Diátaxis docs (+ planning/ decision records)
```

## Documentation

- Planning & decisions: [`docs/planning/`](docs/planning/)
- Governance & conventions: [`repo-governance/`](repo-governance/)
- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md) · Security: [`SECURITY.md`](SECURITY.md)

## Status

Planning complete (PRD + 6 epics + 42 tasks + governance). Implementation starts with the
**platform-foundation** epic. See [`.claude/epics/`](.claude/epics/).
