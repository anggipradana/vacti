CREATE TABLE IF NOT EXISTS "pentest_help_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"kind" text DEFAULT 'decision' NOT NULL,
	"question" text NOT NULL,
	"status" text DEFAULT 'awaiting' NOT NULL,
	"response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pentest_help_requests_engagement_idx" ON "pentest_help_requests" USING btree ("engagement_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pentest_help_requests" ADD CONSTRAINT "pentest_help_requests_engagement_id_pentest_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."pentest_engagements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
