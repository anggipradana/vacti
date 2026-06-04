---
name: recon-engine
status: completed
created: 2026-06-03T19:09:19Z
updated: 2026-06-05T02:30:00Z
progress: 100%
prd: .claude/prds/vacti.md
github: (will be set on sync)
---

# Epic: recon-engine

## Overview

Mesin recon/VA inti vacti: pipeline tunggal lurus **subfinder (opsional) → httpx → naabu → nuclei
(+ nuclei wordfence kondisional untuk WordPress)** dijalankan sebagai job pg-boss oleh worker, dengan
penangkapan perintah/output, progress real-time (SSE), cancellation, idempotent completion (anti
scan "stuck"), retry, dan penjadwalan ringan (cron). Termasuk manajemen target, profil scan ringkas,
penyimpanan & dedup hasil, serta perbandingan antar-scan. Mengganti orkestrasi Celery chain/group
reNgine yang berat dengan antrian Postgres-backed + 1 worker.

Menutup baris Feature Parity Checklist: **1.1, 1.3, 1.4, 1.6, 1.7, 1.8, 1.15–1.20, 4.2–4.9, 4.12.**

## Architecture Decisions

- **Pipeline linear deterministik** (bukan chain/group paralel berat). Tiap tahap = step job; state
  scan disimpan di DB; tahap WordPress (nuclei wordfence) dipicu **kondisional** dari sinyal httpx.
- **Tool runner** generik: spawn child-process, stream stdout (JSONL bila tersedia), tangkap ke
  `Command` (audit), timeout per-tool, `AbortController` + kill process-group untuk cancellation.
- **subfinder skippable**: bila target punya predefined subdomains, tahap subfinder dilewati.
- **Idempotent completion**: penyelesaian scan idempoten + reconciler berkala → tidak ada scan zombie.
- **Hasil sebagai sumber kebenaran ber-tipe** (Drizzle), dengan dedup deterministik & diff antar-scan.
- **WordPress detection** berlapis: tech fingerprint httpx → pola URL (`wp-content`/`wp-login.php`)
  → tanda manual user. Hanya host bertanda yang dipindai wordfence (hemat & terfokus).

## Technical Approach

### Backend Services

- `@vacti/db` (extend): `targets`, `scans` (ScanHistory: status, profile, timing, counts),
  `scan_activity` (timeline), `commands` (audit perintah+output), `subdomains`, `endpoints`,
  `ip_addresses`, `ports`, `technologies`, `vulnerabilities` (severity -1..4, CVE/CWE/CVSS,
  request/response), `subscans`, `recon_notes`, `interesting_keywords`.
- `@vacti/recon` (lib baru): tool runner, adapter per-tool (subfinder/httpx/naabu/nuclei/wordfence),
  parser JSON→model, scan profile resolver, pipeline orchestrator (handler pg-boss), progress emitter.
- tRPC + Hono routes: start/stop/status scan, subscan/rescan, CRUD target/profile, diff antar-scan,
  recon notes. SSE channel progress.

### Frontend Components

- Diserahkan ke epic **dashboard-ui** (scan management UI, results, diff). Epic ini menyediakan
  data + API + SSE; UI minimal (form trigger) boleh untuk e2e.

### Infrastructure

- Binari + nuclei-templates sudah ada di image worker (epic platform-foundation task 008).
- Cron ringan via pg-boss schedule untuk scheduled scans.

## Implementation Strategy

1. Data models recon (extend `@vacti/db`).
2. Tool runner framework (exec/capture/cancel/timeout) — independen, sangat teruji.
3. Adapters subfinder+httpx (+ WordPress detect) ‖ adapters naabu+nuclei(+wordfence) — paralel.
4. Parser + persistence + dedup + diff.
5. Pipeline orchestrator di pg-boss (progress/idempotent/retry/scheduled).
6. Scan control API + SSE.
7. Target/profile mgmt + interesting keywords + recon notes.
8. Tests: unit parser/profile, integration (mock tool output), e2e (scan dummy target lokal).

## Task Breakdown Preview

- [ ] 001 Recon data models (Drizzle: scans/subdomains/endpoints/ports/vulns/activity/commands)
- [ ] 002 Tool runner framework (exec, stream, capture, timeout, cancel via AbortController+kill)
- [ ] 003 Adapters: subfinder + httpx + WordPress detection
- [ ] 004 Adapters: naabu + nuclei + conditional wordfence templates
- [ ] 005 Output parsers, persistence, dedup & scan diff
- [ ] 006 Pipeline orchestrator on pg-boss (progress, idempotent completion, retry)
- [ ] 007 Scan control API + SSE progress (start/stop/status, subscan/rescan)
- [ ] 008 Target & scan-profile management + interesting keywords + recon notes
- [ ] 009 Scheduled scans (cron) + tests (unit/integration/e2e)

## Dependencies

- **platform-foundation** (DB, pg-boss/worker, auth/RBAC, image dgn binari). Wajib selesai dahulu
  (≥ task 003/006/008).
- Tidak bergantung pada epic lain; menyuplai data ke threat-intel (VA→risk), reports, dashboard-ui.

## Success Criteria (Technical)

- Full scan satu domain (profil default) selesai & tersimpan reliabel; **0 scan stuck** dari 50 run.
- Cancellation menghentikan child-process < 5 dtk; state scan konsisten setelah cancel.
- WordPress scan hanya jalan untuk host bertanda WordPress (terbukti via test).
- Diff antar-scan menampilkan delta subdomain/endpoint/vuln yang benar.
- Setiap perintah tool terekam (audit) dengan exit code & durasi.

## Estimated Effort

- Timeline: ~2.5–3 minggu (1 dev).
- Jalur kritis: 001 → 002 → {003,004} → 005 → 006 → 007.

## Tasks Created

- [x] 001.md - Recon data models (parallel: true)
- [x] 002.md - Tool runner framework (parallel: true)
- [x] 003.md - Adapters subfinder + httpx + WordPress detection (parallel: true)
- [x] 004.md - Adapters naabu + nuclei + conditional wordfence (parallel: true)
- [ ] 005.md - Parsers, persistence, dedup & scan diff (parallel: false)
- [x] 006.md - Pipeline orchestrator on pg-boss (parallel: false)
- [x] 007.md - Scan control API + SSE progress (parallel: false)
- [ ] 008.md - Target & scan-profile management + keywords + notes (parallel: true)
- [ ] 009.md - Scheduled scans (cron) + tests (parallel: false)

Total tasks: 9
Estimated total effort: ~78 jam
Dependency order: {001,002,008} → {003,004} → 005 → 006 → 007 → 009

## Finding status (added 2026-06-04)

Vulnerabilities carry a triage `status` — `open` · `in_progress` · `resolved` · `risk_accepted` ·
`false_positive` · `no_impact` · `waf_handled` · `duplicate` · `out_of_scope` · `reopened`. Only active
statuses (`open`/`in_progress`/`reopened`; `waf_handled` half-weight) feed the unified risk score.
Adds `vulnerabilities.status` (+ note/changed-at/by), a status-change API (RBAC `modify_scan_results`),
and a status pill + filter in the vulnerabilities table. Spec: docs/planning/05-FINDING-STATUS.md.
