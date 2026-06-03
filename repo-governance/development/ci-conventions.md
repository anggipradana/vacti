# CI Conventions

- **GitHub Actions** with **dynamic detection**: a `detect` job decides which downstream jobs run
  based on `nx affected` and changed files (code vs markdown).
- **Nx affected** everywhere — only build/test what changed; cacheable targets cached, `test:integration`
  and `test:e2e` never cached.
- **Postgres service container** (`postgres:16`) for integration and e2e jobs.
- A final **quality-gate** job depends on all others and fails if any failed (skipped = OK).
- Composite action `./.github/actions/setup-node` centralizes Node + `npm ci`.
- Keep the PR gate under ~10 minutes.
