# How to QA with the Playwright UI (headed, on this WSL2 host)

This host runs under **WSLg**, so GUI apps render on the Windows desktop. The Playwright UI/headed
runner works once `DISPLAY` is set (added to `~/.bashrc`: `DISPLAY=:0`).

## One-time setup (already done)

- `DISPLAY=:0` + `WAYLAND_DISPLAY=wayland-0` exported in `~/.bashrc`.
- Playwright headed system libs installed: `sudo npx playwright install-deps chromium`.
- Browser: `@playwright/test` pinned `1.48.2`; launches use `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04`.

## Run modes

```bash
# Env the app needs (Postgres + secrets); e2e DB = vacti_e2e
export DATABASE_URL="postgres://vacti:vacti@localhost:5432/vacti_e2e"
export ENCRYPTION_KEY="dGVzdC1lbmNyeXB0aW9uLWtleS0zMmJ5dGVzLXRlc3Q="
export SESSION_SECRET="test-session-secret-0000000000000000"

npm run e2e          # headless (CI parity) — all specs
npm run e2e:ui       # Playwright UI mode — interactive, watch/replay each step (WSLg window)
npm run e2e:headed   # headed run — see the browser drive each flow
```

- **UI mode** (`e2e:ui`) opens the Playwright test explorer on the Windows desktop: pick a spec, watch it
  run step-by-step, inspect the DOM/network/console at each action, and re-run on change. Best for human QA.
- **Headed** (`e2e:headed`) just shows the browser executing the suite end-to-end.
- CI always runs **headless** — the same specs, no display.

## Traces & screenshots (headless review)

`playwright.config.ts` keeps traces on first retry. To always capture for review:

```bash
npx playwright test -c apps/web/playwright.config.ts --trace on --reporter=line
npx playwright show-trace   # opens the trace viewer (WSLg window)
```

Specs live in `apps/web/e2e/*.e2e.ts`. See the QA coverage matrix in
[docs/planning/07-QA-AND-POLISH-PLAN.md](../planning/07-QA-AND-POLISH-PLAN.md).
