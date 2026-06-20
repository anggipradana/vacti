-- Retest UX: per-finding retest timestamp, per-engagement last-retest-run timestamp, and a separate
-- retest version history for the retest report's Document Control.
ALTER TABLE "pentest_findings" ADD COLUMN IF NOT EXISTS "retest_at" timestamptz;
ALTER TABLE "pentest_engagements" ADD COLUMN IF NOT EXISTS "last_retest_at" timestamptz;
ALTER TABLE "report_settings" ADD COLUMN IF NOT EXISTS "retest_version_history" jsonb;
