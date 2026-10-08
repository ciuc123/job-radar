ALTER TABLE "users" ADD COLUMN "clerk_user_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" varchar(24) DEFAULT 'member' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "owner_pro" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_plan" varchar(80) DEFAULT 'free' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" varchar(32) DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_synced_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_unique" ON "users" USING btree ("clerk_user_id");
--> statement-breakpoint
CREATE TABLE "user_job_scores" (
  "user_id" text NOT NULL,
  "job_id" uuid NOT NULL,
  "score" integer NOT NULL,
  "score_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "recommendation" "recommendation" NOT NULL,
  "immediate_sent_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_job_scores_user_id_job_id_pk" PRIMARY KEY("user_id", "job_id")
);
--> statement-breakpoint
ALTER TABLE "user_job_scores" ADD CONSTRAINT "user_job_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "user_job_scores" ADD CONSTRAINT "user_job_scores_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_job_scores_job_user_unique" ON "user_job_scores" USING btree ("job_id", "user_id");
--> statement-breakpoint
INSERT INTO "user_job_scores" ("user_id", "job_id", "score", "score_breakdown", "recommendation")
SELECT u."id", j."id", j."score", j."score_breakdown", j."recommendation" FROM "users" u CROSS JOIN "jobs" j;
--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN "user_id" text;
--> statement-breakpoint
UPDATE "ai_analyses" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;
--> statement-breakpoint
DELETE FROM "ai_analyses" WHERE "user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "ai_analyses" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_analyses" DROP CONSTRAINT "ai_analyses_pkey";
--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_user_id_job_id_pk" PRIMARY KEY("user_id", "job_id");
--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE TABLE "clerk_webhook_events" (
  "id" text PRIMARY KEY,
  "event_type" text NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
