import type { City } from "./types";

export const POLLS_CLOSE = Date.parse("2026-10-26T20:00:00-04:00");
export const CITIES = ["toronto", "richmond-hill"] as const;
export const ELECTIONS = {
  toronto: {
    id: "toronto-2026",
    name: "Toronto",
    container: "our-vote-toronto-2026",
    group: "toronto-mayor-2026",
    sourceUrl: "https://mediaresults.toronto.ca/results/unofficialresult.json",
    informationUrl: "https://www.toronto.ca/city-government/elections/",
    resultsUrl:
      "https://www.toronto.ca/city-government/elections/election-results-reports/election-results/",
    reportingUnit: "polls",
    pollSeconds: 60,
    staleSeconds: 180,
    lockId: 6872652026,
  },
  "richmond-hill": {
    id: "richmond-hill-2026",
    name: "Richmond Hill",
    container: "our-vote-richmond-hill-2026",
    group: "richmond-hill-mayor-2026",
    sourceUrl: "https://electionresults.richmondhill.ca/",
    informationUrl:
      "https://www.richmondhill.ca/en/living-here/election-information.aspx",
    resultsUrl: "https://electionresults.richmondhill.ca/",
    reportingUnit: "tabulators",
    pollSeconds: 120,
    staleSeconds: 360,
    lockId: 6872652027,
  },
} as const;

export function isCity(value: unknown): value is City {
  return value === "toronto" || value === "richmond-hill";
}

export function pollDelayMs(city: City, now = Date.now()) {
  // One readiness fetch, then at most every six hours before polls close.
  // Always wake at polls close rather than carrying a six-hour delay into election night.
  if (now < POLLS_CLOSE) return Math.min(6 * 60 * 60 * 1000, POLLS_CLOSE - now);
  return ELECTIONS[city].pollSeconds * 1000;
}
