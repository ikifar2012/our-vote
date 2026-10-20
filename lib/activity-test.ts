import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { elections } from "../db/schema";
import { activityRequest, activityState, extractEmbed } from "./activity";
import { ELECTIONS } from "./elections";
import { TEST_TARGETS, testResults, type TestStage } from "./test-scenarios";
import type { City, Results } from "./types";

const COOLDOWN_MS = 60_000;

export type TestStatus = {
  ready: boolean;
  message: string | null;
  embedUrl: string | null;
  results: Results | null;
  publishedAt: string | null;
  nextSendAt: string | null;
  lastError: string | null;
};

function configurationError(checkSite = true) {
  if (process.env.TEST_MODE_ENABLED !== "true") return "Test mode is disabled.";
  if (!process.env.WEBACTIVITY_API_KEY)
    return "Add WEBACTIVITY_API_KEY to your environment, then restart.";
  if (!getDb())
    return "Configure DATABASE_URL and run the database migrations first.";
  if (!checkSite) return null;
  try {
    const url = new URL(process.env.SITE_URL || "");
    if (
      url.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password
    )
      return "Set SITE_URL to a public HTTPS address so phones can load candidate photos.";
  } catch {
    return "Set SITE_URL to your public HTTPS address.";
  }
  return null;
}

export async function readTestStatus(city: City): Promise<TestStatus> {
  const empty: TestStatus = {
    ready: false,
    message: configurationError(),
    embedUrl: null,
    results: null,
    publishedAt: null,
    nextSendAt: null,
    lastError: null,
  };
  if (empty.message) return empty;
  try {
    const [row] = await getDb()!
      .select()
      .from(elections)
      .where(eq(elections.id, TEST_TARGETS[city].id))
      .limit(1);
    if (row?.embedUrl) {
      const url = new URL(row.embedUrl);
      if (
        url.origin !== "https://api.webliveactivity.com" ||
        url.pathname !== "/embed/button"
      )
        return {
          ...empty,
          message:
            "The saved test launch URL is invalid. End this test before starting again.",
        };
    }
    return {
      ready: true,
      message: null,
      embedUrl: row?.embedUrl ?? null,
      results: row?.results ?? null,
      publishedAt: row?.publishedAt?.toISOString() ?? null,
      nextSendAt: row?.nextFetchAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
    };
  } catch {
    return {
      ...empty,
      message:
        "Cannot read test storage. Check Postgres and run the migrations.",
    };
  }
}

export function testActivityState(
  city: City,
  stage: TestStage,
  previous?: Results | null,
) {
  const results = testResults(city, stage, previous);
  const actionURL = new URL("/test", process.env.SITE_URL!).href;
  const primaryText = `TEST · ${ELECTIONS[city].name}`;
  if (stage === "waiting")
    return {
      layout: "progress",
      primaryText,
      secondaryText: "Fictional results · Waiting for sample votes",
      progress: 0,
      backgroundColorHex: "#000000",
      accentColorHex: "#FFFFFF",
      actionLabel: "Test",
      actionURL,
    };
  const state = activityState(results, city);
  return {
    ...state,
    primaryText,
    secondaryText: `TEST · Fictional results${stage === "delayed" ? " · Updates delayed" : ""}`,
    actionLabel: "Test",
    actionURL,
    versus: {
      ...state.versus,
      centerLabel: stage === "delayed" ? "Delayed" : state.versus.centerLabel,
    },
  };
}

// Never accepts group/container/row IDs from a caller. These are fixed test-only targets.
export async function sendTestStage(city: City, stage: TestStage | "end") {
  const problem = configurationError(stage !== "end");
  if (problem) return { ok: false, message: problem };
  const db = getDb()!;
  const target = TEST_TARGETS[city];
  try {
    return await db.transaction(async (tx) => {
      const locks = await tx.execute(
        sql`select pg_try_advisory_xact_lock(${target.lockId}::bigint) as locked`,
      );
      if (!locks[0]?.locked)
        return {
          ok: false,
          message: "Another test send is running. Try again in a moment.",
        };
      await tx
        .insert(elections)
        .values({ id: target.id })
        .onConflictDoNothing();
      const [previous] = await tx
        .select()
        .from(elections)
        .where(eq(elections.id, target.id));
      if (stage === "end" && !previous.activityId)
        return { ok: true, message: "No active test to end." };
      const state =
        stage === "end"
          ? null
          : testActivityState(city, stage, previous.results);
      const hash = state
        ? createHash("sha256").update(JSON.stringify(state)).digest("hex")
        : null;
      if (
        stage !== "end" &&
        hash === previous.publishedHash &&
        !previous.lastError
      )
        return {
          ok: true,
          message: "That stage is already sent. No additional pushes used.",
        };
      if (
        stage !== "end" &&
        previous.nextFetchAt &&
        previous.nextFetchAt.getTime() > Date.now()
      )
        return {
          ok: false,
          message:
            "Wait one minute between test sends. Ending a test is always available.",
        };
      // Commit the cooldown even on delivery errors, so retries cannot hammer the provider.
      await tx
        .update(elections)
        .set({ nextFetchAt: new Date(Date.now() + COOLDOWN_MS) })
        .where(eq(elections.id, target.id));
      try {
        if (stage === "end") {
          await activityRequest("end", {
            widgetContainerId: target.container,
            group: target.group,
          });
          await activityRequest("end", {
            widgetContainerId: target.container,
            activityId: previous.activityId,
          });
          await tx
            .update(elections)
            .set({
              activityId: null,
              embedUrl: null,
              results: null,
              publishedAt: null,
              publishedHash: null,
              nextFetchAt: null,
              lastError: null,
            })
            .where(eq(elections.id, target.id));
          return {
            ok: true,
            message:
              "Test ended. Only this city's test activities were removed.",
          };
        }
        let activityId = previous.activityId;
        let embedUrl = previous.embedUrl;
        if (!activityId) {
          const started = await activityRequest("start", {
            widgetContainerId: target.container,
            group: target.group,
            reuse: true,
            brand: {
              title: `TEST · ${ELECTIONS[city].name}`,
              name: "Our Vote TEST",
              description: "Internal testing with fictional results",
            },
            state,
          });
          if (typeof started.activityId !== "string")
            throw new Error("WebActivity did not return an activity ID.");
          activityId = started.activityId;
          embedUrl = extractEmbed(started);
        } else {
          await activityRequest("update", {
            widgetContainerId: target.container,
            group: target.group,
            priority: 5,
            state,
          });
          await activityRequest("update", {
            widgetContainerId: target.container,
            activityId,
            priority: 5,
            state,
          });
        }
        await tx
          .update(elections)
          .set({
            activityId,
            embedUrl,
            results: testResults(city, stage, previous.results),
            publishedAt: new Date(),
            publishedHash: hash,
            lastError: null,
          })
          .where(eq(elections.id, target.id));
        return {
          ok: true,
          message: previous.activityId
            ? "Test update sent. Allow up to 45 seconds for delivery."
            : "Test created. Use the button below to add it to your phone.",
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Test delivery failed.";
        await tx
          .update(elections)
          .set({ lastError: message })
          .where(eq(elections.id, target.id));
        return { ok: false, message: `Test send failed: ${message}` };
      }
    });
  } catch {
    return {
      ok: false,
      message:
        "Test storage is unavailable. Check Postgres and migrations before retrying.",
    };
  }
}
