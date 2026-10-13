ALTER TABLE "ai_analyses" ADD COLUMN IF NOT EXISTS "talking_points" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN IF NOT EXISTS "prompt_version" text;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN IF NOT EXISTS "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN IF NOT EXISTS "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN IF NOT EXISTS "cache_read_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN IF NOT EXISTS "cache_write_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN IF NOT EXISTS "cost_usd_micros" integer;
