CREATE TABLE IF NOT EXISTS "brand_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"link" text NOT NULL,
	"source" text NOT NULL,
	"summary" text,
	"published_at" timestamp with time zone,
	"security" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_news" ADD CONSTRAINT "brand_news_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "brand_news_project_link_uniq" ON "brand_news" USING btree ("project_id","link");