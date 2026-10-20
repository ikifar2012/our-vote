ALTER TABLE "elections" ADD COLUMN "next_fetch_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "failure_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "collection_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "last_error" text;