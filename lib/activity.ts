import { createHash, randomUUID } from "node:crypto";
import type { Results } from "./types";
import type { City } from "./types";
import { ELECTIONS } from "./elections";
import { diagnosticToken, errorFields, logEvent } from "./worker-log";
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
type RequestContext = {
  city?: City;
  cycleId?: string;
  attemptId?: string;
  payloadHash?: string;
  target?: "group" | "template" | "create";
};

export class ActivityRequestError extends Error {
  constructor(
    message: string,
    public diagnostics: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ActivityRequestError";
  }
}

export async function activityRequest(
  path: "start" | "update" | "end",
  body: object,
  context: RequestContext = {},
): Promise<Record<string, unknown>> {
  const requestId = randomUUID();
  const started = performance.now();
  const request = { ...context, requestId, operation: path };
  logEvent("provider.request.started", request);
  let response: Response;
  try {
    response = await fetch(`https://api.webliveactivity.com/api/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.WEBACTIVITY_API_KEY || "",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const diagnostics = {
      ...request,
      outcome: "network_error",
      durationMs: Math.round(performance.now() - started),
      ...errorFields(error),
      deliveryConfirmed: false,
    };
    logEvent("provider.request.failed", diagnostics, "error");
    throw new ActivityRequestError(
      `WebActivity ${path} request failed`,
      diagnostics,
    );
  }
  const responseFields = {
    ...request,
    httpStatus: response.status,
    providerRequestId: diagnosticToken(
      response.headers.get("x-request-id") ||
        response.headers.get("request-id"),
    ),
  };
  let result: Record<string, unknown>;
  try {
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Invalid provider response shape");
    result = data as Record<string, unknown>;
  } catch (error) {
    const diagnostics = {
      ...responseFields,
      outcome: response.ok ? "invalid_response" : "http_error",
      durationMs: Math.round(performance.now() - started),
      ...errorFields(error),
      deliveryConfirmed: false,
    };
    logEvent("provider.request.failed", diagnostics, "error");
    throw new ActivityRequestError(
      `WebActivity ${path} returned ${response.status} with an unreadable response`,
      diagnostics,
    );
  }
  const fields = {
    ...responseFields,
    durationMs: Math.round(performance.now() - started),
    providerOk: result.ok === true,
    targeted: typeof result.targeted === "number" ? result.targeted : undefined,
    unknownCount: Array.isArray(result.unknown)
      ? result.unknown.length
      : undefined,
    deliveryConfirmed: false,
  };
  if (!response.ok || result.ok !== true) {
    const providerError = result.error as { code?: unknown } | null;
    const code =
      result.code || result.errorCode || providerError?.code || result.error;
    const diagnostics = {
      ...fields,
      outcome: response.ok ? "provider_rejected" : "http_error",
      providerErrorCode:
        typeof code === "string" && /^[A-Z][A-Z0-9_]{1,79}$/.test(code)
          ? code
          : undefined,
    };
    logEvent("provider.request.failed", diagnostics, "error");
    throw new ActivityRequestError(
      response.ok
        ? `WebActivity ${path} did not succeed`
        : `WebActivity ${path} returned ${response.status}`,
      diagnostics,
    );
  }
  logEvent(
    "provider.request.accepted",
    { ...fields, outcome: "accepted" },
    context.target === "group" && result.targeted === 0 ? "warn" : "info",
  );
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
