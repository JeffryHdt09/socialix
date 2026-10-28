CREATE TABLE "chat_rate_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_rate_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_rate_events" ADD CONSTRAINT "chat_rate_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_rate_events_user_created_idx" ON "chat_rate_events" USING btree ("user_id","created_at");