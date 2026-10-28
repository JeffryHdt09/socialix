CREATE TYPE "public"."plan_status" AS ENUM('active', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'running', 'done', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "agent_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"from_agent" text NOT NULL,
	"to_agent" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_communications_message_length" CHECK (char_length(btrim("agent_communications"."message")) between 1 and 20000)
);
--> statement-breakpoint
ALTER TABLE "agent_communications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "agent_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"request" text NOT NULL,
	"summary" text NOT NULL,
	"plan" jsonb NOT NULL,
	"status" "plan_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_plans_request_length" CHECK (char_length(btrim("agent_plans"."request")) between 1 and 4000)
);
--> statement-breakpoint
ALTER TABLE "agent_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "agent_task_dependencies" (
	"task_id" uuid NOT NULL,
	"depends_on_task_id" uuid NOT NULL,
	CONSTRAINT "agent_task_dependencies_task_id_depends_on_task_id_pk" PRIMARY KEY("task_id","depends_on_task_id"),
	CONSTRAINT "agent_task_dependencies_not_self" CHECK ("agent_task_dependencies"."task_id" <> "agent_task_dependencies"."depends_on_task_id")
);
--> statement-breakpoint
ALTER TABLE "agent_task_dependencies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "agent_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"agent" text NOT NULL,
	"title" text NOT NULL,
	"instruction" text NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"output" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_tasks_position_positive" CHECK ("agent_tasks"."position" >= 1),
	CONSTRAINT "agent_tasks_agent_length" CHECK (char_length(btrim("agent_tasks"."agent")) between 1 and 40),
	CONSTRAINT "agent_tasks_title_length" CHECK (char_length(btrim("agent_tasks"."title")) between 1 and 120),
	CONSTRAINT "agent_tasks_instruction_length" CHECK (char_length(btrim("agent_tasks"."instruction")) between 1 and 4000)
);
--> statement-breakpoint
ALTER TABLE "agent_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_communications" ADD CONSTRAINT "agent_communications_task_id_agent_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_plans" ADD CONSTRAINT "agent_plans_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_dependencies" ADD CONSTRAINT "agent_task_dependencies_task_id_agent_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_dependencies" ADD CONSTRAINT "agent_task_dependencies_depends_on_task_id_agent_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_plan_id_agent_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."agent_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_communications_task_idx" ON "agent_communications" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_plans_campaign_idx" ON "agent_plans" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_task_dependencies_target_idx" ON "agent_task_dependencies" USING btree ("depends_on_task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_tasks_plan_position_idx" ON "agent_tasks" USING btree ("plan_id","position");--> statement-breakpoint
CREATE INDEX "agent_tasks_plan_status_idx" ON "agent_tasks" USING btree ("plan_id","status");