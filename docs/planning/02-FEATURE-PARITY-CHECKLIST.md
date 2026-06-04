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

| #    | Fitur ReNgGinaNg                                                             | Status | Epic | Catatan                                                                       |
| ---- | ---------------------------------------------------------------------------- | ------ | ---- | ----------------------------------------------------------------------------- |
| 3.1  | VA Report PDF                                                                | ✅➕   | RP   | Desain baru, ringkasan vuln + severity + temuan                               |
| 3.2  | Threat Intel Report PDF (cover, exec summary, IoC, CVE, breach, rekomendasi) | ✅➕   | RP   | Desain baru                                                                   |
| 3.3  | Dwibahasa EN/ID                                                              | ✅     | RP   |                                                                               |
| 3.4  | Branding per-project (logo, warna, no dok, klasifikasi, signatory)           | ✅     | RP   | `ThreatIntelReportSetting` → setting vacti                                    |
| 3.5  | Engine render                                                                | ➕     | RP   | **Playwright HTML/CSS → PDF** (alternatif Typst), bukan WeasyPrint            |
| 3.6  | Lembar pengesahan/signatory                                                  | ✅     | RP   |                                                                               |
| 3.7  | Logo perusahaan di cover (upload → data URL, fallback monogram)              | ✅➕   | RP   | Branding cover; tanda tangan signatory juga image (data URL)                  |
| 3.8  | Daftar isi (TOC) dwibahasa                                                   | ✅➕   | RP   | Nomor halaman dilewati (layout mengalir; perlu render 2-pass)                 |
| 3.9  | Komponen visual: donut severity, bar chart (per-severity/jenis/status HTTP)  | ✅➕   | RP   | CSS conic + bar; inventaris subdomain jadi tabel + status pill                |
| 3.10 | Ringkasan kerentanan (agregasi per-nama) + finding URL chips                 | ✅➕   | RP   | Finding di-agregasi per nama; daftar URL terdampak                            |
| 3.11 | Detail finding: CVSS, CVE ID, References                                     | ✅➕   | RP   | Ditangkap dari template nuclei (info.classification/reference) → migrasi 0009 |
| 3.12 | Executive summary custom (EN/ID) + placeholder, klasifikasi di cover         | ✅➕   | RP   | Toggle pakai custom; fallback auto-generate                                   |

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

## Addendum — Finding status (2026-06-04)

- ➕ **VA finding status** (RE): each vulnerability has a triage status (Open / On Progress / Resolved /
  Risk Accepted / False Positive / No Impact / WAF Handled / Duplicate / Out of Scope / Reopened);
  only active statuses feed the risk score.
- ➕ **Leak finding status** (TI): LeakCheck findings have a status (New / Investigating / Confirmed /
  Remediated / False Positive / Ignored), replacing the checked toggle. Status applies to leaks only.
- Full spec: [05-FINDING-STATUS.md](05-FINDING-STATUS.md).

## Addendum — Report parity selesai (2026-06-04)

Hasil audit ulang menyeluruh template/model/form report ReNgGinaNg (`templates/report/default.html`,
`modern.html`, `threatIntel/report_banking.html`, `VulnerabilityReportSetting`,
`ThreatIntelReportSetting`, `ReportSignatory`). Semua komponen sudah ada di vacti:

- ➕ Cover navy bertekstur + **logo** (data URL, fallback monogram) + klasifikasi di pill.
- ➕ **Daftar isi** dwibahasa; eyebrow + section bernomor; **dwibahasa (ID/EN)** di semua
  judul/minihead/label/stat/TOC.
- ➕ Blok **Klasifikasi Dokumen** + note RAHASIA/CONFIDENTIAL; note "Tentang Penilaian".
- ➕ **Donut** severity + **bar chart** (per-severity / per-jenis / subdomain per-status HTTP).
- ➕ **Inventaris subdomain** sebagai tabel + **status pill** HTTP (join subdomain ↔ status endpoint).
- ➕ **Ringkasan kerentanan** (agregasi per-nama: nama | jumlah | tingkat).
- ➕ **Finding** di-agregasi per nama + **URL terdampak** (chips) + tag jumlah/jenis/status.
- ➕ Detail finding **CVSS / CVE / References** — ditangkap dari template nuclei
  (`info.classification`, `info.reference`); deskripsi/remediasi template jadi fallback non-AI.
- ➕ **Tanda tangan** (signature image) per signatory di lembar pengesahan.
- ➕ **Executive summary custom** (EN/ID) dengan placeholder (`{company_name}`, `{target_name}`,
  `{vulnerability_count}`, `{critical_count}`, `{active_count}`, `{scan_date}`, dll).
- Migrasi DB: 0007 (default teal/navy), 0008 (logo/signature/exec-summary), 0009 (cvss/cve/refs).
- Catatan: nomor halaman TOC dilewati (layout mengalir untuk data dinamis; butuh render 2-pass).

## Addendum — Status implementasi & sisa gap (2026-06-04)

Checklist di atas adalah **kontrak cakupan** (keputusan IKUT/SEDERHANAKAN/BUANG), bukan status build.
Berikut status **implementasi nyata** hasil audit kode. Baris ✅ = sudah jalan; ⬜ = belum dibangun.

### Sudah terimplementasi (✅)

- Recon penuh: subfinder → httpx → naabu → nuclei + WordPress kondisional; idempotent completion;
  Command capture; ScanActivity timeline + SSE; predefined subs; scan profiles.
- Threat Intel penuh: OTX, LeakCheck, manual indicators, `computeProjectRisk` (konsisten
  dashboard/TI/report), refresh + progress, leak finding status, VA finding status.
- Reports: VA + TI PDF lengkap (lihat addendum di atas).
- Integrasi: webhook 5 kanal (Discord/Slack/Telegram/Google Chat/generic) + per-event + UI;
  AI enrichment vuln (cache `ai_cache`) + UI; AI provider abstraction (Vercel AI SDK
  Anthropic/OpenAI/Ollama) + UI; API key vault terenkripsi AES-256-GCM (`libs/auth/vault.ts`).
- API: Hono REST semua resource + OpenAPI (`/api/docs`) + token API (`vct_`) + UI token; SSE.
- Auth: session cookie + API token; password hashing (scrypt sementara).
- UI: dashboard (counts/severity/tren + analytics), TI page, charts (recharts), dark mode,
  settings (tokens/integrations/reports).

### Belum dibangun / sisa gap (⬜) — backlog v1

| #   | Gap                               | Epic  | Catatan / rencana                                                                                                                                |
| --- | --------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1  | **RBAC enforcement server-side**  | PF    | Role + matrix permission sudah ada (`libs/core/rbac.ts`) tapi BELUM dienforce di API/web. Auditor read-only belum aktif. **Prioritas keamanan.** |
| G2  | **Scan cancellation UI + API**    | RE    | Backend AbortSignal + kill sudah ada; belum ada route `POST /scans/:id/cancel` + tombol UI                                                       |
| G3  | **Scheduled scans (cron)**        | RE    | Belum ada tabel jadwal + dispatcher pg-boss cron + UI                                                                                            |
| G4  | **Scan diff/perbandingan**        | RE/UI | Bandingkan 2 scan (endpoint/port/vuln baru-hilang) — belum ada                                                                                   |
| G5  | **Sub-scan / rescan sebagian**    | RE    | Jalankan ulang subset tahap — belum ada                                                                                                          |
| G6  | **API key vault UI (per-proyek)** | AI/PF | Enkripsi + tabel `apiKeys` ada, tapi OTX/LeakCheck/AI masih dari `.env`; belum ada UI kelola key per-proyek                                      |
| G7  | **AI executive summary (auto)**   | AI    | Saat ini exec summary manual/template; belum ada generate AI otomatis                                                                            |
| G8  | **AI threat analysis (narasi)**   | AI    | Risk score algoritmik sudah ada; narasi/ringkasan TI berbasis LLM belum                                                                          |
| G9  | **argon2id password hashing**     | PF    | Sekarang scrypt (portabel sementara); target produksi argon2id                                                                                   |
| G10 | **Audit log tulis + viewer**      | PF    | Tabel `auditLog` ada tapi tidak pernah ditulis & tak ada UI                                                                                      |
| G11 | **Datatables server-side**        | UI/AI | Filter/sort/paginate server-side; sekarang fetch penuh                                                                                           |
| G12 | **Custom request headers**        | RE    | Kolom `targets.customHeaders` ada tapi belum disuntik ke httpx                                                                                   |
| G13 | **Universal search**              | UI    | Pencarian global lintas resource — belum ada                                                                                                     |
| G14 | **Recon notes/todo per target**   | UI    | Catatan per target — belum ada                                                                                                                   |
| G15 | **Interesting keywords/lookup**   | RE    | Penanda endpoint menarik (admin/ftp/cpanel) — belum ada                                                                                          |
| G16 | **Seed/fixtures**                 | PF/RE | Profil scan default + keyword sebagai seed — belum ada (DEFAULT_PROFILE hardcoded di worker)                                                     |
| G17 | **Onboarding ringkas**            | UI    | Walkthrough pertama kali — belum ada                                                                                                             |

**Urutan saran:** G1 (RBAC, keamanan) → G2 (scan cancel UI) → G3 (scheduled) → G6 (key vault UI) →
G4/G5 (diff/sub-scan) → sisanya. Proxy support & multi-org tetap di luar v1.
