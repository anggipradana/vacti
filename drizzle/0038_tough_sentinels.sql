CREATE TABLE IF NOT EXISTS "pentest_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"role" text NOT NULL,
	"label" text NOT NULL,
	"auth_mode" text DEFAULT 'auto_login' NOT NULL,
	"login_url" text,
	"secret_ref" text,
	"storage_state_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pentest_agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"agent" text NOT NULL,
	"role" text DEFAULT 'producer' NOT NULL,
	"phase" text,
	"status" text DEFAULT 'running' NOT NULL,
	"note" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pentest_engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'web' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"scope_in" text[] DEFAULT '{}' NOT NULL,
	"scope_out" text[] DEFAULT '{}' NOT NULL,
	"app_context" jsonb,
	"source_scan_id" uuid,
	"window_ends_at" timestamp with time zone,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"claimed_by_engine" text,
	"claimed_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pentest_engines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engine_id" text NOT NULL,
	"capabilities" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"phase" text,
	"note" text,
	"current_engagement_id" uuid,
	"last_heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pentest_engines_engine_id_unique" UNIQUE("engine_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pentest_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"engagement_id" uuid NOT NULL,
	"evidence_key" text NOT NULL,
	"kind" text NOT NULL,
	"sha256" text NOT NULL,
	"correlation_key" text,
	"frame_role" text,
	"account_id" uuid,
	"caption_en" text,
	"caption_id" text,
	"storage_ref" text NOT NULL,
	"encrypted" boolean DEFAULT true NOT NULL,
	"captured_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pentest_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"finding_class" text NOT NULL,
	"title" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"cvss_vector" text,
	"status" text DEFAULT 'candidate' NOT NULL,
	"description_en" text,
	"description_id" text,
	"business_impact_en" text,
	"business_impact_id" text,
	"repro_steps_en" text,
	"repro_steps_id" text,
	"remediation_en" text,
	"remediation_id" text,
	"affected_url" text,
	"affected_host" text,
	"affected_parameter" text,
	"affected_method" text,
	"produced_by_skill" text,
	"produced_by_rubric_version" text,
	"verified_by" text,
	"verifier_verdict" text,
	"verifier_reasons" jsonb,
	"redo_count" integer DEFAULT 0 NOT NULL,
	"verification_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pentest_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"vertical" text DEFAULT 'web' NOT NULL,
	"finding_class" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"rubric_version" text,
	"verifier_rubric_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pentest_skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pentest_verdicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"finding_id" uuid NOT NULL,
	"verifier" text NOT NULL,
	"rubric_version" text,
	"verdict" text NOT NULL,
	"reasons" jsonb,
	"reproduction" jsonb,
	"verification_run_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_accounts" ADD CONSTRAINT "pentest_accounts_engagement_id_pentest_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."pentest_engagements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_agent_runs" ADD CONSTRAINT "pentest_agent_runs_engagement_id_pentest_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."pentest_engagements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_engagements" ADD CONSTRAINT "pentest_engagements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_engagements" ADD CONSTRAINT "pentest_engagements_source_scan_id_scans_id_fk" FOREIGN KEY ("source_scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_engagements" ADD CONSTRAINT "pentest_engagements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_evidence" ADD CONSTRAINT "pentest_evidence_finding_id_pentest_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."pentest_findings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_evidence" ADD CONSTRAINT "pentest_evidence_engagement_id_pentest_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."pentest_engagements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_evidence" ADD CONSTRAINT "pentest_evidence_account_id_pentest_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."pentest_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_findings" ADD CONSTRAINT "pentest_findings_engagement_id_pentest_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."pentest_engagements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_verdicts" ADD CONSTRAINT "pentest_verdicts_engagement_id_pentest_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."pentest_engagements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_verdicts" ADD CONSTRAINT "pentest_verdicts_finding_id_pentest_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."pentest_findings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pentest_accounts_engagement_idx" ON "pentest_accounts" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pentest_agent_runs_engagement_idx" ON "pentest_agent_runs" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pentest_engagements_project_idx" ON "pentest_engagements" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pentest_engagements_status_idx" ON "pentest_engagements" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pentest_evidence_finding_idx" ON "pentest_evidence" USING btree ("finding_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pentest_evidence_finding_key_uk" ON "pentest_evidence" USING btree ("finding_id","evidence_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pentest_findings_engagement_idx" ON "pentest_findings" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pentest_findings_status_idx" ON "pentest_findings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pentest_findings_engagement_fingerprint_uk" ON "pentest_findings" USING btree ("engagement_id","fingerprint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pentest_verdicts_finding_idx" ON "pentest_verdicts" USING btree ("finding_id");