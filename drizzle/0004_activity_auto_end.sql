ALTER TABLE "elections" ADD COLUMN "fully_reported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "activity_ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "last_activity_end_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "activity_end_attempts" integer DEFAULT 0 NOT NULL;