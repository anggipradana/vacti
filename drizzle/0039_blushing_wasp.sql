CREATE TABLE IF NOT EXISTS "pentest_engine_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_type" text DEFAULT 'none' NOT NULL,
	"credential_ciphertext" text,
	"anthropic_base_url" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_engine_config" ADD CONSTRAINT "pentest_engine_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
