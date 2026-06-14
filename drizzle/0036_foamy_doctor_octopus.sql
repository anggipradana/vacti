ALTER TABLE "brand_news" ADD COLUMN "ai_sentiment" text;--> statement-breakpoint
ALTER TABLE "brand_news" ADD COLUMN "ai_sentiment_reason" text;--> statement-breakpoint
ALTER TABLE "brand_news" ADD COLUMN "sentiment_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "brand_news" ADD COLUMN "sentiment_feedback" text;