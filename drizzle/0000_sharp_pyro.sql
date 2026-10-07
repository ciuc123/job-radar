CREATE TYPE "public"."application_status" AS ENUM('NEW', 'SAVED', 'REVIEW', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."recommendation" AS ENUM('APPLY', 'REVIEW', 'MAYBE', 'REJECT');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "ai_analyses" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"score" integer NOT NULL,
	"recommendation" "recommendation" NOT NULL,
	"summary" text NOT NULL,
	"matches" jsonb NOT NULL,
	"gaps" jsonb NOT NULL,
	"concerns" jsonb NOT NULL,
	"estimated_fit" varchar(32) NOT NULL,
	"model" text,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'NEW' NOT NULL,
	"applied_at" timestamp with time zone,
	"interview_dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"cv_version" text,
	"cover_letter" text,
	"salary_expectation" integer,
	"contact_name" text,
	"contact_email" text,
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"strong_skills" jsonb NOT NULL,
	"secondary_skills" jsonb NOT NULL,
	"preferred_locations" jsonb NOT NULL,
	"excluded_locations" jsonb NOT NULL,
	"preferred_employment_types" jsonb NOT NULL,
	"salary_minimum" integer,
	"thresholds" jsonb NOT NULL,
	"score_weights" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"description" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timezone_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"employment_type" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contract_type" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"salary_min" real,
	"salary_max" real,
	"salary_currency" varchar(8),
	"salary_period" varchar(32),
	"technologies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seniority" varchar(64) DEFAULT 'Unknown' NOT NULL,
	"posted_at" timestamp with time zone,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"remote_type" varchar(64) DEFAULT 'Unknown' NOT NULL,
	"raw_data" jsonb NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"score_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recommendation" "recommendation" DEFAULT 'REJECT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"daily_digest_enabled" boolean DEFAULT false NOT NULL,
	"immediate_enabled" boolean DEFAULT false NOT NULL,
	"immediate_threshold" integer DEFAULT 92 NOT NULL,
	"last_digest_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_health" (
	"source" varchar(80) PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"status" varchar(24) DEFAULT 'idle' NOT NULL,
	"last_started_at" timestamp with time zone,
	"last_completed_at" timestamp with time zone,
	"discovered" integer DEFAULT 0 NOT NULL,
	"added" integer DEFAULT 0 NOT NULL,
	"duplicates" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "source_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"source" varchar(80) NOT NULL,
	"source_job_id" text,
	"url" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"image" text,
	"email_verified" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_listings" ADD CONSTRAINT "source_listings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_user_unique" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_user_job_unique" ON "applications" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_canonical_url_unique" ON "jobs" USING btree ("canonical_url");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_content_hash_unique" ON "jobs" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "source_listing_source_id_unique" ON "source_listings" USING btree ("source","source_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_listing_url_unique" ON "source_listings" USING btree ("source","url");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_tokens_identity_unique" ON "verification_tokens" USING btree ("identifier","token");