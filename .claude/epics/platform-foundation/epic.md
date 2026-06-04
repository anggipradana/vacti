---
name: platform-foundation
status: in-progress
created: 2026-06-03T19:09:19Z
progress: 55%
prd: .claude/prds/vacti.md
github: (will be set on sync)
---

# Epic: platform-foundation

## Overview

Fase 0 — fondasi yang menopang semua epic lain. Membangun monorepo Nx berisi app Next.js + proses
worker, koneksi PostgreSQL via Drizzle, antrian pg-boss (tanpa Redis), autentikasi session + API
token, RBAC 3-peran, manajemen Project/workspace, vault API-key terenkripsi, serta seluruh
"governance & conventions" + CI/Husky/commitlint/secret-guards. Tujuan: setiap epic berikutnya
(recon-engine, threat-intel, reports, api-and-integrations, dashboard-ui) tinggal menempel di atas
fondasi yang sudah type-safe, teruji, dan ber-CI hijau.

Menutup baris Feature Parity Checklist: **4.1, 5.6 (sebagian), 6.3, 6.4, 8.1–8.10.**

## Architecture Decisions

- **Monorepo Nx** — apps: `web` (Next.js 15, App Router, React 19), `worker` (Node + pg-boss).
  Libs bersama: `@vacti/db` (Drizzle schema + client), `@vacti/auth` (session/token/RBAC),
  `@vacti/core` (tipe domain + Zod schema), `@vacti/config` (env loader tervalidasi),
  `@vacti/queue` (wrapper pg-boss), `@vacti/ui` (shadcn primitives) — dipakai lintas epic.
- **DB-first type-safety** — Drizzle sebagai sumber kebenaran skema → tipe mengalir DB→Zod→tRPC→UI.
  Migrasi via drizzle-kit (`generate` + `migrate`), dijalankan saat boot worker/entrypoint.
- **Queue di Postgres (pg-boss)** — satu dependensi data store; tabel pg-boss di schema terpisah
  (`pgboss`). Tidak ada Redis. Pemilihan ini final (lihat 00-DECISION.md).
- **Auth** — session berbasis cookie (httpOnly, SameSite=Lax) + tabel API token (hashed, scoped).
  Library tipis (lucia-style/custom) di `@vacti/auth`, bukan framework berat. Password hash argon2id.
- **RBAC server-side** — peran SysAdmin / PenetrationTester / Auditor + matriks permission
  (modify_system_config, modify_scan_config, modify_scan_results, modify_report, initiate_scans,
  modify_targets). Ditegakkan di middleware tRPC/Hono, bukan hanya di UI. Mengacu `roles.py` reNgine.
- **Secrets/vault** — API key (OTX/LeakCheck/AI) disimpan terenkripsi AES-256-GCM dengan kunci dari
  env (`ENCRYPTION_KEY`); plaintext tidak pernah ke log/response. Hanya `.env.example` di-commit.
- **Governance = ose-primer** — hierarki 6-lapis di `repo-governance/`, Conventional Commits +
  commitlint, Husky 3-stage (pre-commit/commit-msg/pre-push), Diátaxis docs, trunk-based.
- **CI = GitHub Actions** dynamic-detection + reusable workflows; gate `nx affected` typecheck/lint/
  unit/integration/e2e dengan Postgres service container. Prettier printWidth 120.

## Technical Approach

### Frontend Components (web)

- App shell Next.js (App Router): layout root, tema dark/light (next-themes), provider tRPC + React
  Query, error boundary, toaster.
- Halaman auth: login, logout, (opsional) first-run create-admin. Guarded layout (redirect bila
  tak login). Selector/route Project: `/[projectSlug]/...` sebagai scoping multi-project.
- Halaman Settings dasar: profil user, manajemen API token (buat/cabut), daftar user + assign role
  (khusus SysAdmin), API Key Vault (input terenkripsi, tampil masked).
- `@vacti/ui`: inisialisasi shadcn/ui (button, input, dialog, table, dropdown, toast, form, card)
  - token desain (warna severity/risk, radius, typografi) supaya epic UI tinggal pakai.

### Backend Services

- `@vacti/db`: skema Drizzle fondasi — `users`, `sessions`, `api_tokens`, `roles`/`permissions`
  (atau enum + matriks statis), `projects`, `project_members`, `api_keys` (vault terenkripsi),
  `audit_log`. Migrasi awal + seed (admin pertama, profil scan default placeholder).
- `@vacti/auth`: createSession/validateSession, hashPassword/verify (argon2id), createApiToken
  (return sekali, simpan hash), middleware `requirePermission(perm)` + `requireProjectAccess`.
- `@vacti/queue`: bootstrap pg-boss (start, schema `pgboss`), helper `enqueue`/`work` ber-tipe Zod,
  graceful shutdown. Worker entrypoint yang jalankan migrasi lalu mulai pg-boss (job handler nyata
  diisi epic recon-engine).
- tRPC router root + context (user, project, permission) di web; Hono app skeleton (`/api`) untuk
  REST publik (endpoint nyata diisi epic api-and-integrations) — cukup health + auth probe di sini.
- `@vacti/config`: loader env tervalidasi Zod (DATABASE_URL, ENCRYPTION_KEY, SESSION_SECRET,
  PORT, NODE_ENV, opsional keys) — fail-fast saat boot.

### Infrastructure

- **Dockerfile** multi-stage: base (node) → builder (nx build web+worker) → runtime. Image worker
  membawa 4 binary Go (subfinder/httpx/naabu/nuclei) + nuclei-templates + Chromium (Playwright)
  — disiapkan di sini, dipakai recon-engine/reports.
- **docker-compose.yml**: `app`, `worker`, `db (postgres)` saja. Healthcheck + depends_on.
- **.env.example** lengkap (satu-satunya env yang di-commit). Script `check-no-env-staged.sh`.
- **Governance docs** `repo-governance/` (6 lapis: vision, principles, conventions, development,
  agents, workflows) + `docs/` Diátaxis (tutorials/how-to/reference/explanation) skeleton.
- **Husky** `.husky/`: pre-commit (git-identity-check.sh, check-no-env-staged.sh, lint-staged),
  commit-msg (commitlint config-conventional), pre-push (`nx affected -t typecheck lint test:quick`).
- **CI** `.github/workflows/`: `ci.yml` (PR gate: install → nx affected typecheck/lint/test +
  integration + e2e dengan service `postgres`), reusable `setup` action; CodeQL JS opsional.
- **Makefile / scripts**: `dev`, `build`, `migrate`, `seed`, `test`, `e2e`, `up`, `down`.

## Implementation Strategy

Urut karena saling bertumpu, tapi governance/CI bisa paralel dengan kode:

1. Scaffold monorepo + tooling (Nx, TS, ESLint/Prettier, Vitest, Playwright) → bisa paralel dgn (2).
2. Governance docs + Husky + commitlint + CI + .env guards (paralel dgn 1, butuh repo init).
3. DB schema + Drizzle + migrasi + `@vacti/config` (butuh 1).
4. Auth + RBAC + API token (butuh 3).
5. pg-boss + worker bootstrap (butuh 3).
6. App shell + Project scoping + Settings/Vault UI + tRPC/Hono skeleton (butuh 3,4).
7. Dockerfile + compose + tool/Chromium bundling (butuh 1,3,5).
8. E2E smoke (login→buat project→buat API token) mengikat semuanya (butuh 6).

Testing: setiap lib punya unit test; auth/RBAC/queue/db punya integration test (Postgres service);
satu e2e smoke wajib hijau sebagai bukti fondasi hidup.

## Task Breakdown Preview

- [ ] **001 Monorepo scaffold & toolchain** — Nx workspace, web+worker apps, libs kosong, TS/ESLint/
      Prettier(120)/Vitest/Playwright, npm scripts. (parallel dgn 002)
- [ ] **002 Governance, Husky, commitlint & CI** — repo-governance 6-lapis + Diátaxis skeleton,
      Husky 3-stage + guard scripts, commitlint, GitHub Actions gate, .env.example. (parallel dgn 001)
- [ ] **003 DB schema, Drizzle & config** — skema fondasi + migrasi awal + seed + env loader Zod.
- [ ] **004 Auth, sessions & API tokens** — argon2id, cookie session, token hashed+scoped, login UI.
- [ ] **005 RBAC & permission middleware** — peran + matriks permission, guard tRPC/Hono, tests.
- [ ] **006 pg-boss queue & worker bootstrap** — wrapper queue ber-tipe, worker entrypoint+migrate.
- [ ] **007 App shell, Project scoping & Settings/Vault UI** — layout/tema, `/[projectSlug]`,
      settings user/token/role + API Key Vault terenkripsi, tRPC root + Hono skeleton.
- [ ] **008 Dockerfile, compose & runtime image** — multi-stage, bundling 4 Go tools + Chromium,
      3-service compose, Makefile.
- [ ] **009 E2E smoke & coverage gate** — Playwright smoke (login→project→token), wiring CI green.

(Target ≤10 task. Detail + dependency final di file 001.md…009.md saat decompose.)

## Tasks Created

- [x] 001.md - Monorepo scaffold & toolchain (parallel: true)
- [x] 002.md - Governance, Husky, commitlint & CI (parallel: true)
- [x] 003.md - DB schema, Drizzle & config (parallel: true)
- [ ] 004.md - Auth, sessions & API tokens (parallel: true)
- [ ] 005.md - RBAC & permission middleware (parallel: false)
- [x] 006.md - pg-boss queue & worker bootstrap (parallel: true)
- [ ] 007.md - App shell, Project scoping & Settings/Vault UI (parallel: false)
- [x] 008.md - Dockerfile, compose & runtime image (parallel: true)
- [x] 009.md - E2E smoke & coverage gate (parallel: false)
- [ ] 010.md - Audit log writes & viewer (parallel: true) — gap G10
- [ ] 011.md - Seed & fixtures (default scan profiles + keywords) (parallel: true) — gap G16

Total tasks: 11
Parallel-capable: 001, 002, 003, 004, 006, 008, 010, 011 (subject to dependency gates)
Sequential (dep-gated): 005, 007, 009
Estimated total effort: ~88 jam (~1.5–2 minggu, 1 dev)
Dependency order: 001 → {002,003,006,008} ; 003 → {004,006} ; {003,004} → 005 ;
{003,004,005} → 007 ; {002,007} → 009

## Dependencies

- **Eksternal:** Node 20+, pnpm/npm, PostgreSQL 16, Docker; binari ProjectDiscovery + Chromium untuk
  image (dipakai epic lain).
- **Antar-epic:** SEMUA epic lain bergantung pada epic ini. Tidak bergantung pada epic mana pun.
- **Referensi:** ccpm (struktur), ose-primer (governance/CI/hooks).

## Success Criteria (Technical)

- `nx affected` typecheck+lint+unit+integration+e2e hijau di CI PR < ~10 menit.
- `docker compose up` menghidupkan app+worker+db; migrasi jalan otomatis; health endpoint 200.
- Login → buat Project → buat & cabut API token bekerja end-to-end (e2e smoke hijau).
- RBAC ditegakkan server-side: Auditor ditolak `initiate_scans`/`modify_*` (kecuali report) — teruji.
- API key di vault tersimpan terenkripsi; tidak ada secret di log/response/commit (guard aktif).
- Commit non-conventional ditolak commit-msg hook; staging `.env` ditolak pre-commit hook.
- Tipe end-to-end: perubahan kolom Drizzle memunculkan type-error di UI bila tak diselaraskan.

## Estimated Effort

- Timeline: ~1.5–2 minggu (1 dev) untuk fondasi solid + CI hijau.
- Resource: 1 dev fokus; task 001/002 bisa paralel di awal.
- Jalur kritis: 003 (DB) → 004/005 (auth/RBAC) → 007 (app shell) → 009 (e2e).
