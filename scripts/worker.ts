import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
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
  ActivityRequestError,
  activityRequest,
  activityState,
  extractEmbed,
  pushIntervalSeconds,
  stateHash,
  waitingActivityState,
} from "../lib/activity";
import type { City } from "../lib/types";
import { SourceError } from "../lib/source-http";
import { errorFields, logEvent } from "../lib/worker-log";

loadEnvConfig(process.cwd());
const db = getDb();
const MAX_DELIVERY_RETRIES = 3;
if (!db) throw new Error("Set DATABASE_URL before starting the worker.");
const requestedCity = process.argv.includes("--city")
  ? process.argv[process.argv.indexOf("--city") + 1]
  : null;
if (requestedCity !== null && !isCity(requestedCity))
  throw new Error("Use --city toronto or --city richmond-hill");
const cities: readonly City[] = requestedCity
  ? [requestedCity as City]
  : CITIES;
const pausedReported = new Set<City>();

async function tick(city: City): Promise<boolean> {
  const election = ELECTIONS[city];
  const cycleId = randomUUID();
  const context = { city, cycleId };
  let touched = false;
  let deliveryRecorded = false;
  return db!
    .transaction(async (tx) => {
      const locks = await tx.execute(
        sql`select pg_try_advisory_xact_lock(${election.lockId}::bigint) as locked`,
      );
      if (!locks[0]?.locked) {
        logEvent(
          "worker.cycle.skipped",
          { ...context, reason: "lock_busy" },
          "debug",
        );
        return true;
      }
      await tx
        .insert(elections)
        .values({ id: election.id })
        .onConflictDoNothing();
      const [previous] = await tx
        .select()
        .from(elections)
        .where(eq(elections.id, election.id));
      if (previous.collectionPaused) {
        if (!pausedReported.has(city)) {
          pausedReported.add(city);
          logEvent(
            "source.paused",
            {
              ...context,
              reason: "collection_paused",
              failureCount: previous.failureCount,
            },
            "error",
          );
        }
        return false;
      }
      pausedReported.delete(city);
      if (previous.nextFetchAt && Date.now() < previous.nextFetchAt.getTime()) {
        logEvent(
          "worker.cycle.skipped",
          {
            ...context,
            reason: "fetch_not_due",
            nextFetchAt: previous.nextFetchAt.toISOString(),
          },
          "debug",
        );
        return true;
      }
      let results = previous.results;
      const fetchStarted = performance.now();
      logEvent("source.fetch.started", context);
      try {
        const feed = await fetchResults(city, {
          etag: previous.etag,
          lastModified: previous.lastModified,
        });
        if (feed.results) {
          assertNotOlder(city, feed.results, previous.results);
          results = feed.results;
        }
        if (!results)
          throw new Error("No initial results snapshot was returned");
        const checkedAt = new Date();
        const fetchDue = nextFetchAt(city, feed.cacheSeconds);
        await tx
          .update(elections)
          .set({
            results,
            checkedAt,
            etag: feed.etag,
            lastModified: feed.lastModified,
            nextFetchAt: fetchDue,
            failureCount: 0,
            lastError: null,
          })
          .where(eq(elections.id, election.id));
        touched = true;
        logEvent("source.snapshot.staged", {
          ...context,
          sequence: results.sequence,
          sourceUpdatedAt: results.sourceUpdatedAt,
          checkedAt: checkedAt.toISOString(),
          nextFetchAt: fetchDue.toISOString(),
          durationMs: Math.round(performance.now() - fetchStarted),
          sourceResponse: feed.results ? "snapshot_received" : "not_modified",
          cacheSeconds: feed.cacheSeconds,
          totalVotes: results.totalVotes,
          pollsReceived: results.pollsReceived,
          polls: results.polls,
          reportingPercent: Math.floor(
            (results.pollsReceived / Math.max(1, results.polls)) * 100,
          ),
          leaders: results.totalVotes
            ? results.candidates
                .slice(0, 2)
                .map(({ name, votesReceived }) => ({ name, votesReceived }))
            : [],
          commitPending: true,
        });
      } catch (error) {
        const failure = failureState(city, previous.failureCount, error);
        await tx
          .update(elections)
          .set(failure)
          .where(eq(elections.id, election.id));
        touched = true;
        logEvent(
          "source.fetch.failed",
          {
            ...context,
            ...errorFields(error),
            reason:
              error instanceof SourceError
                ? error.message
                : "Results retrieval or validation failed",
            httpStatus: error instanceof SourceError ? error.status : undefined,
            durationMs: Math.round(performance.now() - fetchStarted),
            failureCount: failure.failureCount,
            collectionPaused: failure.collectionPaused,
            nextFetchAt: failure.nextFetchAt.toISOString(),
            commitPending: true,
          },
          "error",
        );
        return false;
      }
      // Incomplete counts must be fresh; fully reported counts remain valid while fetches succeed.
      if (!activityEnabled() || resultsAreStale(city, results, new Date())) {
        logEvent("delivery.skipped", {
          ...context,
          sequence: results.sequence,
          reason: !activityEnabled() ? "activities_disabled" : "source_stale",
        });
        return true;
      }
      const waiting = Date.now() < POLLS_CLOSE || !results.totalVotes;
      const state = waiting
        ? waitingActivityState(city)
        : activityState(results, city);
      const hash = stateHash(state);
      // Track attempts by payload, including requests that the provider rejected.
      // Existing rows fall back to their last published payload until first retried.
      const retry =
        hash === (previous.lastDeliveryAttemptHash ?? previous.publishedHash);
      const decision = {
        ...context,
        sequence: results.sequence,
        payloadHash: hash,
        lastPublishedHash: previous.publishedHash,
        lastAttemptedHash: previous.lastDeliveryAttemptHash,
        lastPublishedAt: previous.publishedAt?.toISOString(),
        lastAttemptAt: previous.lastDeliveryAttemptAt?.toISOString(),
        retriesUsed: previous.deliveryRetries,
        retryLimit: MAX_DELIVERY_RETRIES,
        reportingPercent: waiting
          ? 0
          : Math.floor(
              (results.pollsReceived / Math.max(1, results.polls)) * 100,
            ),
      };
      if (retry && previous.deliveryRetries >= MAX_DELIVERY_RETRIES) {
        logEvent("delivery.skipped", {
          ...decision,
          reason: "retry_budget_exhausted",
        });
        return true;
      }
      const deliveryRetries = retry ? previous.deliveryRetries + 1 : 0;
      // Deliver the first count promptly to phones already following the waiting card.
      const firstResults =
        !waiting &&
        previous.publishedHash === stateHash(waitingActivityState(city));
      const lastAttempt =
        previous.lastDeliveryAttemptAt ?? previous.publishedAt;
      const bypassCooldown =
        firstResults &&
        !retry &&
        (!lastAttempt ||
          (previous.publishedAt && lastAttempt <= previous.publishedAt));
      if (
        !bypassCooldown &&
        lastAttempt &&
        Date.now() - lastAttempt.getTime() < pushIntervalSeconds() * 1000
      ) {
        logEvent("delivery.skipped", {
          ...decision,
          reason: "cooldown",
          nextEligibleAt: new Date(
            lastAttempt.getTime() + pushIntervalSeconds() * 1000,
          ).toISOString(),
        });
        return true;
      }
      const attemptId = randomUUID();
      const attemptContext = { ...context, attemptId, payloadHash: hash };
      logEvent("delivery.attempt.started", {
        ...decision,
        attemptId,
        attemptNumber: deliveryRetries + 1,
        reason: retry ? "retry" : firstResults ? "first_results" : "new_state",
        operation: previous.activityId ? "update" : "start",
        group: election.group,
        widgetContainerId: election.container,
        priority: previous.activityId ? 5 : undefined,
      });
      try {
        // Persist attempts even on provider errors; retries stay spaced and bounded.
        await tx
          .update(elections)
          .set({
            lastDeliveryAttemptAt: new Date(),
            lastDeliveryAttemptHash: hash,
            deliveryRetries,
          })
          .where(eq(elections.id, election.id));
        touched = true;
        if (!previous.activityId) {
          const started = await activityRequest(
            "start",
            {
              widgetContainerId: election.container,
              group: election.group,
              reuse: true,
              brand: {
                title: `${election.name} mayoral election`,
                name: "Our Vote",
                description: `Unofficial ${election.name} mayoral results`,
              },
              state,
            },
            { ...attemptContext, target: "create" },
          );
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
          await activityRequest(
            "update",
            {
              widgetContainerId: election.container,
              group: election.group,
              priority: 5,
              state,
            },
            { ...attemptContext, target: "group" },
          );
          await activityRequest(
            "update",
            {
              widgetContainerId: election.container,
              activityId: previous.activityId,
              priority: 5,
              state,
            },
            { ...attemptContext, target: "template" },
          );
          await tx
            .update(elections)
            .set({
              publishedHash: hash,
              publishedAt: new Date(),
            })
            .where(eq(elections.id, election.id));
        }
        deliveryRecorded = true;
        logEvent("delivery.publication.staged", {
          ...attemptContext,
          attemptNumber: deliveryRetries + 1,
          commitPending: true,
          deliveryConfirmed: false,
        });
      } catch (error) {
        logEvent(
          "delivery.failed",
          {
            ...errorFields(error),
            ...(error instanceof ActivityRequestError ? error.diagnostics : {}),
            ...attemptContext,
            attemptNumber: deliveryRetries + 1,
            message: `${election.name}: activity delivery failed; latest results are saved if this cycle commits.`,
            commitPending: true,
            deliveryConfirmed: false,
          },
          "error",
        );
        return false;
      }
      return true;
    })
    .then((succeeded) => {
      if (touched)
        logEvent("worker.cycle.committed", {
          ...context,
          succeeded,
          deliveryRecorded,
          deliveryConfirmed: false,
        });
      return succeeded;
    })
    .catch((error) => {
      logEvent(
        "worker.cycle.rolled_back",
        { ...context, ...errorFields(error) },
        "error",
      );
      throw error;
    });
}

let stopping = false;
process.on("SIGTERM", () => {
  logEvent("worker.stopping", { signal: "SIGTERM" });
  stopping = true;
});
process.on("SIGINT", () => {
  logEvent("worker.stopping", { signal: "SIGINT" });
  stopping = true;
});
async function main() {
  logEvent("worker.started", {
    cities,
    liveActivitiesEnabled: activityEnabled(),
    liveActivitiesFlag: process.env.LIVE_ACTIVITIES_ENABLED === "true",
    providerKeyConfigured: Boolean(process.env.WEBACTIVITY_API_KEY),
    pushIntervalSeconds: pushIntervalSeconds(),
    retryLimit: MAX_DELIVERY_RETRIES,
  });
  do {
    const started = Date.now();
    let succeeded = true;
    for (const city of cities) {
      if (stopping) break;
      try {
        if (!(await tick(city))) succeeded = false;
      } catch (error) {
        succeeded = false;
        logEvent(
          "worker.iteration.failed",
          { city, ...errorFields(error) },
          "error",
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
