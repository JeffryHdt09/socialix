CREATE TYPE "public"."post_author" AS ENUM('user', 'agent');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'to_review', 'scheduled', 'published', 'failed');--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"title" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"hashtags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"platforms" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"image_url" text,
	"scheduled_at" timestamp with time zone,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"external_id" text,
	"created_by" "post_author" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_title_length" CHECK (char_length(btrim("posts"."title")) between 1 and 120),
	CONSTRAINT "posts_dated_when_scheduled" CHECK ("posts"."status" not in ('scheduled', 'published') or "posts"."scheduled_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_campaign_status_idx" ON "posts" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "posts_campaign_scheduled_idx" ON "posts" USING btree ("campaign_id","scheduled_at");