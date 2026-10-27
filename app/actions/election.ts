"use server";

import {
  activityEmbedUrl,
  activityEnabled,
  pushIntervalSeconds,
} from "@/lib/activity";
import { collectionIsComplete, resultsAreStale } from "@/lib/collection";
import { isCity } from "@/lib/elections";
import { getPublicResults, readElection } from "@/lib/results";
import type { ActivityStatus, City, PublicResults } from "@/lib/types";

export async function getElectionResults(
  city: City = "toronto",
): Promise<PublicResults> {
  if (!isCity(city)) throw new Error("Unknown city");
  try {
    return await getPublicResults(city);
  } catch {
    return { results: null, checkedAt: null, stale: true };
  }
}

export async function getLiveActivity(
  city: City = "toronto",
): Promise<ActivityStatus> {
  if (!isCity(city)) throw new Error("Unknown city");
  const body: ActivityStatus = {
    status: "unavailable",
    embedUrl: null,
    intervalMinutes: pushIntervalSeconds() / 60,
  };
  try {
    if (activityEnabled()) {
      const row = await readElection(city);
      if (
        row &&
        ((!collectionIsComplete(row.results) &&
          (row.collectionPaused || row.failureCount)) ||
          resultsAreStale(city, row.results, row.checkedAt))
      )
        return body;
      body.status = "waiting";
      if (row?.embedUrl) {
        body.embedUrl = activityEmbedUrl(row.embedUrl);
        body.status = "ready";
      }
    }
  } catch {
    /* Do not offer a launch button while storage or the source is unavailable. */
  }
  return body;
}
