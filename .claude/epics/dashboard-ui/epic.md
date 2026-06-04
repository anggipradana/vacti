---
name: dashboard-ui
status: completed
created: 2026-06-03T19:09:19Z
updated: 2026-06-05T02:30:00Z
progress: 100%
prd: .claude/prds/vacti.md
github: (will be set on sync)
---

# Epic: dashboard-ui

## Overview

Antarmuka modern, bersih, dan keren (shadcn/ui + Tailwind, dark mode, WCAG AA) di atas data semua epic:
dashboard ringkasan (counts, severity breakdown, tren 7 hari, kartu Threat Intel + risk score,
IoC/CVE/leak analytics), tabel data server-side, manajemen scan (start/stop + progress SSE + history +
diff), halaman Threat Intel, UI Reports (generate/branding/download), halaman integrasi & settings,
pencarian universal, dan recon notes. Charts via Recharts/Visx (bukan ApexCharts).

Menutup baris Feature Parity Checklist: **7.1–7.7, 6.6 (tabel), 4.6/4.7/4.9/4.11 (UI), 5.x (UI integrasi).**

## Architecture Decisions

- **shadcn/ui + Radix + Tailwind**; design tokens dari `@vacti/ui` (severity/risk colors, radius, type).
- **Server-side data tables** (filter/sort/paginate) reusable, dialiri tRPC; mendekati operator
  query reNgine tapi disederhanakan.
- **Charts**: Recharts (default) / Visx (kompleks). **Dark mode** first-class; **WCAG AA**.
- **Realtime** progress via SSE (subscribe dari komponen scan).
- **Konsistensi risk score** dengan modul pure threat-intel (tanpa hitung ulang di UI).

## Technical Approach

### Frontend Components

- Layout app + nav per-project (di atas app shell platform-foundation).
- Dashboard: kartu metrik, donut severity, area tren 7 hari, kartu TI + gauge risk score,
  analitik IoC/CVE/leak.
- DataTable generik + view: subdomains, endpoints, ports, technologies, vulnerabilities (detail vuln
  dgn request/response, CVE/CWE/CVSS).
- Scan management: trigger (pilih profil), progress live (SSE), history, **scan diff/compare**.
- Threat Intel page: OTX (pulses/reputation/malware/passive-DNS), leaks (checked toggle), manual
  indicators, risk score.
- Reports UI: generate VA/TI, form branding, daftar & download.
- Integrasi & Settings: webhook config, AI settings, API tokens, vault, users/roles; universal search;
  recon notes; onboarding ringkas.

### Backend Services

- Konsumsi tRPC/Hono + SSE dari epic lain; menambah query agregasi ringan bila perlu (`charts`).

### Infrastructure

- Tidak ada; murni app `web`.

## Implementation Strategy

1. Design system + charts setup + dark mode polish (di atas `@vacti/ui`).
2. DataTable generik server-side + view hasil recon.
3. Dashboard ringkasan + analitik.
4. Scan management UI + progress SSE + history + diff.
5. Threat Intel page + manual indicator UI.
6. Reports UI + Integrasi/Settings + universal search + recon notes + onboarding; e2e flows.

## Task Breakdown Preview

- [ ] 001 Design system, charts (Recharts/Visx) & dark mode polish
- [ ] 002 Reusable server-side DataTable + recon result views (subdomain/endpoint/port/vuln)
- [ ] 003 Main dashboard (counts, severity, tren 7-hari, kartu TI + risk score, IoC/CVE/leak analytics)
- [ ] 004 Scan management UI (trigger, progress SSE, history, scan diff/compare)
- [ ] 005 Threat Intel page + manual indicators + leak checked-toggle UI
- [ ] 006 Reports UI + Integrasi/Settings + universal search + recon notes + e2e

## Dependencies

- **platform-foundation** (app shell, RBAC `can()`, project scoping).
- **recon-engine**, **threat-intel**, **reports**, **api-and-integrations** (data + API + SSE).

## Success Criteria (Technical)

- Dashboard query < 300 ms p95 pada project tipikal; chart & tabel responsif.
- Dark mode + WCAG AA (kontras/keyboard/SR) lulus audit aksesibilitas dasar.
- Progress scan tampil real-time via SSE; diff antar-scan akurat.
- Risk score di UI identik dgn TI page & report (±0).
- Kontrol dibatasi RBAC (Auditor tak melihat aksi mutasi selain report).

## Estimated Effort

- Timeline: ~3 minggu (1 dev) — permukaan UI besar.
- Jalur kritis: 001 → 002 → 003 → 004 → {005,006}.

## Tasks Created

- [x] 001.md - Design system, charts & dark mode (parallel: true)
- [x] 002.md - Server-side DataTable + recon result views (parallel: false)
- [x] 003.md - Main dashboard + analytics (parallel: false)
- [x] 004.md - Scan management UI (SSE, history, diff) (parallel: false)
- [x] 005.md - Threat Intel page + indicators + leak toggle (parallel: false)
- [x] 006.md - Reports UI + Settings/Integrations + search + e2e (parallel: false)
- [x] 007.md - Onboarding (first-run walkthrough) (parallel: true) — gap G17

Total tasks: 7
Estimated total effort: ~64 jam
Dependency order: 001 → 002 → {003,004,005} → 006 → 007
