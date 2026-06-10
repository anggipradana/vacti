ALTER TABLE "manual_indicators" ADD COLUMN "vt_malicious" integer;--> statement-breakpoint
ALTER TABLE "manual_indicators" ADD COLUMN "vt_suspicious" integer;--> statement-breakpoint
ALTER TABLE "manual_indicators" ADD COLUMN "vt_harmless" integer;--> statement-breakpoint
ALTER TABLE "manual_indicators" ADD COLUMN "vt_total" integer;--> statement-breakpoint
ALTER TABLE "manual_indicators" ADD COLUMN "otx_pulses" integer;--> statement-breakpoint
ALTER TABLE "manual_indicators" ADD COLUMN "verdict" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "manual_indicators" ADD COLUMN "last_checked_at" timestamp with time zone;