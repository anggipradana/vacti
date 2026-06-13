# Contributing to vacti

## Workflow (trunk-based)

1. Branch from up-to-date `main` (`epic/<name>` for ccpm epic work).
2. Make focused changes; follow [repo-governance/](repo-governance/).
3. Commit with **Conventional Commits** (`feat(recon): ...`). commitlint enforces this.
4. Push - Husky pre-push runs `nx affected` typecheck/lint/test + markdown lint.
5. Open a PR; the **Quality Gate** workflow must pass (format, typecheck, lint, unit, integration, e2e).

## Local setup

```bash
npm ci
cp .env.example .env   # fill secrets
npm run dev            # or: make up
```

## Standards

- Prettier `printWidth: 120`; ESLint clean; markdownlint clean.
- Add tests at the right tier (see [testing-strategy](repo-governance/development/testing-strategy.md)).
- Keep within the [feature scope](docs/planning/02-FEATURE-PARITY-CHECKLIST.md). Out-of-scope items
  (bug bounty, screenshots, extra scanners, Ruby, etc.) are rejected.

## Hooks

Husky: **pre-commit** (git identity + no-`.env` + lint-staged), **commit-msg** (commitlint),
**pre-push** (affected gate). Do not bypass with `--no-verify` except for emergencies.
