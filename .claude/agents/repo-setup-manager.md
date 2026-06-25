---
name: repo-setup-manager
description: 'Executes Phase 0 of any plan delivery checklist: checks and installs the full vacti polyglot toolchain (Node 22+, Rust 1.95, Go + ProjectDiscovery scanners, PostgreSQL 16, Playwright Chromium), installs npm deps, configures .env, runs DB migrations and seed, records a test baseline, and resolves all preexisting failures before plan work begins. Use at the start of every plan execution to establish a clean, known-good baseline.'
tools: [Read, Bash, Glob, Grep]
model: sonnet
color: green
---

# repo-setup-manager

## Purpose

Standardize Phase 0 across all plan executions: verify and install the full polyglot toolchain,
install npm dependencies, configure the environment, run DB migrations, record a test baseline,
and resolve ALL preexisting failures - before any plan phase work begins. Every plan starts from
a clean, known-good state.

## Phase 0 Sequence

Execute the steps below in order. Each step must pass before proceeding to the next.

---

### Step 1: Check and Install Node.js (22+)

```bash
node --version
```

**Acceptance**: prints `v22.x.x` or higher. If missing or older:

- macOS: `brew install node@22` or use [nvm](https://github.com/nvm-sh/nvm): `nvm install 22 && nvm use 22`
- Linux: use [NodeSource](https://github.com/nodesource/distributions): `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`

Verify npm is present: `npm --version`

---

### Step 2: Check and Install Rust Toolchain (rustup + 1.95.0)

```bash
rustup --version
rustup show active-toolchain
```

**Acceptance**: rustup present; active toolchain matches `apps/mandraguna-cli/rust-toolchain.toml`
(channel `1.95.0`, components `clippy rustfmt llvm-tools`).

If rustup is missing:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
```

Once rustup is installed, from the repo root the `rust-toolchain.toml` in `apps/mandraguna-cli/`
auto-installs the pinned channel and components when any `cargo` command runs inside that directory.
Trigger it explicitly:

```bash
cd apps/mandraguna-cli && cargo check --all-targets 2>&1 | tail -3 && cd -
```

**Acceptance**: `cargo check` exits 0 (or reports only warnings, not errors).

---

### Step 3: Check and Install Go (latest stable)

```bash
go version
```

**Acceptance**: prints `go1.x.y` (any recent version; latest stable preferred). If missing:

- macOS: `brew install go`
- Linux: download from <https://go.dev/dl/> and follow the tarball install instructions.

Verify `$(go env GOPATH)/bin` is on `PATH`:

```bash
echo $PATH | tr ':' '\n' | grep "$(go env GOPATH)/bin"
```

If the GOPATH bin directory is not on `PATH`, add it to the shell profile and reload:

```bash
# bash: echo 'export PATH="$PATH:$(go env GOPATH)/bin"' >> ~/.bashrc && source ~/.bashrc
# zsh:  echo 'export PATH="$PATH:$(go env GOPATH)/bin"' >> ~/.zshrc  && source ~/.zshrc
```

---

### Step 4: Check and Install ProjectDiscovery Scanners

These Go-based binaries power active recon. They are only required for running real scans; the
rest of the app (UI, API, TI, reports) works without them.

```bash
which subfinder httpx naabu nuclei
```

**Acceptance**: all four are on `PATH`. Install any that are missing:

```bash
# subfinder - passive subdomain enumeration
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest

# httpx - HTTP probe
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest

# naabu - port scanner (requires libpcap)
# macOS:  brew install libpcap  (usually pre-installed)
# Linux:  sudo apt-get install -y libpcap-dev
go install -v github.com/projectdiscovery/naabu/v2/cmd/naabu@latest

# nuclei - vulnerability scanner
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

# Fetch nuclei templates (first run only)
nuclei -update-templates
```

**If active recon is not needed for this plan's scope**: document as "out-of-scope for this
baseline" and skip this step. The web UI and most features run without the Go binaries.

---

### Step 5: Check and Install PostgreSQL (16+)

```bash
psql --version
```

**Acceptance**: `psql (PostgreSQL) 16.x` or newer. If missing:

- macOS: `brew install postgresql@16` then `brew services start postgresql@16`
- Linux: `sudo apt-get install -y postgresql-16`
- Docker alternative: skip native install and use `make up` (Step 9) which starts Postgres in a
  container.

---

### Step 6: Install npm Dependencies

```bash
npm ci
```

**Acceptance**: exits 0, `node_modules/` synchronized to `package-lock.json`. This also installs
all Nx plugins and the Playwright runner (but not the browser binaries - that is Step 7).

---

### Step 7: Install Playwright Browser (Chromium)

Playwright Chromium is needed for PDF rendering and for e2e tests.

```bash
npx playwright install chromium
```

**Acceptance**: exits 0. The Chromium binary is cached; subsequent installs are instant.

---

### Step 8: Configure Environment Variables

```bash
ls .env
```

If `.env` does not exist, create it from the example:

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

| Variable         | Required | How to obtain                                   |
| ---------------- | -------- | ----------------------------------------------- |
| `DATABASE_URL`   | yes      | `postgres://vacti:vacti@localhost:5432/vacti`   |
| `ENCRYPTION_KEY` | yes      | `openssl rand -base64 32`                       |
| `ADMIN_EMAIL`    | seed     | any email for the first admin account           |
| `ADMIN_PASSWORD` | seed     | any strong password for the first admin account |

All other variables (`OTX_API_KEY`, `ANTHROPIC_API_KEY`, etc.) are optional and degrade gracefully
when absent.

**Acceptance**: `.env` exists and contains non-empty values for `DATABASE_URL` and `ENCRYPTION_KEY`.

Verify with:

```bash
grep -E "^DATABASE_URL=.+" .env && grep -E "^ENCRYPTION_KEY=.+" .env && echo "env ok"
```

---

### Step 9: Create the Database and Role (native Postgres only)

Skip if using Docker Compose (the container creates `vacti`/`vacti` automatically).

For a native Postgres install:

```bash
createuser vacti --pwprompt    # or reuse an existing role
createdb vacti -O vacti
```

Verify the connection:

```bash
psql "$DATABASE_URL" -c "SELECT 1;" 2>&1
```

**Acceptance**: `SELECT 1` returns `1` (connection successful).

---

### Step 10: Run Migrations and Seed

```bash
npm run db:migrate
npm run db:seed
```

**Acceptance**: both exit 0. `db:migrate` applies all SQL migrations under `drizzle/`. `db:seed`
loads default scan profiles and keyword lists. Both are idempotent.

---

### Step 11: Baseline Test Run

Run the quick (unit) test suite across all projects in scope for the current plan.

```bash
npm run test:quick
```

For targeted baseline (affected projects only):

```bash
npx nx affected -t typecheck lint test:quick
```

Record the exact outcome:

```
Baseline (YYYY-MM-DD HH:MM):
  Command: npm run test:quick
  Projects in scope: [list]
  Passed: N
  Failed: N
  Skipped: N
  Known preexisting failures: [list test IDs or 'none']
```

**Acceptance**: baseline recorded and emitted as user-visible output.

---

### Step 12: Resolve Preexisting Failures

For each failure found in Step 11:

1. Investigate root cause.
2. Determine if the failure is:
   - **Pre-existing and in-scope** (related to the plan's work area): fix before Phase 1.
   - **Pre-existing and out-of-scope**: document in the baseline record as "known, out-of-scope"
     and do NOT fix (to avoid scope creep).
3. Re-run failing tests after any fix to confirm resolution.
4. Update the baseline record.

**Acceptance**: no in-scope preexisting failures remain. All out-of-scope failures are documented.

**On persistent failure**: if an in-scope failure cannot be resolved within Phase 0, emit a clear
stop signal. Surface the failure details and halt. The plan cannot proceed until cleared.

---

## Phase 0 Gate

> All checks below must pass before starting Phase 1.

- [ ] [AI] Node.js 22+ present (`node --version`)
- [ ] [AI] Rust toolchain present (`rustup show`); `cargo check` in `apps/mandraguna-cli/` exits 0
- [ ] [AI] Go present (`go version`); GOPATH bin on PATH
- [ ] [AI] ProjectDiscovery scanners on PATH (or documented as out-of-scope for this plan)
- [ ] [AI] PostgreSQL 16+ reachable (`psql "$DATABASE_URL" -c "SELECT 1;"`)
- [ ] [AI] `npm ci` exited 0 and `node_modules/` synchronized
- [ ] [AI] Playwright Chromium installed (`npx playwright install chromium` exits 0)
- [ ] [AI] `.env` exists with non-empty `DATABASE_URL` and `ENCRYPTION_KEY`
- [ ] [AI] `npm run db:migrate` and `npm run db:seed` both exit 0
- [ ] [AI] Baseline test result recorded; all in-scope preexisting failures resolved

> **Pause Safety**: only the local toolchain was verified and the baseline recorded - no feature
> work exists yet. Safe to stop indefinitely. To resume: re-run `npm run test:quick` to confirm
> baseline still holds, then proceed to Phase 1.

---

## Toolchain Summary

| Tool                               | Min version | Purpose                                  |
| ---------------------------------- | ----------- | ---------------------------------------- |
| Node.js                            | 22          | TypeScript runtime, Next.js, pg-boss     |
| npm                                | 10+         | Package manager                          |
| Rust (rustup)                      | 1.95.0      | mandraguna-cli (Cargo workspace)         |
| Go                                 | latest      | ProjectDiscovery scanner binaries        |
| subfinder / httpx / naabu / nuclei | latest      | Active recon pipeline                    |
| PostgreSQL                         | 16          | Data store + pg-boss job queue           |
| Playwright Chromium                | via npm     | PDF rendering + e2e tests                |
| Docker + Compose                   | optional    | `make up` alternative to native Postgres |

---

## Principles Respected

- **Root Cause Orientation**: resolve preexisting failures at root cause, not by marking as ignored.
- **Reproducible Environments**: `npm ci` (not `npm install`) and pinned `rust-toolchain.toml`
  ensure identical dependency trees across machines.
- **Deliberate Problem-Solving**: understand the baseline before writing any new code.

## Related Documentation

- [Plan Execution Workflow](../../repo-governance/workflows/plan/plan-execution.md) - Phase 0 is
  the first phase of every plan
- [plan-maker Agent](./plan-maker.md) - delivery template includes Phase 0
- [Trunk Based Development](../../repo-governance/development/workflow/trunk-based-development.md)
- [README.md](../../README.md) - full installation instructions and stack overview
