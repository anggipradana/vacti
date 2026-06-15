# Layer 0 - Vision

## Why vacti exists

Traditional recon suites are powerful but **heavy**: dozens of overlapping scanning tools and a
Django + Celery + Redis + Ollama + Nginx stack with Python-only reports. vacti keeps only what
matters - a focused VA pipeline and a full Threat Intelligence module - and builds it from the ground
up, **lightweight, modern, and reliable**.

**North star:** a self-hosted platform where a user goes from _add target_ → _run scan_ → _view
results_ → _bilingual PDF report_ in under 10 minutes, on three services (app + worker + Postgres),
with first-class API and integrations.

**We optimize for:** reliability (no stuck scans), developer velocity (end-to-end type safety),
lightness (small footprint), and great UX/report design.
