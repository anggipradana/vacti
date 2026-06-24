# CLAUDE.md

> Think carefully and implement the most concise solution that changes as little code as possible.

## What vacti is

A lightweight, self-hosted Vulnerability Assessment + Threat Intelligence platform. Full-stack
TypeScript, Nx monorepo, Next.js + worker + Postgres. See [README.md](README.md) and
[docs/explanation/architecture.md](docs/explanation/architecture.md).

## Ground rules (from repo-governance)

- **Simplicity & lightness first.** No Redis/Celery/Ollama-required/Ruby. Three services.
- **Type-safety end to end:** Drizzle → Zod → tRPC → UI. Don't break the type chain.
- **Reliability:** jobs idempotent + cancellable; no stuck scans. Risk score identical everywhere (±0).
- **Security:** secrets only in `.env.example`; keys encrypted at rest; RBAC enforced server-side;
  never log or commit secrets.

## Planning

- Plans in `plans/` (backlog/, in-progress/, done/) following the
  [Plans Organization Convention](repo-governance/conventions/structure/plans.md).
  Quick ideas in `plans/ideas.md`.
- Feature scope bounded by [docs/planning/02-FEATURE-PARITY-CHECKLIST.md](docs/planning/02-FEATURE-PARITY-CHECKLIST.md).
  Items marked ❌ must NOT be implemented in v1.
- Plan agents: `plan-maker`, `plan-checker`, `plan-fixer`, `plan-execution-checker`.
- Pre-write and post-write grilling required (structured 2-4 option questions via `grill-me` skill).
- Anti-hallucination: verify all file paths, Nx targets, and commands before writing them into plans.

## Conventions

- Conventional Commits (commitlint). Prettier `printWidth: 120`. Markdown linted.
- Tests: 3-tier - `test:quick` (unit), `test:integration` (Postgres), `test:e2e` (Playwright).
- Run `npm run typecheck && npm run lint && npm run test:quick` before pushing.

## Don't

- Don't add **active** scanners/tools outside the approved set (subfinder/httpx/naabu/nuclei + wordfence).
  Passive **OSINT sources** are allowed but must be **HTTP-API clients only** (no new binary): currently
  VirusTotal + Wayback Machine (URLScan optional). Active crawlers (gospider/hakrawler/katana) stay out.
  See [11-PASSIVE-RECON-AND-EXPOSURE.md](docs/planning/11-PASSIVE-RECON-AND-EXPOSURE.md).
- Don't introduce Redis, Celery, WeasyPrint, or Ruby - incl. for API-key rotation/quota/backoff
  (keep those in Postgres: `next_available_at` + usage counters, never Redis/BullMQ).
- Don't deep-fetch discovered content without the SSRF guard (block localhost/`.local`/cloud-metadata/
  private+reserved IPs) + size cap; deep-fetch is opt-in. Treat exposure-finding snippets as
  confidential PII (mask in UI, CONFIDENTIAL in reports, never log) - same as LeakCheck plaintext.
- Don't ship a resource without **full CRUD** (create/read/update/delete) in UI + typed API.
  Destructive actions must enforce RBAC server-side, confirm in the UI (`ConfirmButton`), `recordAudit`,
  cascade via FK `onDelete`, and protect invariants (e.g. last SysAdmin). See principle 10 +
  §10 of [02-FEATURE-PARITY-CHECKLIST.md](docs/planning/02-FEATURE-PARITY-CHECKLIST.md).
- Don't sacrifice **reliability or speed** - they are must-haves (principle 11). Live app runs a
  production build (`next start`) under a supervisor, never `next dev`; app + worker self-heal.
  Keep navigation instant (shared `app/(app)/` shell layout + `loading.tsx`, `next/link` not `<a>`);
  do minimum work per request (SQL-side filter/paginate, `Promise.all`, per-request `cache()`); never
  block on the network without a timeout + visible pending state. Treat perf/reliability regressions
  as bugs.
- Don't bypass Husky hooks or the CI quality gate.
- Don't use em/en dashes (`—` / `–`) anywhere: docs, UI strings, comments, commit messages. They
  read as AI-generated. Use a plain hyphen `-`, a colon, or split the sentence. (The only exceptions
  are the strip regexes in `libs/integrations/src/ai.ts` + `libs/reports/src/shared.ts`, which must
  contain the characters to remove them from generated output.)
