# Layer 1 — Principles

Values that govern every convention and practice below.

1. **Simplicity over completeness.** One straight recon pipeline, not a tool zoo. Drop redundant
   scanners. Prefer the smallest design that satisfies the requirement.
2. **Lightweight by default.** Postgres-backed queue (pg-boss), no Redis/Celery/Ollama-required.
   Three services. All-Go recon binaries, no Ruby. **All three vacti services run in Docker**
   (`db` + `worker` + `app`); the `worker` image is self-contained — it bakes in the pinned recon
   toolset (subfinder/httpx/naabu/nuclei) + nuclei-templates + Chromium, so nothing vacti-specific is
   installed on the host. The only host-side, non-vacti piece is the optional `cloudflared` proxy
   (just forwards to the app's published port). Bare-metal supervisors (`scripts/run-*.sh`) are a
   fallback for hosts without Docker. See [deploy.md](../../docs/how-to/deploy.md).
3. **Type-safety end to end.** Drizzle → Zod → tRPC → UI. The compiler catches drift before runtime.
4. **Reliability is a feature.** Jobs survive restarts; scans are cancellable and complete
   idempotently. Risk score is identical across every surface (±0).
5. **Security first.** Secrets only in `.env.example`; keys encrypted at rest; RBAC enforced
   server-side; no secret in logs or commits.
6. **Documentation first (Diátaxis).** Tutorials, how-to, reference, explanation — kept current.
7. **Explicit over implicit.** Conventional Commits, declared dependencies, quality gates in CI.

8. **API-first.** Every operation is exposed via a typed REST API (Bearer-token auth) from the
   start, so the platform is scriptable, testable, and integrable. A new resource ships with its
   endpoint in the same change. See [API & deploy](../../docs/planning/03-API-AND-DEPLOY.md).

9. **Active scanners are frozen; passive OSINT is HTTP-only.** The active scanning toolset is fixed
   at **subfinder / httpx / naabu / nuclei (+ nuclei wordfence)** — no new active-scanning binaries.
   **Passive OSINT sources** are a separate, permitted category but must be **HTTP-API clients only**
   (no new heavy runtime/binary): currently **VirusTotal** and **Wayback Machine** (URLScan optional),
   for passive subdomain/URL/IP discovery and exposure analysis. Constraints:
   - Passive discovery (Wayback CDX, VT undetected-URLs) is allowed; **active crawlers**
     (gospider/hakrawler/katana) remain out.
   - **Deep-fetch** of discovered content is opt-in and **MUST** pass the SSRF guard (block
     localhost/`.local`/cloud-metadata/private+reserved IPs), be size-capped, and may route via proxy.
   - API-key **rotation, quota, and backoff live in Postgres** (e.g. `next_available_at` + usage
     counters) — **never** introduce Redis/BullMQ for them (principle 2 still holds).
   - **Exposure findings** (regex-detected secrets/credentials) are confidential PII (principle 5):
     stored for triage, masked in the UI, CONFIDENTIAL in reports, never logged.
     See [Passive Recon & Exposure](../../docs/planning/11-PASSIVE-RECON-AND-EXPOSURE.md).

10. **CRUD completeness; destructive actions are guarded.** A resource is not "done" until it has
    full lifecycle management — **create, read, update, delete** — in both the UI and the typed API
    (no create-only resources). Destructive actions MUST:
    - enforce **RBAC server-side** (`requirePermission`) — never trust the client;
    - require **explicit confirmation** in the UI (`ConfirmButton`/dialog);
    - be **audited** (`recordAudit`);
    - **cascade** correctly via FK `onDelete` (deleting a project removes its targets/scans/findings/TI/passive data);
    - protect invariants (e.g. never delete the last SysAdmin or let an admin delete themselves into lockout).
      See the management-CRUD checklist (§10) in [02-FEATURE-PARITY-CHECKLIST](../../docs/planning/02-FEATURE-PARITY-CHECKLIST.md).

11. **Reliable, light & fast — non-negotiable.** The platform must stay responsive and dependable in
    production, not just correct. This is a hard requirement, equal to security and correctness:
    - **Serve a production build.** The live web app runs `next start` (compiled, minified) under a
      supervisor — **never `next dev`** in production (dev recompiles per request + ships unminified
      JS). Worker + app both **self-heal** (auto-restart with backoff). See
      [deploy.md](../../docs/how-to/deploy.md).
    - **Navigation feels instant.** Authenticated pages share persistent shell layouts (app +
      settings, e.g. `app/(app)/layout.tsx`) with `loading.tsx` boundaries, so clicking a menu swaps
      only the content (with an immediate skeleton) instead of re-rendering the whole shell. Use
      `next/link` (client nav + prefetch), never `<a>` for in-app links.
    - **Do the minimum work per request.** Index hot FK/filter columns; push
      filtering/pagination/aggregation into SQL (don't load-then-slice large sets — e.g. dashboard
      trend, schedules/audit joins, Projects/Targets lists); fan out independent queries with
      `Promise.all`; memoise per-request reads multiple components need (e.g. `getCurrentUser` via
      React `cache()`); cap and parallelise external fetches; never block on the network without
      parallelism + a timeout + a visible pending state.
    - **No silent slowness.** Heavy/remote work MUST surface a pending state (`SubmitButton`,
      `loading.tsx`, Suspense) — a frozen UI reads as broken. Performance/reliability regressions are
      treated as bugs, not polish.
