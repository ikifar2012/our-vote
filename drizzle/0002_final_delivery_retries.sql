ALTER TABLE "elections" ADD COLUMN "last_delivery_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "final_delivery_retries" integer DEFAULT 0 NOT NULL;