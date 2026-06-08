# syntax=docker/dockerfile:1

# ---- deps + build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Copy the whole monorepo BEFORE install: npm workspaces needs every libs/*/package.json present so
# it can create the @vacti/* symlinks in node_modules (installing first would skip them).
COPY . .
# --legacy-peer-deps: framer-motion declares a React 18 peer but works with React 19 (project pin).
RUN npm ci --legacy-peer-deps
RUN npx next build apps/web

# ---- app runtime (Next.js production server) ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
EXPOSE 3000
CMD ["npx", "next", "start", "apps/web", "-p", "3000"]

# ---- worker runtime (recon engine + reports) ----
# Self-contained worker image: pinned ProjectDiscovery binaries + nuclei-templates + Chromium, so
# scans and PDF report rendering run entirely in the container (nothing required on the host).
FROM node:20-bookworm-slim AS worker
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# Runtime deps: libpcap for naabu; curl/unzip to fetch the pinned release binaries.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl unzip libpcap0.8 \
  && rm -rf /var/lib/apt/lists/*
# Pinned active-scan toolset (prebuilt release zips — keeps the image free of the Go toolchain).
# Bump these to upgrade tools; the set is frozen by governance (subfinder/httpx/naabu/nuclei).
ARG SUBFINDER_VERSION=2.14.0
ARG HTTPX_VERSION=1.9.0
ARG NAABU_VERSION=2.6.1
ARG NUCLEI_VERSION=3.8.0
RUN set -eux; cd /tmp; \
  for spec in \
    "subfinder:${SUBFINDER_VERSION}" \
    "httpx:${HTTPX_VERSION}" \
    "naabu:${NAABU_VERSION}" \
    "nuclei:${NUCLEI_VERSION}"; do \
    name="${spec%%:*}"; ver="${spec##*:}"; \
    curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors \
      -o tool.zip "https://github.com/projectdiscovery/${name}/releases/download/v${ver}/${name}_${ver}_linux_amd64.zip"; \
    unzip -o tool.zip "${name}" -d /usr/local/bin; \
    chmod +x "/usr/local/bin/${name}"; \
    rm tool.zip; \
  done; \
  subfinder -version; httpx -version; naabu -version; nuclei -version
COPY --from=build /app ./
# Chromium for PDF report rendering (Playwright) and the nuclei template catalog, baked in so the
# first scan/report doesn't pay a cold download.
RUN npx playwright install --with-deps chromium \
  && nuclei -update-templates -silent || true
CMD ["npx", "tsx", "apps/worker/src/main.ts"]
