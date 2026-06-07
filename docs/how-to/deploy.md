# How to Deploy vacti (Docker Compose)

> Status: placeholder — completed in platform-foundation task 008.

vacti runs as three services: `app` (Next.js), `worker` (pg-boss + recon tools + Chromium), and
`db` (PostgreSQL 16).

1. Provision a host with Docker + Docker Compose and network egress to scan targets + external APIs.
2. Set environment variables (see `.env.example`). Generate secrets with `openssl rand -base64 32`.
3. `make up` (or `docker compose up --build -d`).
4. Migrations run on worker boot; the first admin is seeded from `ADMIN_*` env.
5. (Optional) Front with your own reverse proxy/TLS.

## Public access via Cloudflare Tunnel

vacti needs no inbound ports or public IP — expose it with `cloudflared`:

```bash
cloudflared tunnel login
cloudflared tunnel create vacti
cloudflared tunnel route dns vacti <your-domain>
cloudflared tunnel run --url http://localhost:3000 vacti
```

Or run `cloudflared` as a compose sidecar using a `TUNNEL_TOKEN`. Cloudflare terminates TLS at the
edge, so vacti ships no certificates. See [API & deploy notes](../planning/03-API-AND-DEPLOY.md).

## Bare-metal / WSL (without Docker)

Docker Compose is canonical. If you run the services directly on a host (e.g. WSL), use the committed
supervisors so both self-heal with capped backoff:

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
