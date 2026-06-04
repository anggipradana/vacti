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
