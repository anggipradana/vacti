# syntax=docker/dockerfile:1

# ---- deps + build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx next build apps/web

# ---- runtime ----
# NOTE: the recon worker image gains the ProjectDiscovery binaries (subfinder/httpx/naabu/nuclei)
# + nuclei-templates + Chromium in platform-foundation task 008 / recon-engine + reports epics.
# The foundation image below boots app + worker + db.
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
EXPOSE 3000
CMD ["npx", "next", "start", "apps/web", "-p", "3000"]
