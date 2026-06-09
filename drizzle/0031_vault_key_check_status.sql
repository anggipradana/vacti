ALTER TABLE "api_keys" ADD COLUMN "last_check_status" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "last_checked_at" timestamp with time zone;