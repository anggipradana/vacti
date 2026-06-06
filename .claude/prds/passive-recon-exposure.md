---
name: passive-recon-exposure
description: Passive OSINT recon (VirusTotal + Wayback) + exposure discovery (regex secret detection, file-category analysis, passive-DNS/origin, deep-fetch) for vacti VA, adapted lightweight from scoptix — HTTP-only engines, Postgres rotation, SSRF-guarded, no Redis
status: backlog
created: 2026-06-06T00:00:00Z
---

# PRD: Passive Recon & Exposure Discovery

## Executive Summary

Add a **passive reconnaissance + exposure-discovery** capability to vacti's VA module (with CTI
ties), learned from **Omnitarium/scoptix** (Apache-2.0, Next.js/TS). It widens attack-surface
discovery beyond active scanning by pulling **passive OSINT** (VirusTotal passive DNS + Wayback
Machine archive), then analyses discovered URLs for **exposed secrets/credentials** and
**sensitive file categories**, surfaces **passive-DNS IP history** (origin behind WAF), and (opt-in)
**deep-fetches** content for body-level secret detection. It plugs into existing vacti surfaces:
the **Exposure** component of the Unified Risk Score, scan diffing, reports, and LeakCheck/OTX
cross-links.

Delivered the vacti way: **HTTP-API engines only** (no new binary/runtime), queue on **pg-boss**,
API-key rotation/quota/backoff in **Postgres (no Redis)**, deep-fetch **SSRF-guarded** and opt-in,
exposure snippets handled as **confidential PII**, RBAC + auth retained. Full design:
[docs/planning/11-PASSIVE-RECON-AND-EXPOSURE.md](../../docs/planning/11-PASSIVE-RECON-AND-EXPOSURE.md).

## Problem Statement

vacti's recon is purely **active** (subfinder→httpx→naabu→nuclei) — it misses assets that only show
up in **passive** sources: forgotten subdomains, archived URLs (Wayback), origin IPs behind a WAF
(passive DNS), and publicly exposed secrets/backups/documents. These are exactly the high-signal,
low-noise findings real engagements (and the OrwaGodFather "Art of VirusTotal" methodology) prize:
exposed `backup.7z`, leaked API keys in archived JS, valid-too-long password-reset URLs, origin
infrastructure behind Cloudflare. scoptix proves the approach in the same stack; vacti can adopt the
ideas while keeping its lightweight, secure, RBAC posture.

## User Stories

- As an analyst, I run a **passive** scan on a domain and get subdomains, archived URLs, and IP
  resolution history without touching the target.
- As an analyst, I see **exposure findings** (AWS/GitHub/Slack/Stripe keys, JWTs, private keys,
  DB-connection strings, basic-auth URLs, stealer/combo creds) extracted from discovered URLs, with
  masked snippets I can reveal, and they raise the project's risk score.
- As an analyst, I filter discovered URLs by **file category** to spot backups/configs/keys/documents.
- As an analyst, I find the **origin IP behind a WAF** from passive-DNS hostname↔IP history.
- As an analyst, I optionally **deep-fetch** suspicious URLs (config/backup) to scan response bodies,
  knowing it is SSRF-guarded and opt-in.
- As an analyst, I **diff** scans to see newly discovered subdomains/URLs/IPs/findings, and **export**
  results as CSV/ZIP.

## Requirements (functional)

1. **Passive engines** (HTTP clients): VirusTotal v2 domain report (subdomains, domain-siblings,
   undetected-URLs+dates, resolutions) and Wayback CDX (archived URLs). URLScan optional (roadmap).
2. **Scan modes**: `passive` (OSINT-only, no binaries), `active` (existing), `full` (passive→feed→active).
3. **Exposure findings**: pure-TS regex ruleset (ported from scoptix) over URL strings and (opt-in)
   response bodies; prefilter+priority+overlap-claim; editable rules in settings; snippet capped.
4. **Content analysis**: extension→category with seedable, editable suffix rules; per-URL category.
5. **Passive DNS / IP**: `ip_resolutions` + sightings (hostname↔IP timeline, cross-scan aggregation).
6. **Deep-fetch** (opt-in, optionally per-category): mandatory SSRF guard, size cap, optional SOCKS proxy.
7. **Rotation/quota/backoff** for multi-key providers, in Postgres (`next_available_at`, daily/weekly/
   monthly counters, disable flag).
8. **Diff** extended with findings/IPs/archived URLs; **CSV/ZIP export** per resource.
9. **Integrations**: feed Exposure risk-score component; cross-link combo/email findings to LeakCheck
   and IP history to OTX; new "Attack Surface & Exposure" report section (bilingual, redacted).

## Non-functional / governance

- HTTP-only engines, no new binary/runtime; three services (app + worker + Postgres); **no Redis**.
- Deep-fetch SSRF-guarded + opt-in; exposure snippets = confidential PII; RBAC + auth enforced.
- Type-safe (Drizzle→Zod→API→UI); API-first (every new resource ships its typed endpoint).

## Out of scope

- ❌ Redis/BullMQ; Redis-based rotator. ❌ Active crawlers (gospider/hakrawler/katana).
- ❌ scoptix "no-auth, not-for-production" posture — vacti keeps auth + RBAC.

## Phasing

- **v1.1:** engines VT+Wayback, `passive` mode, exposure regex, file categories, passive-DNS/IP,
  diff extension, Postgres rotation/quota.
- **v1.2:** deep-fetch + SSRF + proxy, CSV/ZIP export, endpoint/param discovery.
- **roadmap:** discovery-over-time dashboard, URLScan engine.

## Success criteria

- A `passive` scan on an authorized domain returns subdomains + archived URLs + IP history with zero
  active traffic. Exposure findings appear, masked, and move the Exposure risk component (±0 across
  dashboard/TI/report). Deep-fetch refuses private/metadata targets. No Redis added; image gains no
  new binary.
