ALTER TABLE "agent_plans" ADD COLUMN "report" text;--> statement-breakpoint
ALTER TABLE "agent_plans" ADD COLUMN "review_round" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_plans" ADD COLUMN "review_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_plans" ADD COLUMN "review_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_plans" ADD CONSTRAINT "agent_plans_report_length" CHECK ("agent_plans"."report" is null or char_length(btrim("agent_plans"."report")) between 1 and 4000);--> statement-breakpoint
ALTER TABLE "agent_plans" ADD CONSTRAINT "agent_plans_review_nonnegative" CHECK ("agent_plans"."review_round" >= 0 and "agent_plans"."review_failures" >= 0);