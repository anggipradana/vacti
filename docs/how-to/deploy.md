# How to Deploy vacti (Docker Compose)

**Docker Compose is the canonical, recommended deployment.** All three vacti services run in
containers — nothing vacti-specific needs to be installed on the host:

- `db` — PostgreSQL 16 (data in the `vacti-pg` volume).
- `worker` — **self-contained recon engine**: the image bakes in the pinned active-scan toolset
  (subfinder / httpx / naabu / nuclei), the nuclei-templates catalog, and Chromium (for PDF reports).
  Runs DB migrations on boot, then consumes the pg-boss queue (scans / TI / schedules / daily news).
- `app` — Next.js production build (`next start`), published on host port **3100**.

The only thing kept off-Docker is the optional public-access proxy (`cloudflared`) — it is not part of
the app, it just forwards to `http://localhost:3100`.

## Deploy

1. Install Docker + Docker Compose on the host (network egress to scan targets + external APIs).
2. Create `.env` (see `.env.example`); generate secrets with `openssl rand -base64 32`
   (`ENCRYPTION_KEY` must be 32 bytes base64). Optional: `ADMIN_EMAIL`/`ADMIN_PASSWORD`,
   `OTX_API_KEY`, `LEAKCHECK_API_KEY`, `VT_API_KEY`, AI keys, `NEWS_RETENTION_DAYS`.
3. `docker compose up --build -d` (first build is heavy — it downloads the recon binaries + Chromium).
4. Migrations run on worker boot; open `http://localhost:3100` and create the first admin
   (or seed via `ADMIN_*`).

Upgrading after a code change: `docker compose up --build -d` rebuilds and recreates the changed
services. Bump the `*_VERSION` build args in the `worker` stage of the `Dockerfile` to upgrade tools.

## Public access via Cloudflare Tunnel (host-side, not a vacti service)

vacti needs no inbound ports or public IP — expose it with `cloudflared`, pointed at the app's
published host port:

```bash
cloudflared tunnel login
cloudflared tunnel create vacti
cloudflared tunnel route dns vacti <your-domain>
cloudflared tunnel run --url http://localhost:3100 vacti
```

Or run `cloudflared` as a compose sidecar using a `TUNNEL_TOKEN`. Cloudflare terminates TLS at the
edge, so vacti ships no certificates. See [API & deploy notes](../planning/03-API-AND-DEPLOY.md).

## Bare-metal / WSL (fallback — only when Docker is unavailable)

Docker Compose (above) is canonical and keeps vacti off the host. Use bare-metal **only** where the
Docker engine isn't available (e.g. a WSL box without Docker). It requires the recon tools to be
installed on the host PATH (`subfinder`/`httpx`/`naabu`/`nuclei`) + Chromium for reports — exactly
what the worker image bundles for you. Run the committed supervisors so both self-heal with capped
backoff:

- **Worker:** `scripts/run-worker.sh` (see file header).
- **Web app:** `scripts/run-app.sh` — serves a **production build** via `next start`.

### Always serve a production build (one mode, not "dev")

There are two Next.js run modes and they are NOT interchangeable in production:

- `next dev` — for **local coding only**. Recompiles each route per request and ships large
  unminified JS + React dev mode. Convenient (hot reload) but slow; heavy pages (e.g. `/scans/[id]`)
  can take ~1s server-side. **Never use it for the live site.**
- `next start` — serves a precompiled, minified build. This is what users should always hit.

So for the live site it is effectively **one mode: production**. (The extra `vacti_test` / `vacti_e2e`
databases and the `.next-e2e` build dir exist only for automated tests — they never touch live data
or the live server.)

### Deploy / redeploy

```bash
# 1. Build the production bundle (into an isolated dist dir so the live server is untouched)
NEXT_DIST_DIR=.next-build npx next build apps/web
# 2. Swap it in and (re)start under the supervisor
rm -rf apps/web/.next-prod && mv apps/web/.next-build apps/web/.next-prod
NEXT_DIST_DIR=.next-prod PORT=3100 scripts/run-app.sh   # run under setsid/systemd/pm2 to detach
```

After any code change you must rebuild + restart (production has no hot reload). To stop the
supervised app, signal its process group (it traps `TERM` and exits without restarting); find it by
port with `ss -ltnp 'sport = :3100'` rather than `pkill -f "next …"` (that pattern matches your own
shell). `cloudflared` then points at `http://localhost:3100`.
