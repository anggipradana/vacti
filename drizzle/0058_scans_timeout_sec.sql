-- Per-scan per-tool timeout (seconds). Wins over the profile/default in the worker so big
-- multi-domain scans can be given a longer budget (up to 10h = 36000s). Nullable: NULL falls
-- back to the profile timeout, then the in-code default.
ALTER TABLE "scans" ADD COLUMN IF NOT EXISTS "timeout_sec" integer;
