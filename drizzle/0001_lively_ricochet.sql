ALTER TABLE "candidate_profiles" ADD COLUMN "headline" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "experience_years" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "experience_summary" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "preferred_titles" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "negative_signals" jsonb DEFAULT '[]'::jsonb NOT NULL;