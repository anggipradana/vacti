ALTER TABLE "api_keys" ADD COLUMN "usage_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "usage_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "disabled_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "last_used_at" timestamp with time zone;