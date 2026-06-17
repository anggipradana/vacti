CREATE TABLE IF NOT EXISTS "pentest_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"auth_type" text NOT NULL,
	"credential_ciphertext" text,
	"anthropic_base_url" text,
	"anthropic_model" text,
	"anthropic_small_model" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pentest_engines" ADD COLUMN "credential_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_credentials" ADD CONSTRAINT "pentest_credentials_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
