CREATE TABLE "ai_profile_drafts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"feature" varchar(48) NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micro_usd" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_facts" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"facts" jsonb NOT NULL,
	"facts_version" integer DEFAULT 1 NOT NULL,
	"model" text NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN "profile_hash" text;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "rubric" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_beta" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_profile_drafts" ADD CONSTRAINT "ai_profile_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_facts" ADD CONSTRAINT "job_facts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_user_created_idx" ON "ai_usage" USING btree ("user_id","created_at");