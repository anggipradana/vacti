ALTER TABLE "threat_intel_status" ADD COLUMN "leak_found" integer;--> statement-breakpoint
ALTER TABLE "threat_intel_status" ADD COLUMN "leak_truncated" boolean DEFAULT false NOT NULL;