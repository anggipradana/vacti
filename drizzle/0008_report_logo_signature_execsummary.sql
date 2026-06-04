ALTER TABLE "report_settings" ADD COLUMN "company_logo" text;--> statement-breakpoint
ALTER TABLE "report_settings" ADD COLUMN "show_executive_summary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "report_settings" ADD COLUMN "executive_summary" text;--> statement-breakpoint
ALTER TABLE "report_settings" ADD COLUMN "executive_summary_id" text;--> statement-breakpoint
ALTER TABLE "report_signatories" ADD COLUMN "signature_image" text;