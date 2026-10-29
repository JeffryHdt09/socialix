CREATE TYPE "public"."document_status" AS ENUM('to_review', 'validated', 'rejected');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"status" "document_status" DEFAULT 'to_review' NOT NULL,
	"author" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_title_length" CHECK (char_length(btrim("documents"."title")) between 1 and 120),
	CONSTRAINT "documents_content_length" CHECK (char_length(btrim("documents"."content")) between 1 and 20000),
	CONSTRAINT "documents_kind_length" CHECK (char_length(btrim("documents"."kind")) between 1 and 40),
	CONSTRAINT "documents_author_length" CHECK (char_length(btrim("documents"."author")) between 1 and 40)
);
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_task_id_agent_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_project_kind_idx" ON "documents" USING btree ("project_id","kind","created_at");