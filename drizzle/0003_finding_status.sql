ALTER TABLE "vulnerabilities" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN "status_note" text;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leakcheck_data" ADD COLUMN "status" text DEFAULT 'new' NOT NULL;