---
name: threat-intel
status: backlog
created: 2026-06-03T19:09:19Z
updated: 2026-06-03T19:09:19Z
progress: 0%
prd: .claude/prds/vacti.md
github: (will be set on sync)
---

# Epic: threat-intel

## Overview

Pembeda utama vacti — modul Threat Intelligence ReNgGinaNg **dipertahankan penuh**: integrasi OTX
AlienVault & LeakCheck, manual indicators, dan **Unified Risk Score** yang konsisten di dashboard,
halaman TI, dan report. Refresh dijalankan sebagai job pg-boss dengan progress. Skor risiko memakai
formula reNgine yang sama (5-komponen dengan VA / 4-komponen tanpa VA).

Menutup baris Feature Parity Checklist: **2.1–2.8.**

## Architecture Decisions

- **Risk score = satu modul murni** (`@vacti/threat-intel/risk`) — fungsi pure, dipakai bersama oleh
  dashboard, TI page, dan report → menjamin nilai identik (±0).
- **Client API eksternal** dengan kunci dari **vault terenkripsi** (platform-foundation); hasil di-cache
  (TTL) untuk hemat kuota & idempotensi refresh.
- **Kredensial bocor** ditandai checked/unchecked via **hash MD5** (tanpa menyimpan plaintext ulang) —
  review menurunkan skor (insentif triase), sesuai reNgine.
- **Refresh per-domain** sinkron di dalam job pg-boss + progress (`ThreatIntelScanStatus`) via SSE/polling.

## Technical Approach

### Backend Services
- `@vacti/db` (extend): `otx_threat_data`, `leakcheck_data`, `threat_intel_scan_status`,
  `manual_indicators`, `threat_intel_report_setting` (branding — dipakai epic reports).
- `@vacti/threat-intel` (lib): OTX client (pulses/reputation/malware/passive-DNS/url), LeakCheck
  client (tipe `domain` & `origin`/stealer-log), risk-score engine (pure), refresh orchestrator (job),
  manual-indicator service + lookup OTX.
- tRPC + Hono routes: refresh (start/status), data TI per project/domain, manual indicator CRUD,
  toggle checked/unchecked kredensial, ambil risk score.

### Frontend Components
- Diserahkan ke epic **dashboard-ui** (TI page, kartu risk score, IoC/CVE/leak analytics). Epic ini
  menyuplai data + API + skor.

### Infrastructure
- Tidak ada layanan baru; job di worker pg-boss. Caching di Postgres (kolom + timestamp) atau memori.

## Implementation Strategy

1. Data models TI.
2. Risk-score engine (pure) + test vektor lengkap (paritas dgn reNgine) — paling dulu, independen.
3. OTX client + cache ‖ LeakCheck client + checked-state (paralel).
4. Manual indicators + lookup.
5. Refresh orchestrator (pg-boss) + progress + API/SSE.
6. Tests: unit risk-score & client (mock HTTP), integration refresh, konsistensi skor lintas-permukaan.

## Task Breakdown Preview

- [ ] 001 Threat-intel data models (OTX/LeakCheck/status/indicators/report-setting)
- [ ] 002 Unified Risk Score engine (pure, 5/4-komponen) + test vektor paritas
- [ ] 003 OTX AlienVault client (pulses/reputation/malware/passive-DNS/url) + cache
- [ ] 004 LeakCheck client (domain & origin) + checked/unchecked (MD5) state
- [ ] 005 Manual indicators + OTX lookup
- [ ] 006 Refresh orchestrator (pg-boss) + progress + TI API/SSE + tests

## Dependencies

- **platform-foundation** (DB, vault kunci, pg-boss, RBAC). 
- **recon-engine** (opsional, untuk komponen VA pada risk score; degrade anggun bila VA belum ada).
- Menyuplai skor & data ke **reports** dan **dashboard-ui**.

## Success Criteria (Technical)

- Risk score **identik (±0)** antara dashboard, TI page, dan PDF untuk data set sama.
- Refresh OTX+LeakCheck satu project selesai dgn progress akurat; hasil ter-cache (hit > 80% ulang).
- Fitur degrade anggun bila kunci OTX/LeakCheck tidak diisi (tanpa crash).
- Toggle checked menurunkan skor sesuai formula (teruji).

## Estimated Effort
- Timeline: ~2 minggu (1 dev).
- Jalur kritis: 001 → 002 → {003,004} → 005 → 006.

## Tasks Created
- [ ] 001.md - Threat-intel data models (parallel: true)
- [ ] 002.md - Unified Risk Score engine (parallel: true)
- [ ] 003.md - OTX AlienVault client + cache (parallel: true)
- [ ] 004.md - LeakCheck client + checked-state (parallel: true)
- [ ] 005.md - Manual indicators + OTX lookup (parallel: false)
- [ ] 006.md - Refresh orchestrator + TI API/SSE + tests (parallel: false)

Total tasks: 6
Estimated total effort: ~43 jam
Dependency order: {001,002} → {003,004} → 005 → 006
