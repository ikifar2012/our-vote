import { z } from "zod";
import { portraits } from "./candidates";
import type { FeedUpdate, Results, SourceValidators } from "./types";
import { fetchSource } from "./source-http";
export const TORONTO_URL =
  "https://mediaresults.toronto.ca/results/unofficialresult.json";

const count = z
  .union([z.string().regex(/^\d+$/), z.number()])
  .transform(Number)
  .pipe(z.number().int().nonnegative().safe());
const feedSchema = z.object({
  seq: z
    .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
    .transform(String),
  office: z.array(
    z.object({
      name: z.string(),
      ward: z.array(
        z.object({
          num: z.union([z.string(), z.number()]).transform(String),
          polls: count,
          pollsReceived: count,
          votesReceived: count,
          candidate: z.array(
            z.object({ name: z.string().min(1), votesReceived: count }),
          ),
        }),
      ),
    }),
  ),
});
export function parseToronto(data: unknown): Results {
  const feed = feedSchema.parse(data);
  const ward = feed.office
    .find((o) => o.name.toLowerCase() === "mayor")
    ?.ward.find((w) => w.num === "0");
  if (!ward || ward.candidate.length < 2 || ward.pollsReceived > ward.polls)
    throw new Error("Invalid mayoral results");
  const totalVotes = ward.candidate.reduce(
    (sum, c) => sum + c.votesReceived,
    0,
  );
  return {
    sequence: feed.seq,
    polls: ward.polls,
    pollsReceived: ward.pollsReceived,
    totalVotes,
    candidates: ward.candidate
      .map((c) => ({
        ...c,
        percentage: totalVotes ? (c.votesReceived / totalVotes) * 100 : 0,
        photo: portraits[c.name] ?? null,
      }))
      .sort(
        (a, b) =>
          b.votesReceived - a.votesReceived ||
          a.name.localeCompare(b.name, "en-CA"),
      ),
  };
}
export async function fetchToronto(
  validators: SourceValidators = {},
): Promise<FeedUpdate> {
  const response = await fetchSource(
    TORONTO_URL,
    validators,
    "application/json",
  );
  return {
    results:
      response.text === null ? null : parseToronto(JSON.parse(response.text)),
    etag: response.etag,
    lastModified: response.lastModified,
    cacheSeconds: response.cacheSeconds,
  };
}
