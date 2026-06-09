CREATE TABLE IF NOT EXISTS "ai_defaults" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"provider" text DEFAULT 'anthropic' NOT NULL,
	"model" text DEFAULT 'claude-sonnet-4-6' NOT NULL,
	"base_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
