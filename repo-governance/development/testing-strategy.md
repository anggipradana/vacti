# Testing Strategy (3-tier)

| Tier        | Nx target                  | Cached | Runs                               | Scope                                       |
| ----------- | -------------------------- | ------ | ---------------------------------- | ------------------------------------------- |
| Unit        | `test:quick` / `test:unit` | yes    | Vitest                             | pure logic, parsers, risk-score, formatters |
| Integration | `test:integration`         | no     | Vitest + Postgres service          | DB, auth, queue, clients (mock HTTP)        |
| E2E         | `test:e2e`                 | no     | Playwright + app/worker + Postgres | user flows, smoke                           |

- Unit tests must be fast and deterministic (no network, no DB).
- Integration tests use a real Postgres (service container) and mock external HTTP (OTX/LeakCheck/AI).
- E2E covers critical journeys: login → project → token; later, scan → results → report.
- Coverage thresholds enforced on critical modules (auth, RBAC, queue, risk-score).

## Multi-tenant / multi-project scoping (mandatory)

vacti is multi-project: targets, scans, schedules, findings, and TI all belong to a project. A
single-project test cannot prove a list view scopes correctly, because "show all" and "show this
project" look identical with one project. Therefore:

- Every project-scoped list view (page or API) MUST filter to an active project, never fetch across
  all projects.
- The e2e suite MUST keep a multi-project regression test that creates two projects with distinct
  data and asserts each scoped view shows only the active project's rows and never the other's
  (`apps/web/e2e/05-multi-project.e2e.ts`).
- When adding a new project-scoped list, extend that test rather than relying on a single-project
  happy path.
