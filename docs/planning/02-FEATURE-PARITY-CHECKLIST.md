# vacti — Feature Parity Checklist (dari analisis ReNgGinaNg)

> Sumber: pembacaan menyeluruh ReNgGinaNg (416 file, ~22.7K baris). Setiap fitur **esensial**
> dipetakan ke epic vacti + status keputusan (IKUT / SEDERHANAKAN / BUANG). Checklist ini adalah
> "kontrak cakupan" — tiap item IKUT/SEDERHANAKAN wajib punya task di epic terkait sebelum dianggap selesai.
>
> Legenda status: ✅ ikut penuh · 🟡 ikut tapi disederhanakan · ➕ baru/diperbaiki di vacti · ❌ dibuang.
> Kolom Epic: PF=platform-foundation · RE=recon-engine · TI=threat-intel · RP=reports · AI=api-and-integrations · UI=dashboard-ui.

---

## 1. Recon / Vulnerability Assessment

| #    | Fitur ReNgGinaNg                                                        | Status | Epic | Catatan                                                                                |
| ---- | ----------------------------------------------------------------------- | ------ | ---- | -------------------------------------------------------------------------------------- |
| 1.1  | Subdomain enum (subfinder)                                              | ✅     | RE   | Skippable bila predefined subs ada                                                     |
| 1.2  | Subdomain enum (amass, sublist3r, oneforall, ctfr, tlsx, netlas, chaos) | ❌     | —    | Berlebih → cukup subfinder                                                             |
| 1.3  | HTTP probe + tech detect (httpx)                                        | ✅     | RE   | Alive, status, title, tech, webserver, CDN/CNAME                                       |
| 1.4  | Port scan (naabu)                                                       | ✅     | RE   | exclude-cdn                                                                            |
| 1.5  | Port scan + NSE (nmap vulscan)                                          | ❌     | —    | Berat, dibuang                                                                         |
| 1.6  | Vuln scan (nuclei, per-severity, templates)                             | ✅     | RE   | Sumber temuan utama                                                                    |
| 1.7  | WordPress scan                                                          | 🟡➕   | RE   | **nuclei + template wordfence** (BUKAN wpscan Ruby), kondisional bila host = WordPress |
| 1.8  | Penanda WordPress (tech fingerprint + pola URL + tanda manual)          | ➕     | RE   | Pemicu langkah 1.7                                                                     |
| 1.9  | URL fetch/crawler (gospider, gau, waybackurls, hakrawler, katana) + GF  | ❌     | —    | Dibuang                                                                                |
| 1.10 | Dir/file fuzzing (ffuf)                                                 | ❌     | —    | Dibuang                                                                                |
| 1.11 | Scanner ekstra (dalfox, crlfuzz, s3scanner)                             | ❌     | —    | Dibuang                                                                                |
| 1.12 | Screenshot (EyeWitness/Selenium)                                        | ❌     | —    | Beban berat, dibuang                                                                   |
| 1.13 | WAF detect (wafw00f) / CMS (CMSeeK)                                     | ❌     | —    | Dibuang                                                                                |
| 1.14 | OSINT (theHarvester, GooFuzz, h8mail, metafinder)                       | ❌     | —    | Dibuang                                                                                |
| 1.15 | Pipeline orchestration (chain/group, paralel tahap)                     | 🟡     | RE   | pg-boss linear 5-tahap, bukan Celery chain/group berat                                 |
| 1.16 | Scan cancellation (revoke celery_ids)                                   | ✅➕   | RE   | AbortController + kill child-process                                                   |
| 1.17 | Idempotent completion (anti scan "stuck")                               | ✅     | RE   | Hardening reNgine ditiru → visibility timeout + idempoten                              |
| 1.18 | Per-tool command + output capture (Command model)                       | ✅     | RE   | Audit tiap perintah                                                                    |
| 1.19 | Scan activity timeline (ScanActivity)                                   | ✅     | RE   | Progress granular                                                                      |
| 1.20 | Sub-scan (rescan sebagian)                                              | 🟡     | RE   | Versi ringkas                                                                          |

## 2. Threat Intelligence (DIPERTAHANKAN PENUH)

| #   | Fitur ReNgGinaNg                                                       | Status | Epic     | Catatan                                                                            |
| --- | ---------------------------------------------------------------------- | ------ | -------- | ---------------------------------------------------------------------------------- |
| 2.1 | OTX AlienVault (pulses, reputation, malware, passive DNS, URL list)    | ✅     | TI       | Per domain + indikator                                                             |
| 2.2 | LeakCheck (tipe `domain` & `origin`/stealer-log)                       | ✅     | TI       | Kredensial bocor                                                                   |
| 2.3 | Status kredensial checked/unchecked (hash MD5, tanpa simpan plaintext) | ✅     | TI       | Insentif triase                                                                    |
| 2.4 | Manual Indicators (domain/subdomain/IP) + lookup OTX                   | ✅     | TI       |                                                                                    |
| 2.5 | Unified Risk Score (`calculate_risk_score`)                            | ✅     | TI       | 5-komponen (VA40/Leak30/Exposure12/Reputation10/Malware8) atau 4-komponen tanpa VA |
| 2.6 | Konsistensi skor dashboard = TI page = report                          | ✅     | TI/UI/RP | Success criteria terukur (±0)                                                      |
| 2.7 | Refresh flow + progress (ThreatIntelScanStatus)                        | 🟡     | TI       | Polling/SSE, refresh per-domain                                                    |
| 2.8 | Warna risiko (hijau/kuning/merah)                                      | ✅     | TI/UI    | 0–30 / 31–70 / 71–100                                                              |

## 3. Reports (DIDESAIN ULANG)

| #   | Fitur ReNgGinaNg                                                             | Status | Epic | Catatan                                                            |
| --- | ---------------------------------------------------------------------------- | ------ | ---- | ------------------------------------------------------------------ |
| 3.1 | VA Report PDF                                                                | ✅➕   | RP   | Desain baru, ringkasan vuln + severity + temuan                    |
| 3.2 | Threat Intel Report PDF (cover, exec summary, IoC, CVE, breach, rekomendasi) | ✅➕   | RP   | Desain baru                                                        |
| 3.3 | Dwibahasa EN/ID                                                              | ✅     | RP   |                                                                    |
| 3.4 | Branding per-project (logo, warna, no dok, klasifikasi, signatory)           | ✅     | RP   | `ThreatIntelReportSetting` → setting vacti                         |
| 3.5 | Engine render                                                                | ➕     | RP   | **Playwright HTML/CSS → PDF** (alternatif Typst), bukan WeasyPrint |
| 3.6 | Lembar pengesahan/signatory                                                  | ✅     | RP   |                                                                    |

## 4. Manajemen Project & Target

| #    | Fitur ReNgGinaNg                                            | Status | Epic  | Catatan                                                            |
| ---- | ----------------------------------------------------------- | ------ | ----- | ------------------------------------------------------------------ |
| 4.1  | Project / workspace (multi-project, scoping `/<slug>/`)     | ✅     | PF    | Multi-project, single-tenant org v1                                |
| 4.2  | Target domain/organisasi                                    | ✅     | RE    |                                                                    |
| 4.3  | Predefined subdomains                                       | ✅     | RE    | Memungkinkan skip subfinder                                        |
| 4.4  | Custom request headers                                      | ✅     | RE    |                                                                    |
| 4.5  | Scan Engine/Config (YAML reNgine, lusinan opsi)             | 🟡     | RE    | Profil ringkas: tool aktif, ports, severity, rate/threads, timeout |
| 4.6  | Scan History (status, hasil per-scan)                       | ✅     | RE/UI |                                                                    |
| 4.7  | Perbandingan antar-scan (diff)                              | 🟡     | RE/UI | Versi ringkas                                                      |
| 4.8  | Scheduled Scans (Celery Beat)                               | 🟡     | RE    | Cron ringan via pg-boss, bukan celery-beat                         |
| 4.9  | Recon Notes / Todo per target                               | 🟡     | UI    | Opsional ringan                                                    |
| 4.10 | WHOIS / domain-info kompleks (Netlas/ViewDNS/historical IP) | ❌     | —     | Opsional kecil bila perlu nanti                                    |
| 4.11 | Universal search                                            | 🟡     | UI    |                                                                    |
| 4.12 | Interesting keywords/lookup (admin, ftp, cpanel)            | 🟡     | RE    | Versi ringkas                                                      |

## 5. Integrasi (WAJIB)

| #   | Fitur ReNgGinaNg                                                    | Status | Epic  | Catatan                                                           |
| --- | ------------------------------------------------------------------- | ------ | ----- | ----------------------------------------------------------------- |
| 5.1 | Notifications webhook (Discord, Slack, Telegram, Google Chat, Lark) | ✅     | AI    | Pemicu per-event configurable                                     |
| 5.2 | AI enrichment vuln (description/impact/remediation)                 | ✅     | AI    | Hasil di-cache                                                    |
| 5.3 | AI executive summary report                                         | ✅     | AI    |                                                                   |
| 5.4 | AI threat analysis/ringkasan                                        | ✅     | AI    |                                                                   |
| 5.5 | Provider AI                                                         | ➕     | AI    | **Vercel AI SDK**: Claude default + OpenAI + Ollama (abstraction) |
| 5.6 | API Key Vault (OTX, LeakCheck, AI) terenkripsi                      | ✅     | AI/PF | Enkripsi at-rest                                                  |
| 5.7 | HackerOne / Bug bounty sync-import-submit                           | ❌     | —     | Dibuang                                                           |

## 6. API (WAJIB — warga kelas satu)

| #   | Fitur ReNgGinaNg                                                                              | Status | Epic  | Catatan                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------- | ------ | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| 6.1 | REST API semua resource (project/target/scan/subdomain/endpoint/port/vuln/TI/report/settings) | ✅➕   | AI    | typed                                                                                                                    |
| 6.2 | OpenAPI terdokumentasi                                                                        | ✅➕   | AI    | Auto-generated                                                                                                           |
| 6.3 | Auth session + API token                                                                      | ✅     | PF/AI | Token utk otomasi/CI eksternal                                                                                           |
| 6.4 | RBAC (SysAdmin / PenetrationTester / Auditor)                                                 | ✅     | PF    | Permission: modify_system_config, modify_scan_config, modify_scan_results, modify_report, initiate_scans, modify_targets |
| 6.5 | Realtime progress (SSE/WebSocket)                                                             | ✅     | RE/AI | SSE                                                                                                                      |
| 6.6 | Datatables server-side (operator `= & \| > < !`)                                              | 🟡     | UI/AI | Filter/sort/paginate server-side                                                                                         |
| 6.7 | Mind-map visualisasi                                                                          | ❌     | —     | Dibuang (nice-to-have)                                                                                                   |

## 7. Dashboard & UI

| #   | Fitur ReNgGinaNg                                            | Status | Epic | Catatan                          |
| --- | ----------------------------------------------------------- | ------ | ---- | -------------------------------- |
| 7.1 | Dashboard ringkasan (counts target/subdomain/endpoint/vuln) | ✅     | UI   |                                  |
| 7.2 | Severity breakdown + tren 7 hari                            | ✅     | UI   |                                  |
| 7.3 | Kartu Threat Intel + risk score                             | ✅     | UI   |                                  |
| 7.4 | IoC/CVE/leak analytics                                      | ✅     | UI   |                                  |
| 7.5 | Charts                                                      | ➕     | UI   | Recharts/Visx (bukan ApexCharts) |
| 7.6 | Dark mode + WCAG AA                                         | ➕     | UI   | Desain baru shadcn/ui            |
| 7.7 | Onboarding                                                  | 🟡     | UI   | Ringkas                          |

## 8. Platform / Infra / Governance (fondasi)

| #    | Aspek ReNgGinaNg                                          | Status | Epic  | Catatan                                                                               |
| ---- | --------------------------------------------------------- | ------ | ----- | ------------------------------------------------------------------------------------- |
| 8.1  | Multi-service (Nginx/Django/Redis/Celery/Ollama/certs)    | 🟡     | PF    | Diringkas → app + worker + Postgres                                                   |
| 8.2  | Queue/broker (Redis + Celery 5 worker autoscale)          | ➕     | PF/RE | **pg-boss** di Postgres, TANPA Redis                                                  |
| 8.3  | DB (PostgreSQL)                                           | ✅     | PF    | + Drizzle ORM + drizzle-kit migrasi                                                   |
| 8.4  | RBAC (django-role-permissions)                            | ✅     | PF    | RBAC TS sendiri                                                                       |
| 8.5  | Settings/env (DOMAIN, POSTGRES, API keys)                 | ✅     | PF    | Hanya `.env.example`; secret-guard hook                                               |
| 8.6  | install.sh/update.sh/Makefile                             | 🟡     | PF    | docker compose up + drizzle migrate                                                   |
| 8.7  | CI (build multi-arch, CodeQL, auto-release, pages)        | ➕     | PF    | GitHub Actions dynamic-detection + reusable, typecheck/lint/unit/integration/e2e gate |
| 8.8  | Husky pre-commit lint-staged + commit-msg commitlint      | ✅➕   | PF    | + pre-push gate + git-identity + no-`.env` guard (model ose-primer 3-stage)           |
| 8.9  | Governance docs                                           | ➕     | PF    | Model 6-lapis ose-primer + Diátaxis                                                   |
| 8.10 | Fixtures (default scan engines, external tools, keywords) | 🟡     | PF/RE | Seed ringkas: 1-3 profil scan default + keyword                                       |

---

## Ringkasan keputusan

- **IKUT/SEDERHANAKAN/BARU (wajib ada task):** seluruh baris ✅ 🟡 ➕ di atas.
- **DIBUANG (tidak boleh muncul sebagai task v1):** 1.2, 1.5, 1.9–1.14, 4.10, 5.7, 6.7.
- Setiap epic harus menutup baris yang dipetakan ke kodenya. Definition-of-done epic = semua baris
  IKUT/SEDERHANAKAN miliknya punya task + lulus CI gate.
