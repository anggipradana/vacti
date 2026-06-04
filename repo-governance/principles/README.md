# Layer 1 — Principles

Values that govern every convention and practice below.

1. **Simplicity over completeness.** One straight recon pipeline, not a tool zoo. Drop redundant
   scanners. Prefer the smallest design that satisfies the requirement.
2. **Lightweight by default.** Postgres-backed queue (pg-boss), no Redis/Celery/Ollama-required.
   Three services. All-Go recon binaries, no Ruby.
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
