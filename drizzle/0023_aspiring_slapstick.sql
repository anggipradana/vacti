ALTER TABLE "scans" ADD COLUMN "deep_scan" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "discovered_urls" ADD COLUMN "deep_scan_state" text DEFAULT 'skipped' NOT NULL;--> statement-breakpoint
ALTER TABLE "discovered_urls" ADD COLUMN "fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discovered_urls" ADD COLUMN "http_status" integer;--> statement-breakpoint
ALTER TABLE "discovered_urls" ADD COLUMN "content_length" integer;