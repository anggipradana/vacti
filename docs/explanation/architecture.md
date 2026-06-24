# Architecture & Design Rationale (Explanation)

vacti is a lightweight, self-hosted platform focused on Vulnerability Assessment + Threat
Intelligence.

## Shape

- **app** (Next.js 15): UI + tRPC + Hono REST (`/api`) + OpenAPI + SSE.
- **worker** (Node): pg-boss consumer running the recon pipeline, TI refresh, report rendering.
- **db** (PostgreSQL 16): application data **and** the job queue (pg-boss schema). No Redis.

These three services are the whole of vacti. The **AI Penetration Test** module adds an
optional second runtime, the [vacti-pentest-engine](https://github.com/anggipradana/vacti-pentest-engine)
on Kali. It is a **separate deploy unit** (its own repo + governance), not a fourth service: vacti
holds the control plane (engagement tables, `/api/pentest/*`, dashboard, pentest report) while the
engine runs the offensive agent swarm. The link is **one-way** - the engine reaches vacti outbound
only to pull authorized engagements and write back findings + evidence - so vacti stays lightweight
and has no inbound dependency on the engine.

## Why these choices

- **pg-boss over Celery/Redis:** one datastore, fewer moving parts, jobs survive restarts.
- **All-Go recon tools** (subfinder/httpx/naabu/nuclei) + **nuclei wordfence** for WordPress instead
  of Ruby WPScan - single engine, no Ruby runtime.
- **Playwright for PDF** (same engine as e2e) - freedom to redesign reports; no WeasyPrint/Python.
- **Unified risk score** is a pure function reused by dashboard, TI page, and report → identical (±0).

See [`docs/planning/`](../planning/) for the full decision record and feature parity checklist.
