import { ELECTIONS, POLLS_CLOSE, pollDelayMs } from "./elections";
import { SourceError } from "./source-http";
import type { City, Results } from "./types";

export function nextFetchAt(city: City, cacheSeconds = 0, now = Date.now()) {
  const delay = Math.max(pollDelayMs(city, now), cacheSeconds * 1000);
  return new Date(now + delay + Math.floor(Math.random() * 5000));
}

export function failureState(
  city: City,
  previousFailures: number,
  error: unknown,
  now = Date.now(),
) {
  const failureCount = previousFailures + 1;
  const backoff = Math.min(
    60 * 60_000,
    ELECTIONS[city].pollSeconds * 1000 * 2 ** Math.min(failureCount - 1, 6),
  );
  const sourceError = error instanceof SourceError ? error : null;
  const delay = Math.max(
    backoff,
    pollDelayMs(city, now),
    sourceError?.retryAfterMs || 0,
  );
  return {
    failureCount,
    collectionPaused: sourceError?.pause ?? false,
    nextFetchAt: new Date(now + delay + Math.floor(Math.random() * 5000)),
    lastError: sourceError?.message ?? "Results retrieval or validation failed",
  };
}

export function resultsAreStale(
  city: City,
  results: Results | null,
  checkedAt: Date | null,
) {
  const threshold =
    Date.now() < POLLS_CLOSE
      ? 6 * 60 * 60_000 + 60_000
      : ELECTIONS[city].staleSeconds * 1000;
  if (!checkedAt || Date.now() - checkedAt.getTime() > threshold) return true;
  // A successful download must not make old published results appear current.
  return Boolean(
    results?.totalVotes &&
    results.sourceUpdatedAt &&
    Date.now() - Date.parse(results.sourceUpdatedAt) > 10 * 60_000,
  );
}

export function assertNotOlder(
  city: City,
  current: Results,
  previous: Results | null,
) {
  if (!previous) return;
  if (
    city === "toronto" &&
    BigInt(current.sequence) < BigInt(previous.sequence)
  )
    throw new SourceError("Toronto returned an older sequence");
  if (
    current.sourceUpdatedAt &&
    previous.sourceUpdatedAt &&
    current.sourceUpdatedAt < previous.sourceUpdatedAt
  )
    throw new SourceError("Results source returned an older publication");
}
