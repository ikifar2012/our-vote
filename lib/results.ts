import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { elections } from "../db/schema";
import { ELECTIONS } from "./elections";
import {
  assertNotOlder,
  collectionIsComplete,
  failureState,
  nextFetchAt,
  resultsAreStale,
} from "./collection";
import { fetchResults } from "./feeds";
import type { City, PublicResults, Results } from "./types";

type PreviewCache = {
  results: Results | null;
  checkedAt: Date | null;
  dueAt: Date;
  failures: number;
  paused: boolean;
  etag: string | null;
  lastModified: string | null;
  pending: Promise<void> | null;
};
const previews = new Map<City, PreviewCache>();

export async function readElection(city: City = "toronto") {
  const db = getDb();
  if (!db) return null;
  return (
    (
      await db
        .select()
        .from(elections)
        .where(eq(elections.id, ELECTIONS[city].id))
        .limit(1)
    )[0] ?? null
  );
}

export async function getPublicResults(
  city: City = "toronto",
): Promise<PublicResults> {
  if (getDb()) {
    const row = await readElection(city);
    return {
      results: row?.results ?? null,
      checkedAt: row?.checkedAt?.toISOString() ?? null,
      stale:
        (!collectionIsComplete(row?.results ?? null) &&
          Boolean(row?.collectionPaused || row?.failureCount)) ||
        resultsAreStale(city, row?.results ?? null, row?.checkedAt ?? null),
    };
  }
  // Production page views never hit upstream, even if the database was omitted.
  if (process.env.NODE_ENV === "production")
    return { results: null, checkedAt: null, stale: true };
  // A single-process development preview uses the same cadence/backoff as the worker.
  let cached = previews.get(city);
  if (!cached) {
    cached = {
      results: null,
      checkedAt: null,
      dueAt: new Date(0),
      failures: 0,
      paused: false,
      etag: null,
      lastModified: null,
      pending: null,
    };
    previews.set(city, cached);
  }
  const preview = cached;
  if (
    !collectionIsComplete(preview.results) &&
    !preview.paused &&
    Date.now() >= preview.dueAt.getTime() &&
    !preview.pending
  ) {
    preview.pending = (async () => {
      try {
        const feed = await fetchResults(city, {
          etag: preview.etag,
          lastModified: preview.lastModified,
        });
        if (feed.results) {
          assertNotOlder(city, feed.results, preview.results);
          preview.results = feed.results;
        }
        if (!preview.results)
          throw new Error("Results source returned no initial snapshot");
        preview.checkedAt = new Date();
        preview.etag = feed.etag;
        preview.lastModified = feed.lastModified;
        preview.failures = 0;
        preview.dueAt = nextFetchAt(city, feed.cacheSeconds);
      } catch (error) {
        const failure = failureState(city, preview.failures, error);
        preview.failures = failure.failureCount;
        preview.paused = failure.collectionPaused;
        preview.dueAt = failure.nextFetchAt;
      }
    })().finally(() => {
      preview.pending = null;
    });
  }
  await preview.pending;
  return {
    results: preview.results,
    checkedAt: preview.checkedAt?.toISOString() ?? null,
    stale:
      (!collectionIsComplete(preview.results) &&
        (preview.paused || preview.failures > 0)) ||
      resultsAreStale(city, preview.results, preview.checkedAt),
  };
}
