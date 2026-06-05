CREATE TABLE IF NOT EXISTS "threat_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector" text NOT NULL,
	"title" text NOT NULL,
	"link" text NOT NULL,
	"source" text NOT NULL,
	"summary" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "sector" text DEFAULT 'banking' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "threat_news_sector_link_uniq" ON "threat_news" USING btree ("sector","link");