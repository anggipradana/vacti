ALTER TABLE "ai_defaults" ADD COLUMN "api_key_ciphertext" text;--> statement-breakpoint
ALTER TABLE "ai_defaults" ADD COLUMN "last_check_status" text;--> statement-breakpoint
ALTER TABLE "ai_defaults" ADD COLUMN "last_checked_at" timestamp with time zone;