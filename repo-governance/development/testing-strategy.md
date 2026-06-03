# Testing Strategy (3-tier)

| Tier | Nx target | Cached | Runs | Scope |
| ---- | --------- | ------ | ---- | ----- |
| Unit | `test:quick` / `test:unit` | yes | Vitest | pure logic, parsers, risk-score, formatters |
| Integration | `test:integration` | no | Vitest + Postgres service | DB, auth, queue, clients (mock HTTP) |
| E2E | `test:e2e` | no | Playwright + app/worker + Postgres | user flows, smoke |

- Unit tests must be fast and deterministic (no network, no DB).
- Integration tests use a real Postgres (service container) and mock external HTTP (OTX/LeakCheck/AI).
- E2E covers critical journeys: login → project → token; later, scan → results → report.
- Coverage thresholds enforced on critical modules (auth, RBAC, queue, risk-score).
