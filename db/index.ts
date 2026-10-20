import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
let database: ReturnType<typeof drizzle> | undefined;
export function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!database)
    database = drizzle(
      postgres(process.env.DATABASE_URL, { max: 5, connect_timeout: 5 }),
    );
  return database;
}
