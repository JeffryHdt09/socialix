CREATE TYPE "public"."delivery_status" AS ENUM('scheduled', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "post_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"status" "delivery_status" DEFAULT 'scheduled' NOT NULL,
	"due_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"link" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_deliveries_external_length" CHECK (char_length(btrim("post_deliveries"."external_id")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "post_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"provider" text DEFAULT 'buffer' NOT NULL,
	"channel_id" text NOT NULL,
	"platform" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_accounts_platform_length" CHECK (char_length(btrim("social_accounts"."platform")) between 1 and 20),
	CONSTRAINT "social_accounts_channel_length" CHECK (char_length(btrim("social_accounts"."channel_id")) between 1 and 200),
	CONSTRAINT "social_accounts_name_length" CHECK (char_length(btrim("social_accounts"."name")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "social_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "post_deliveries" ADD CONSTRAINT "post_deliveries_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_deliveries" ADD CONSTRAINT "post_deliveries_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "post_deliveries_post_account_idx" ON "post_deliveries" USING btree ("post_id","social_account_id");--> statement-breakpoint
CREATE INDEX "post_deliveries_account_idx" ON "post_deliveries" USING btree ("social_account_id");--> statement-breakpoint
CREATE INDEX "post_deliveries_status_due_idx" ON "post_deliveries" USING btree ("status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_project_platform_idx" ON "social_accounts" USING btree ("project_id","platform");