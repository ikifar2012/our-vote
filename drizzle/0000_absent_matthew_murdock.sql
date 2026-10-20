CREATE TABLE "elections" (
	"id" text PRIMARY KEY NOT NULL,
	"results" jsonb,
	"checked_at" timestamp with time zone,
	"etag" text,
	"last_modified" text,
	"activity_id" text,
	"embed_url" text,
	"published_hash" text,
	"published_at" timestamp with time zone
);
