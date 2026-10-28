-- « Campagne » devient « projet » : même table, mêmes lignes, nouveaux noms (RENAME ne copie ni ne perd rien).
-- Puis les équipes (domaines) activées par projet. Les projets existants sont tous du marketing.
ALTER TABLE "campaigns" RENAME TO "projects";--> statement-breakpoint
ALTER TABLE "posts" RENAME COLUMN "campaign_id" TO "project_id";--> statement-breakpoint
ALTER TABLE "messages" RENAME COLUMN "campaign_id" TO "project_id";--> statement-breakpoint
ALTER TABLE "agent_plans" RENAME COLUMN "campaign_id" TO "project_id";--> statement-breakpoint
ALTER TABLE "projects" RENAME CONSTRAINT "campaigns_pkey" TO "projects_pkey";--> statement-breakpoint
ALTER TABLE "projects" RENAME CONSTRAINT "campaigns_user_id_user_id_fk" TO "projects_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "projects" RENAME CONSTRAINT "campaigns_name_length" TO "projects_name_length";--> statement-breakpoint
ALTER TABLE "posts" RENAME CONSTRAINT "posts_campaign_id_campaigns_id_fk" TO "posts_project_id_projects_id_fk";--> statement-breakpoint
ALTER TABLE "messages" RENAME CONSTRAINT "messages_campaign_id_campaigns_id_fk" TO "messages_project_id_projects_id_fk";--> statement-breakpoint
ALTER TABLE "agent_plans" RENAME CONSTRAINT "agent_plans_campaign_id_campaigns_id_fk" TO "agent_plans_project_id_projects_id_fk";--> statement-breakpoint
ALTER INDEX "campaigns_user_id_idx" RENAME TO "projects_user_id_idx";--> statement-breakpoint
ALTER INDEX "posts_campaign_status_idx" RENAME TO "posts_project_status_idx";--> statement-breakpoint
ALTER INDEX "posts_campaign_scheduled_idx" RENAME TO "posts_project_scheduled_idx";--> statement-breakpoint
ALTER INDEX "agent_plans_campaign_idx" RENAME TO "agent_plans_project_idx";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "teams" text[] DEFAULT ARRAY['marketing']::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_teams_not_empty" CHECK (cardinality("projects"."teams") >= 1);
