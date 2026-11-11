ALTER TABLE "experiments" ADD COLUMN "change_summary" text;--> statement-breakpoint
CREATE TABLE "reality_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"experiment_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"kind" text NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reality_imports" ADD CONSTRAINT "reality_imports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reality_imports" ADD CONSTRAINT "reality_imports_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reality_imports_experiment_idx" ON "reality_imports" USING btree ("experiment_id","created_at");
