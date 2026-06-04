---
name: reports
status: completed
created: 2026-06-03T19:09:19Z
updated: 2026-06-04T16:00:00Z
progress: 100%
prd: .claude/prds/vacti.md
github: (will be set on sync)
---

# Epic: reports

## Overview

Laporan PDF **didesain ulang** (lebih bagus/rapi/keren) untuk VA dan Threat Intel, dwibahasa EN/ID,
dengan branding per-project. Render dari template HTML/CSS modern via **Playwright** (engine yang juga
dipakai e2e), bukan WeasyPrint. Generasi dijalankan sebagai job pg-boss; hasil disimpan & dapat diunduh.

Menutup baris Feature Parity Checklist: **3.1–3.6** (dan konsumsi risk score 2.6 dari threat-intel).

## Architecture Decisions

- **HTML/CSS → PDF (Playwright/Chromium)** — desain paling leluasa, reuse Chromium dari e2e; alternatif
  **Typst** dicatat sebagai opsi bila ingin tanpa Chromium.
- **Paged design system** baru: cover, daftar isi, header/footer berjalan, page-number, severity/risk
  color tokens — diimplement dgn CSS `@page` + komponen template, bukan porting WeasyPrint.
- **i18n EN/ID** via kamus resource; semua label/section dwibahasa.
- **Branding per-project** (`threat_intel_report_setting`): logo, warna, nomor dokumen, klasifikasi,
  signatory — dari DB (threat-intel epic), dapat dipakai VA report juga.
- **Exec summary AI** opsional di-inject dari epic api-and-integrations (cache).

## Technical Approach

### Backend Services

- `@vacti/reports` (lib): template VA + TI (komponen + CSS paged), data assembler (tarik dari recon +
  threat-intel), i18n resolver, branding resolver, Playwright render service (job pg-boss), storage.
- tRPC + Hono routes: generate report (VA/TI), status, download; CRUD branding setting.
- Penyimpanan file PDF (volume/objek) + metadata (`reports` table: type, project, scan, lang, path,
  generated_at, doc_number).

### Frontend Components

- UI generate/download + form branding diserahkan ke **dashboard-ui**; epic ini sediakan service+API.
- Template di-preview-able sebagai route HTML (dev) untuk iterasi desain.

### Infrastructure

- Chromium sudah di image worker (platform-foundation 008). Render headless di worker.

## Implementation Strategy

1. Report data model + branding setting wiring + i18n resource.
2. Paged design system (CSS @page, tokens, komponen header/footer/cover) — fondasi visual.
3. VA report template + data assembler.
4. TI report template (cover, exec summary, IoC, CVE, breach monitoring, rekomendasi, signatory).
5. Playwright render service (job) + storage + download API.
6. Tests: snapshot HTML, smoke render PDF (file valid, halaman, dwibahasa), konsistensi risk score.

## Task Breakdown Preview

- [ ] 001 Report data model, branding wiring & i18n (EN/ID) resources
- [ ] 002 Paged design system (CSS @page, tokens, cover/header/footer komponen)
- [ ] 003 VA report template + data assembler (dari recon-engine)
- [ ] 004 TI report template (cover/exec-summary/IoC/CVE/breach/rekomendasi/signatory)
- [ ] 005 Playwright PDF render service (pg-boss job) + storage + download API
- [ ] 006 Tests (snapshot HTML + smoke PDF + dwibahasa + skor konsisten)

## Dependencies

- **platform-foundation** (Chromium image, pg-boss, RBAC: `modify_report`).
- **recon-engine** (data VA), **threat-intel** (data TI + risk score + branding setting).
- **api-and-integrations** (opsional: exec summary AI).

## Success Criteria (Technical)

- Generasi report < 10 dtk; PDF valid, dwibahasa, branding per-project tampil benar.
- Risk score di PDF identik dgn dashboard/TI page (±0).
- Desain lulus review visual (rapi, modern) + dapat dipreview sebagai HTML saat dev.

## Estimated Effort

- Timeline: ~2 minggu (1 dev).
- Jalur kritis: 001 → 002 → {003,004} → 005.

## Tasks Created

- [x] 001.md - Report data model, branding & i18n (parallel: true)
- [x] 002.md - Paged design system (parallel: true)
- [x] 003.md - VA report template + data assembler (parallel: false)
- [x] 004.md - TI report template (parallel: false)
- [x] 005.md - Playwright PDF render service + storage + API (parallel: false)
- [x] 006.md - Report tests (snapshot + smoke + consistency) (parallel: false)
- [x] 007.md - Report parity additions: logo, signatures, CVSS/CVE/refs, exec summary (parallel: false)

Total tasks: 7
Estimated total effort: ~46 jam
Dependency order: {001,002} → {003,004} → 005 → 006 → 007 (parity additions, 2026-06-04)
