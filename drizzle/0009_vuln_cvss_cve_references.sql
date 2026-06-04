ALTER TABLE "vulnerabilities" ADD COLUMN "cvss" double precision;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN "cve_ids" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN "references" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN "remediation" text;