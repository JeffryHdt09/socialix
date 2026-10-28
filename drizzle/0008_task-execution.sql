ALTER TABLE "agent_tasks" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "next_run_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "repeat_every_minutes" integer;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "repeat_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "run_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "agent_tasks_status_next_run_idx" ON "agent_tasks" USING btree ("status","next_run_at");--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_attempts_nonnegative" CHECK ("agent_tasks"."attempts" >= 0 and "agent_tasks"."run_count" >= 0);--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_repeat_positive" CHECK ("agent_tasks"."repeat_every_minutes" is null or "agent_tasks"."repeat_every_minutes" >= 1);