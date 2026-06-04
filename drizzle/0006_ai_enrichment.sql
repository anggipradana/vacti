ALTER TABLE "vulnerabilities" ADD COLUMN "ai_description" text;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN "ai_impact" text;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN "ai_remediation" text;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN "is_ai_enriched" boolean DEFAULT false NOT NULL;