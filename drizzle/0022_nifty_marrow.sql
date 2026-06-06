CREATE TABLE IF NOT EXISTS "discovered_urls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"target_id" uuid,
	"scan_id" uuid,
	"host" text,
	"url_text" text NOT NULL,
	"url_sha256" text NOT NULL,
	"sources" text[] DEFAULT '{}' NOT NULL,
	"pathname_extension" text,
	"category_slug" text,
	"external_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exposure_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"discovered_url_id" uuid,
	"scan_id" uuid,
	"source" text DEFAULT 'url' NOT NULL,
	"finding_type" text NOT NULL,
	"snippet" text,
	"url_text" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "extension_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"icon_key" text,
	CONSTRAINT "extension_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "extension_suffix_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"suffix" text NOT NULL,
	CONSTRAINT "extension_suffix_rules_suffix_unique" UNIQUE("suffix")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ip_resolution_sightings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_resolution_id" uuid NOT NULL,
	"scan_id" uuid,
	"hostname" text NOT NULL,
	"last_resolved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ip_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"ip_address" text NOT NULL,
	"latest_resolved_at" timestamp with time zone NOT NULL,
	"hostname_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "mode" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovered_urls" ADD CONSTRAINT "discovered_urls_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovered_urls" ADD CONSTRAINT "discovered_urls_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovered_urls" ADD CONSTRAINT "discovered_urls_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exposure_findings" ADD CONSTRAINT "exposure_findings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exposure_findings" ADD CONSTRAINT "exposure_findings_discovered_url_id_discovered_urls_id_fk" FOREIGN KEY ("discovered_url_id") REFERENCES "public"."discovered_urls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exposure_findings" ADD CONSTRAINT "exposure_findings_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extension_suffix_rules" ADD CONSTRAINT "extension_suffix_rules_category_id_extension_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."extension_categories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ip_resolution_sightings" ADD CONSTRAINT "ip_resolution_sightings_ip_resolution_id_ip_resolutions_id_fk" FOREIGN KEY ("ip_resolution_id") REFERENCES "public"."ip_resolutions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ip_resolution_sightings" ADD CONSTRAINT "ip_resolution_sightings_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ip_resolutions" ADD CONSTRAINT "ip_resolutions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discovered_urls_project_url_uniq" ON "discovered_urls" USING btree ("project_id","url_sha256");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discovered_urls_project_idx" ON "discovered_urls" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discovered_urls_category_idx" ON "discovered_urls" USING btree ("project_id","category_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exposure_findings_project_idx" ON "exposure_findings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exposure_findings_type_idx" ON "exposure_findings" USING btree ("project_id","finding_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "exposure_findings_uniq" ON "exposure_findings" USING btree ("project_id","url_text","finding_type","snippet");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ip_sightings_resolution_host_uniq" ON "ip_resolution_sightings" USING btree ("ip_resolution_id","hostname");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ip_sightings_resolution_idx" ON "ip_resolution_sightings" USING btree ("ip_resolution_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ip_resolutions_project_ip_uniq" ON "ip_resolutions" USING btree ("project_id","ip_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ip_resolutions_project_idx" ON "ip_resolutions" USING btree ("project_id");