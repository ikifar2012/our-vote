import { createHash } from "node:crypto";
import type { Results } from "./types";
import type { City } from "./types";
import { ELECTIONS } from "./elections";
export function pushIntervalSeconds() {
  const value = Number(process.env.PUSH_INTERVAL_SECONDS || 300);
  return Number.isFinite(value) ? Math.max(60, value) : 300;
}
export function activityEnabled() {
  return (
    process.env.LIVE_ACTIVITIES_ENABLED === "true" &&
    Boolean(process.env.WEBACTIVITY_API_KEY)
  );
}
export function compactVotes(votes: number) {
  return votes < 1000
    ? String(votes)
    : new Intl.NumberFormat("en-CA", {
        notation: "compact",
        maximumFractionDigits: 0,
      }).format(votes);
}
function activityName(name: string) {
  if (name.length <= 12) return name;
  const parts = name.split(/\s+/);
  const surname = parts.at(-1) || name;
  const abbreviated = `${parts[0][0]}. ${surname}`;
  return abbreviated.length <= 12 ? abbreviated : surname.slice(0, 12);
}
export function waitingActivityState(city: City = "toronto") {
  return {
    layout: "progress",
    primaryText: `${ELECTIONS[city].name} mayoral results`,
    secondaryText: "Waiting for official results",
    progress: 0,
    backgroundColorHex: "#000000",
    accentColorHex: "#FFFFFF",
    actionLabel: "Results",
    actionURL: process.env.SITE_URL || "https://ourvote.mstep.dev",
  };
}
export function activityState(results: Results, city: City = "toronto") {
  const election = ELECTIONS[city];
  const [left, right] = results.candidates;
  const site = process.env.SITE_URL || "https://ourvote.mstep.dev";
  const complete = results.polls > 0 && results.pollsReceived === results.polls;
  const photo = (c: typeof left) =>
    new URL(c.photo || `/api/portrait?name=${encodeURIComponent(c.name)}`, site)
      .href;
  return {
    layout: "versus",
    primaryText: `${election.name} mayoral results`,
    secondaryText: `Unofficial · ${results.pollsReceived}/${results.polls} ${election.reportingUnit} reporting`,
    backgroundColorHex: "#000000",
    accentColorHex: "#FFFFFF",
    actionLabel: "Results",
    actionURL: site,
    versus: {
      leftName: activityName(left.name),
      rightName: activityName(right.name),
      leftScore: compactVotes(left.votesReceived),
      rightScore: compactVotes(right.votesReceived),
      leftStatus: `${left.votesReceived.toLocaleString("en-CA")} votes`,
      rightStatus: `${right.votesReceived.toLocaleString("en-CA")} votes`,
      leftImageUrl: photo(left),
      rightImageUrl: photo(right),
      activeSide: "left",
      centerLabel: complete
        ? "Reported"
        : city === "richmond-hill"
          ? "Reporting"
          : "Polls",
      centerValue: `${Math.floor((results.pollsReceived / Math.max(1, results.polls)) * 100)}%`,
    },
  };
}
export function stateHash(
  state:
    ReturnType<typeof activityState> | ReturnType<typeof waitingActivityState>,
) {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}
export async function activityRequest(
  path: "start" | "update" | "end",
  body: object,
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.webliveactivity.com/api/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.WEBACTIVITY_API_KEY || "",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(`WebActivity ${path} returned ${response.status}`);
  const result = await response.json();
  if (result.ok !== true)
    throw new Error(`WebActivity ${path} did not succeed`);
  return result;
}
export function extractEmbed(result: Record<string, unknown>) {
  const links = result.links as { iframe?: string } | undefined;
  const src = links?.iframe?.match(/src=["']([^"']+)["']/)?.[1];
  if (!src) throw new Error("WebActivity did not return an embed URL");
  return activityEmbedUrl(src.replaceAll("&amp;", "&"));
}

export function activityEmbedUrl(src: string) {
  const url = new URL(src);
  if (
    url.origin !== "https://api.webliveactivity.com" ||
    url.pathname !== "/embed/button"
  )
    throw new Error("Unexpected embed URL");
  url.searchParams.set("theme", "dark");
  url.searchParams.set("color", "FFFFFF");
  // The provider's default QR destination uses an obsolete development domain.
  // This mode makes iPhone buttons and Apple QR codes use Apple's App Clip URL.
  url.searchParams.set("launch", "appclip");
  return url.href;
}
