import { createHash } from "node:crypto";
import { load } from "cheerio";
import robotsParser from "robots-parser";
import { portraits } from "./candidates";
import { ELECTIONS } from "./elections";
import { fetchSource, SourceError, SOURCE_USER_AGENT } from "./source-http";
import type { FeedUpdate, Results, SourceValidators } from "./types";

export const RICHMOND_HILL_URL = ELECTIONS["richmond-hill"].sourceUrl;
// Verified against the City's certified candidate list. Fail closed if the contest changes.
const MAYOR_NAMES: Record<string, string> = {
  "DOMENIC BARDARI": "Domenic Bardari",
  "HOLO DEVNANI": "Holo Devnani",
  "DAVID WEST": "David West",
};
const clean = (value: string) => value.replace(/\s+/g, " ").trim();

function count(value: string) {
  const normalized = clean(value);
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(normalized))
    throw new SourceError("Unrecognized Richmond Hill vote count");
  const number = Number(normalized.replaceAll(",", ""));
  if (!Number.isSafeInteger(number) || number < 0)
    throw new SourceError("Invalid Richmond Hill vote count");
  return number;
}

function publisherTimestamp(text: string): string {
  const match = text.match(
    /^Last Updated\s*:\s*([A-Za-z]+)\s+(\d{1,2}),\s*(2026),?\s+(\d{1,2}):(\d{2})\s*([ap])\.?m\.?$/i,
  );
  if (!match)
    throw new SourceError("Unrecognized Richmond Hill publication timestamp");
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const month = months.indexOf(match[1].toLowerCase());
  const day = Number(match[2]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 0 || day < 1 || day > 31 || hour < 1 || hour > 12 || minute > 59)
    throw new SourceError("Invalid Richmond Hill publication date");
  const local = Date.UTC(
    2026,
    month,
    day,
    (hour % 12) + (match[6].toLowerCase() === "p" ? 12 : 0),
    minute,
  );
  if (new Date(local).getUTCMonth() !== month)
    throw new SourceError("Invalid Richmond Hill publication day");
  // Resolve the publisher's Eastern offset rather than using the server's timezone.
  const offsetLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    timeZoneName: "shortOffset",
  })
    .formatToParts(new Date(local))
    .find((part) => part.type === "timeZoneName")?.value;
  const offset = offsetLabel?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!offset)
    throw new SourceError(
      "Could not resolve Richmond Hill publication timezone",
    );
  const offsetMinutes =
    (Number(offset[2]) * 60 + Number(offset[3] || 0)) *
    (offset[1] === "+" ? 1 : -1);
  const result = new Date(local - offsetMinutes * 60_000);
  if (result.getTime() > Date.now() + 5 * 60_000)
    throw new SourceError(
      "Richmond Hill publication timestamp is in the future",
    );
  return result.toISOString();
}

export function parseRichmondHill(html: string): Results {
  const $ = load(html);
  if (!$("title").text().includes("Richmond Hill Election Results"))
    throw new SourceError("Unexpected Richmond Hill results document");
  const heading = $(".accordion .tab a").filter(
    (_, element) => clean($(element).text()).toUpperCase() === "MAYOR",
  );
  if (heading.length !== 1)
    throw new SourceError(
      "Richmond Hill mayoral contest was not found uniquely",
    );
  const table = heading
    .closest(".tab")
    .next(".repeatable-content")
    .find(".contest-table table");
  if (
    table.length !== 1 ||
    !/To be elected:\s*1/.test(clean(table.find("thead").text()))
  )
    throw new SourceError("Richmond Hill mayoral table changed");
  if (clean(table.find("thead th").eq(1).text()) !== "Votes")
    throw new SourceError("Richmond Hill vote column changed");
  const rows = table.find("tbody tr").toArray();
  if (rows.length !== 3)
    throw new SourceError("Richmond Hill mayoral candidate list changed");
  const voteCells = rows.map((row) => clean($(row).find("td").eq(1).text()));
  const allBlank = voteCells.every((value) => value === "");
  if (!allBlank && voteCells.some((value) => value === ""))
    throw new SourceError("Richmond Hill results are incomplete");
  const candidates = rows.map((row, index) => {
    const cells = $(row).find("td");
    if (cells.length !== 3 || !cells.eq(0).hasClass("choiceName"))
      throw new SourceError("Richmond Hill candidate row changed");
    const name = MAYOR_NAMES[clean(cells.eq(0).text()).toUpperCase()];
    if (!name)
      throw new SourceError("Unrecognized Richmond Hill mayoral candidate");
    return {
      name,
      votesReceived: allBlank ? 0 : count(voteCells[index]),
      percentage: 0,
      photo: portraits[name] ?? null,
    };
  });
  if (new Set(candidates.map((candidate) => candidate.name)).size !== 3)
    throw new SourceError("Duplicate Richmond Hill candidate");
  const reporting = clean($("#tabulators td").last().text()).match(
    /^(\d*)\s*\/\s*(\d+)$/,
  );
  if (!reporting || (!allBlank && !reporting[1]))
    throw new SourceError("Richmond Hill tabulator totals are missing");
  const polls = count(reporting[2]);
  const pollsReceived = reporting[1] ? count(reporting[1]) : 0;
  if (!polls || pollsReceived > polls)
    throw new SourceError("Invalid Richmond Hill tabulator totals");
  const updated = $("p")
    .toArray()
    .map((element) => clean($(element).text()))
    .filter((text) => /^Last Updated\s*:/i.test(text));
  if (!updated.length || new Set(updated).size !== 1)
    throw new SourceError(
      "Richmond Hill publication timestamps are missing or inconsistent",
    );
  const sourceUpdatedAt = publisherTimestamp(updated[0]);
  const totalVotes = candidates.reduce(
    (sum, candidate) => sum + candidate.votesReceived,
    0,
  );
  for (const candidate of candidates)
    candidate.percentage = totalVotes
      ? (candidate.votesReceived / totalVotes) * 100
      : 0;
  candidates.sort(
    (a, b) =>
      b.votesReceived - a.votesReceived ||
      a.name.localeCompare(b.name, "en-CA"),
  );
  const sequence = createHash("sha256")
    .update(
      JSON.stringify({ candidates, polls, pollsReceived, sourceUpdatedAt }),
    )
    .digest("hex");
  return {
    sequence,
    candidates,
    polls,
    pollsReceived,
    totalVotes,
    sourceUpdatedAt,
  };
}

let robots: { until: number; delayMs: number } | undefined;
async function checkRobots() {
  if (robots && robots.until > Date.now()) return robots.delayMs;
  const url = new URL("robots.txt", RICHMOND_HILL_URL).href;
  let text = "";
  try {
    text = (await fetchSource(url, {}, "text/plain")).text || "";
  } catch (error) {
    if (!(error instanceof SourceError) || error.status !== 404) throw error;
  }
  const rules = robotsParser(url, text);
  if (rules.isAllowed(RICHMOND_HILL_URL, SOURCE_USER_AGENT) === false)
    throw new SourceError(
      "Richmond Hill robots.txt disallows collection",
      403,
      0,
      true,
    );
  const delayMs = Math.max(
    0,
    (rules.getCrawlDelay(SOURCE_USER_AGENT) || 0) * 1000,
  );
  robots = { until: Date.now() + 6 * 60 * 60 * 1000, delayMs };
  return delayMs;
}

export async function fetchRichmondHill(
  validators: SourceValidators = {},
): Promise<FeedUpdate> {
  // Keep the last known policy even if refreshing robots.txt or fetching/parsing
  // the results fails. A failure must never shorten the publisher's crawl delay.
  let robotsDelay = robots?.delayMs ?? 0;
  try {
    robotsDelay = await checkRobots();
    const response = await fetchSource(RICHMOND_HILL_URL, validators);
    return {
      results: response.text === null ? null : parseRichmondHill(response.text),
      etag: response.etag,
      lastModified: response.lastModified,
      cacheSeconds: Math.max(response.cacheSeconds, robotsDelay / 1000),
    };
  } catch (error) {
    if (error instanceof SourceError) {
      throw new SourceError(
        error.message,
        error.status,
        Math.max(error.retryAfterMs, robotsDelay),
        error.pause,
      );
    }
    throw new SourceError(
      "Richmond Hill results retrieval failed",
      0,
      robotsDelay,
    );
  }
}
