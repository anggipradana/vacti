# Quality Gates

A change may merge only when **all** of these pass (locally via hooks, enforced in CI):

1. **Format** - `prettier --check .`
2. **Typecheck** - `nx affected -t typecheck`
3. **Lint** - `nx affected -t lint` + `lint:md` (markdownlint)
4. **Unit** - `nx affected -t test:quick`
5. **Integration** - `nx affected -t test:integration` (Postgres service)
6. **E2E** - `nx affected -t test:e2e` (Playwright + Postgres)
7. **Commits** - Conventional Commits (commitlint)
8. **Secrets** - no `.env*` except `.env.example` (pre-commit guard)

Local enforcement: Husky **pre-commit** (identity + no-env + lint-staged), **commit-msg**
(commitlint), **pre-push** (affected typecheck/lint/test:quick + markdown lint).
