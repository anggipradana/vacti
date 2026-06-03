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

- Don't add scanners/tools outside the approved set (subfinder/httpx/naabu/nuclei + wordfence).
- Don't introduce Redis, Celery, WeasyPrint, or Ruby.
- Don't bypass Husky hooks or the CI quality gate.
