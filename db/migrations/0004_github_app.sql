CREATE TYPE "public"."github_run_status" AS ENUM('queued', 'briefing', 'simulating', 'analyzing', 'complete', 'failed', 'skipped', 'cancelled');--> statement-breakpoint
CREATE TABLE "github_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" text NOT NULL,
	"event" text NOT NULL,
	"action" text,
	"subject" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" bigint NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"account_id" bigint,
	"owner_id" uuid,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_repos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"repository_id" bigint NOT NULL,
	"full_name" text NOT NULL,
	"default_branch" text,
	"audience_id" uuid,
	"idea_id" uuid,
	"comment_enabled" boolean DEFAULT true NOT NULL,
	"check_enabled" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_pr_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"pr_number" integer NOT NULL,
	"pr_title" text NOT NULL,
	"pr_url" text NOT NULL,
	"head_sha" text,
	"author_login" text,
	"status" "github_run_status" DEFAULT 'queued' NOT NULL,
	"status_detail" text,
	"brief" jsonb,
	"experiment_id" uuid,
	"narrative" jsonb,
	"comment_body" text,
	"comment_id" bigint,
	"check_run_id" bigint,
	"files_changed" integer DEFAULT 0 NOT NULL,
	"additions" integer DEFAULT 0 NOT NULL,
	"deletions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_pr_runs" ADD CONSTRAINT "github_pr_runs_repo_id_github_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."github_repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_pr_runs" ADD CONSTRAINT "github_pr_runs_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repos" ADD CONSTRAINT "github_repos_installation_id_github_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repos" ADD CONSTRAINT "github_repos_audience_id_audiences_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."audiences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repos" ADD CONSTRAINT "github_repos_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_deliveries_delivery_idx" ON "github_deliveries" USING btree ("delivery_id");--> statement-breakpoint
CREATE UNIQUE INDEX "github_installations_installation_idx" ON "github_installations" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "github_installations_owner_idx" ON "github_installations" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "github_pr_runs_repo_pr_idx" ON "github_pr_runs" USING btree ("repo_id","pr_number");--> statement-breakpoint
CREATE INDEX "github_pr_runs_repo_idx" ON "github_pr_runs" USING btree ("repo_id","created_at");--> statement-breakpoint
CREATE INDEX "github_pr_runs_status_idx" ON "github_pr_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "github_repos_repository_idx" ON "github_repos" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "github_repos_installation_idx" ON "github_repos" USING btree ("installation_id");
