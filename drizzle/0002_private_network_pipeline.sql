CREATE TABLE "network_pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"status" varchar(48) DEFAULT 'FOLLOW_UP' NOT NULL,
	"cadence" varchar(32),
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "network_pipeline_user_name_unique" UNIQUE("user_id", "name")
);
--> statement-breakpoint
ALTER TABLE "network_pipelines" ADD CONSTRAINT "network_pipelines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
