CREATE TYPE "public"."audience_status" AS ENUM('draft', 'generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('local', 'supabase');--> statement-breakpoint
CREATE TYPE "public"."idea_status" AS ENUM('draft', 'analyzing', 'analyzed', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."insight_kind" AS ENUM('headline', 'objection_cluster', 'feature_cluster', 'pricing', 'messaging', 'recommendation', 'validation');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('analyze_idea', 'generate_personas', 'simulate', 'analyze_results');--> statement-breakpoint
CREATE TYPE "public"."price_reaction" AS ENUM('too_cheap', 'fair', 'expensive', 'unaffordable');--> statement-breakpoint
CREATE TYPE "public"."purchase_intent" AS ENUM('none', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('draft', 'queued', 'generating', 'simulating', 'analyzing', 'complete', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "audiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"definition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"size" integer DEFAULT 100 NOT NULL,
	"seed" integer NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"status" "audience_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"label" text NOT NULL,
	"is_control" boolean DEFAULT false NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid,
	"idea_id" uuid,
	"audience_id" uuid,
	"name" text NOT NULL,
	"status" "run_status" DEFAULT 'draft' NOT NULL,
	"seed" integer NOT NULL,
	"estimated_cost_cents" integer,
	"actual_cost_cents" integer DEFAULT 0 NOT NULL,
	"cost_cap_cents" integer,
	"parent_experiment_id" uuid,
	"archived_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text,
	"description" text,
	"url" text,
	"url_extract" text,
	"pricing" jsonb,
	"ad_copy" text,
	"ad_image_url" text,
	"analysis" jsonb,
	"status" "idea_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"variant_id" uuid,
	"kind" "insight_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" "job_type" NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"experiment_id" uuid,
	"audience_id" uuid,
	"idea_id" uuid,
	"total_units" integer DEFAULT 0 NOT NULL,
	"completed_units" integer DEFAULT 0 NOT NULL,
	"failed_units" integer DEFAULT 0 NOT NULL,
	"checkpoint" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cancel_requested_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audience_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"segment_key" text NOT NULL,
	"name" text NOT NULL,
	"age" integer NOT NULL,
	"gender" text,
	"location" text,
	"profession" text,
	"income_band" text,
	"tech_comfort" integer,
	"profile" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"persona_id" uuid NOT NULL,
	"interest_score" integer NOT NULL,
	"purchase_intent" "purchase_intent" NOT NULL,
	"price_reaction" "price_reaction",
	"willingness_to_pay" real,
	"would_recommend" boolean NOT NULL,
	"is_extrapolated" boolean DEFAULT false NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"auth_provider" "auth_provider" NOT NULL,
	"external_auth_id" text,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_variants" ADD CONSTRAINT "experiment_variants_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_audience_id_audiences_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."audiences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_variant_id_experiment_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."experiment_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_audience_id_audiences_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."audiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_audience_id_audiences_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."audiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_variant_id_experiment_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."experiment_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audiences_owner_idx" ON "audiences" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "audiences_template_idx" ON "audiences" USING btree ("owner_id","is_template");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_experiment_label_idx" ON "experiment_variants" USING btree ("experiment_id","label");--> statement-breakpoint
CREATE INDEX "experiments_owner_idx" ON "experiments" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "experiments_project_idx" ON "experiments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "experiments_status_idx" ON "experiments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ideas_owner_idx" ON "ideas" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "ideas_project_idx" ON "ideas" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "insights_experiment_kind_idx" ON "insights" USING btree ("experiment_id","kind");--> statement-breakpoint
CREATE INDEX "jobs_owner_idx" ON "jobs" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_experiment_idx" ON "jobs" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "jobs_audience_idx" ON "jobs" USING btree ("audience_id");--> statement-breakpoint
CREATE UNIQUE INDEX "personas_audience_ordinal_idx" ON "personas" USING btree ("audience_id","ordinal");--> statement-breakpoint
CREATE INDEX "personas_audience_segment_idx" ON "personas" USING btree ("audience_id","segment_key");--> statement-breakpoint
CREATE INDEX "projects_owner_idx" ON "projects" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_variant_persona_idx" ON "reactions" USING btree ("variant_id","persona_id");--> statement-breakpoint
CREATE INDEX "reactions_experiment_idx" ON "reactions" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "reactions_persona_idx" ON "reactions" USING btree ("persona_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_external_auth_id_idx" ON "users" USING btree ("external_auth_id");