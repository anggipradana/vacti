# Getting Started (Tutorial)

> Status: placeholder — fleshed out during platform-foundation implementation.

You will learn to run vacti locally and complete your first scan.

1. Copy `.env.example` to `.env` and fill in `ENCRYPTION_KEY` and `SESSION_SECRET`.
2. `docker compose up --build` (starts app + worker + Postgres; migrations run automatically).
3. Open the app, create the first admin, create a Project.
4. Add a target and run a scan with the default profile.
5. View results and generate a bilingual PDF report.
