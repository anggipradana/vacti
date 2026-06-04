---
name: api-and-integrations
status: completed
created: 2026-06-03T19:09:19Z
updated: 2026-06-05T02:30:00Z
progress: 100%
prd: .claude/prds/vacti.md
github: (will be set on sync)
---

# Epic: api-and-integrations

## Overview

Jadikan **API warga kelas satu** dan integrasi WAJIB: REST publik bertipe (Hono) untuk semua resource
dengan **OpenAPI** terdokumentasi otomatis, autentikasi session + **API token** ber-scope, **webhook
notifications** (Discord/Slack/Telegram/Google Chat) dengan pemicu per-event, **AI provider abstraction**
(Vercel AI SDK: Claude default/OpenAI/Ollama) untuk enrichment kerentanan + executive summary + analisis
threat (hasil di-cache), dan integrasi **API Key Vault** terenkripsi untuk kunci eksternal.

Menutup baris Feature Parity Checklist: **5.1–5.6, 6.1, 6.2, 6.5, 6.6.**

## Architecture Decisions

- **tRPC internal** (UI) + **Hono REST publik** + Zod; OpenAPI di-generate dari skema Zod (`@hono/zod-openapi`)
  → satu sumber kebenaran, dokumentasi (Redoc/Swagger UI) selalu sinkron.
- **API token ber-scope** (dibangun di atas auth platform-foundation) + rate limiting.
- **Notifier framework** event-driven: event domain (scan started/finished, vuln found, TI refreshed)
  → kanal terkonfigurasi per-project; template pesan + retry.
- **AI abstraction** via Vercel AI SDK; provider+model dipilih dari setting; **cache** hasil enrichment
  (kunci = hash konten) untuk hemat biaya & idempotensi.
- **Kunci eksternal** (OTX/LeakCheck/AI/webhook secrets) dari **vault AES-256-GCM** (platform-foundation).
- **SSE** sebagai mekanisme realtime utama (progress scan & refresh).

## Technical Approach

### Backend Services

- `@vacti/api` (lib): Hono app, route per resource (project/target/scan/subdomain/endpoint/port/vuln/
  threat-intel/report/settings), Zod schemas, OpenAPI doc, auth middleware (session+Bearer), rate-limit.
- `@vacti/integrations` (lib): notifier (kanal + dispatcher + templates + retry), AI service
  (provider abstraction + enrichment/summary/analysis + cache), event bus tipis.
- `@vacti/db` (extend): `webhooks`, `notification_events`, `ai_cache`, `ai_settings` (provider/model),
  (reuse `api_keys` vault, `api_tokens`).
- SSE endpoint terpusat.

### Frontend Components

- Halaman integrasi (webhook config, AI settings) + API docs link diserahkan ke **dashboard-ui**;
  epic ini sediakan API + service + skema.

### Infrastructure

- Tidak ada layanan baru. AI Ollama opsional (self-host) — degrade bila tak ada.

## Implementation Strategy

1. Hono REST + Zod + OpenAPI doc (resource read endpoints dulu) + auth middleware.
2. API token scopes + rate limiting.
3. Event bus + webhook notifier (kanal, dispatch, retry, per-event trigger).
4. AI provider abstraction + enrichment/summary/analysis + cache.
5. Vault wiring untuk kunci eksternal + SSE realtime terpusat.
6. Tests: contract/OpenAPI lint, notifier (mock webhook), AI (mock provider + cache hit), e2e token.

## Task Breakdown Preview

- [ ] 001 Public REST (Hono) + Zod schemas + OpenAPI doc + Redoc/Swagger UI
- [ ] 002 API token scopes + rate limiting (atas auth platform-foundation)
- [ ] 003 Event bus + webhook notifier (Discord/Slack/Telegram/Google Chat, per-event, retry)
- [ ] 004 AI provider abstraction (Vercel AI SDK) — enrichment/exec-summary/threat-analysis + cache
- [ ] 005 Vault wiring (kunci eksternal terenkripsi) + SSE realtime terpusat
- [ ] 006 Tests (OpenAPI lint, notifier mock, AI cache, e2e API token)

## Dependencies

- **platform-foundation** (auth/token, vault, RBAC, SSE dasar).
- **recon-engine** & **threat-intel** (sumber data & event); **reports** (konsumsi exec summary AI).

## Success Criteria (Technical)

- OpenAPI ter-generate & lulus lint (Spectral); semua resource ter-expose & terdokumentasi.
- API token ber-scope berfungsi untuk otomasi eksternal; rate-limit aktif.
- Webhook terkirim per-event ke ≥4 kanal (terbukti via mock) dengan retry.
- AI enrichment menghasilkan deskripsi/impact/remediation + exec summary; **cache hit > 80%** saat ulang.
- Fitur AI/webhook degrade anggun tanpa kunci.

## Estimated Effort

- Timeline: ~2.5 minggu (1 dev).
- Jalur kritis: 001 → 002 → {003,004} → 005.

## Tasks Created

- [x] 001.md - Public REST (Hono) + Zod + OpenAPI (parallel: true)
- [x] 002.md - API token scopes + rate limiting (parallel: false)
- [x] 003.md - Event bus + webhook notifier (parallel: true)
- [ ] 004.md - AI provider abstraction + enrichment + cache (parallel: true)
- [ ] 005.md - Vault wiring (external keys) + central SSE (parallel: false)
- [x] 006.md - API & integrations tests (parallel: false)

Total tasks: 6
Estimated total effort: ~54 jam
Dependency order: {001,003,004} → 002 → 005 → 006
