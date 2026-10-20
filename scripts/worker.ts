import { loadEnvConfig } from "@next/env";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { elections } from "../db/schema";
import { CITIES, ELECTIONS, isCity, POLLS_CLOSE } from "../lib/elections";
import { fetchResults } from "../lib/feeds";
import {
  assertNotOlder,
  failureState,
  nextFetchAt,
  resultsAreStale,
} from "../lib/collection";
import {
  activityEnabled,
  activityRequest,
  activityState,
  extractEmbed,
  pushIntervalSeconds,
  stateHash,
} from "../lib/activity";
import type { City } from "../lib/types";

loadEnvConfig(process.cwd());
const db = getDb();
if (!db) throw new Error("Set DATABASE_URL before starting the worker.");
const requestedCity = process.argv.includes("--city")
  ? process.argv[process.argv.indexOf("--city") + 1]
  : null;
if (requestedCity !== null && !isCity(requestedCity))
  throw new Error("Use --city toronto or --city richmond-hill");
const cities: readonly City[] = requestedCity
  ? [requestedCity as City]
  : CITIES;

async function tick(city: City): Promise<boolean> {
  const election = ELECTIONS[city];
  return db!.transaction(async (tx) => {
    const locks = await tx.execute(
      sql`select pg_try_advisory_xact_lock(${election.lockId}::bigint) as locked`,
    );
    if (!locks[0]?.locked) return true;
    await tx
      .insert(elections)
      .values({ id: election.id })
      .onConflictDoNothing();
    const [previous] = await tx
      .select()
      .from(elections)
      .where(eq(elections.id, election.id));
    if (previous.collectionPaused) {
      if (process.argv.includes("--once"))
        console.error(
          `${election.name}: collection is paused; review last_error before resuming.`,
        );
      return false;
    }
    if (previous.nextFetchAt && Date.now() < previous.nextFetchAt.getTime())
      return true;
    let results = previous.results;
    try {
      const feed = await fetchResults(city, {
        etag: previous.etag,
        lastModified: previous.lastModified,
      });
      if (feed.results) {
        assertNotOlder(city, feed.results, previous.results);
        results = feed.results;
      }
      if (!results) throw new Error("No initial results snapshot was returned");
      await tx
        .update(elections)
        .set({
          results,
          checkedAt: new Date(),
          etag: feed.etag,
          lastModified: feed.lastModified,
          nextFetchAt: nextFetchAt(city, feed.cacheSeconds),
          failureCount: 0,
          lastError: null,
        })
        .where(eq(elections.id, election.id));
      console.log(
        `${new Date().toISOString()} ${election.name}: ${results.totalVotes} votes, ${results.pollsReceived}/${results.polls} ${election.reportingUnit}`,
      );
    } catch (error) {
      const failure = failureState(city, previous.failureCount, error);
      await tx
        .update(elections)
        .set(failure)
        .where(eq(elections.id, election.id));
      console.error(
        `${election.name}: ${failure.lastError}; ${failure.collectionPaused ? "collection paused" : `next attempt after ${failure.nextFetchAt.toISOString()}`}`,
      );
      return false;
    }
    // Fresh downloads of old published results must not trigger stale phone updates.
    if (
      !activityEnabled() ||
      Date.now() < POLLS_CLOSE ||
      !results.totalVotes ||
      resultsAreStale(city, results, new Date())
    )
      return true;
    const state = activityState(results, city);
    const hash = stateHash(state);
    if (hash === previous.publishedHash) return true;
    if (
      previous.publishedAt &&
      Date.now() - previous.publishedAt.getTime() < pushIntervalSeconds() * 1000
    )
      return true;
    try {
      if (!previous.activityId) {
        const started = await activityRequest("start", {
          widgetContainerId: election.container,
          group: election.group,
          reuse: true,
          brand: {
            title: `${election.name} mayoral election`,
            name: "Our Vote",
            description: `Unofficial ${election.name} mayoral results`,
          },
          state,
        });
        if (typeof started.activityId !== "string")
          throw new Error("Missing activity id");
        await tx
          .update(elections)
          .set({
            activityId: started.activityId,
            embedUrl: extractEmbed(started),
            publishedHash: hash,
            publishedAt: new Date(),
          })
          .where(eq(elections.id, election.id));
      } else {
        await activityRequest("update", {
          widgetContainerId: election.container,
          group: election.group,
          priority: 5,
          state,
        });
        await activityRequest("update", {
          widgetContainerId: election.container,
          activityId: previous.activityId,
          priority: 5,
          state,
        });
        await tx
          .update(elections)
          .set({ publishedHash: hash, publishedAt: new Date() })
          .where(eq(elections.id, election.id));
      }
    } catch (error) {
      console.error(
        `${election.name}: activity delivery failed; latest results are saved.`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return false;
    }
    return true;
  });
}

let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function main() {
  do {
    const started = Date.now();
    let succeeded = true;
    for (const city of cities) {
      if (stopping) break;
      try {
        if (!(await tick(city))) succeeded = false;
      } catch (error) {
        succeeded = false;
        console.error(
          `${ELECTIONS[city].name}:`,
          error instanceof Error ? error.message : "Worker cycle failed",
        );
      }
    }
    if (process.argv.includes("--once")) process.exit(succeeded ? 0 : 1);
    // Cheap scheduler checks every ten seconds; persisted next_fetch_at controls actual HTTP requests.
    while (!stopping && Date.now() - started < 10_000)
      await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (!stopping);
  process.exit(0);
}
void main();
