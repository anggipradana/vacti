ALTER TABLE "discovered_urls" ADD COLUMN "first_scan_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovered_urls" ADD CONSTRAINT "discovered_urls_first_scan_id_scans_id_fk" FOREIGN KEY ("first_scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
