CREATE TABLE IF NOT EXISTS "pentest_engine_shell_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engine_id" text NOT NULL,
	"kind" text DEFAULT 'shell' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opened_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"transcript" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_engine_shell_sessions" ADD CONSTRAINT "pentest_engine_shell_sessions_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
