import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { Results } from "../lib/types";
export const elections = pgTable("elections", {
  id: text("id").primaryKey(),
  results: jsonb("results").$type<Results>(),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  etag: text("etag"),
  lastModified: text("last_modified"),
  activityId: text("activity_id"),
  embedUrl: text("embed_url"),
  publishedHash: text("published_hash"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  lastDeliveryAttemptAt: timestamp("last_delivery_attempt_at", {
    withTimezone: true,
  }),
  lastDeliveryAttemptHash: text("last_delivery_attempt_hash"),
  // Retain the SQL name so existing retry counts survive this broader policy.
  deliveryRetries: integer("final_delivery_retries").notNull().default(0),
  fullyReportedAt: timestamp("fully_reported_at", { withTimezone: true }),
  activityEndedAt: timestamp("activity_ended_at", { withTimezone: true }),
  lastActivityEndAttemptAt: timestamp("last_activity_end_attempt_at", {
    withTimezone: true,
  }),
  activityEndAttempts: integer("activity_end_attempts").notNull().default(0),
  nextFetchAt: timestamp("next_fetch_at", { withTimezone: true }),
  failureCount: integer("failure_count").notNull().default(0),
  collectionPaused: boolean("collection_paused").notNull().default(false),
  lastError: text("last_error"),
});
