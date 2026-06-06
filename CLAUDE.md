# CLAUDE.md

> Think carefully and implement the most concise solution that changes as little code as possible.

## What vacti is

A lightweight VA + Threat Intelligence platform (rewrite of ReNgGinaNg). Full-stack TypeScript,
Nx monorepo, Next.js + worker + Postgres. See [README.md](README.md) and
[docs/explanation/architecture.md](docs/explanation/architecture.md).

## Ground rules (from repo-governance)

- **Simplicity & lightness first.** No Redis/Celery/Ollama-required/Ruby. Three services.
- **Type-safety end to end:** Drizzle → Zod → tRPC → UI. Don't break the type chain.
- **Reliability:** jobs idempotent + cancellable; no stuck scans. Risk score identical everywhere (±0).
- **Security:** secrets only in `.env.example`; keys encrypted at rest; RBAC enforced server-side;
  never log or commit secrets.

## Planning (ccpm)

- PRDs in `.claude/prds/`, epics + numbered tasks in `.claude/epics/<name>/`.
- Feature scope is bounded by [docs/planning/02-FEATURE-PARITY-CHECKLIST.md](docs/planning/02-FEATURE-PARITY-CHECKLIST.md).
  Items marked ❌ must NOT be implemented in v1.

## Conventions

- Conventional Commits (commitlint). Prettier `printWidth: 120`. Markdown linted.
- Tests: 3-tier — `test:quick` (unit), `test:integration` (Postgres), `test:e2e` (Playwright).
- Run `npm run typecheck && npm run lint && npm run test:quick` before pushing.

## Don't

- Don't add **active** scanners/tools outside the approved set (subfinder/httpx/naabu/nuclei + wordfence).
  Passive **OSINT sources** are allowed but must be **HTTP-API clients only** (no new binary): currently
  VirusTotal + Wayback Machine (URLScan optional). Active crawlers (gospider/hakrawler/katana) stay out.
  See [11-PASSIVE-RECON-AND-EXPOSURE.md](docs/planning/11-PASSIVE-RECON-AND-EXPOSURE.md).
- Don't introduce Redis, Celery, WeasyPrint, or Ruby — incl. for API-key rotation/quota/backoff
  (keep those in Postgres: `next_available_at` + usage counters, never Redis/BullMQ).
- Don't deep-fetch discovered content without the SSRF guard (block localhost/`.local`/cloud-metadata/
  private+reserved IPs) + size cap; deep-fetch is opt-in. Treat exposure-finding snippets as
  confidential PII (mask in UI, CONFIDENTIAL in reports, never log) — same as LeakCheck plaintext.
- Don't bypass Husky hooks or the CI quality gate.
