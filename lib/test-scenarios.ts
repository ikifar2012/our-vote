import { portraits } from "./candidates";
import type { City, Results } from "./types";

export const TEST_STAGES = [
  { id: "waiting", label: "Waiting" },
  { id: "first", label: "First results" },
  { id: "lead-change", label: "Lead change" },
  { id: "delayed", label: "Updates delayed" },
  { id: "complete", label: "All reported" },
] as const;

export type TestStage = (typeof TEST_STAGES)[number]["id"];

export function isTestStage(value: unknown): value is TestStage {
  return TEST_STAGES.some((stage) => stage.id === value);
}

// These identifiers are intentionally outside the real election registry.
// Only authenticated test controls or the test CLI write these rows; the election worker never reads them.
export const TEST_TARGETS = {
  toronto: {
    id: "test-toronto-v1",
    container: "our-vote-test-toronto-v1",
    group: "our-vote-test-toronto-v1",
    lockId: 6872652096,
  },
  "richmond-hill": {
    id: "test-richmond-hill-v1",
    container: "our-vote-test-richmond-hill-v1",
    group: "our-vote-test-richmond-hill-v1",
    lockId: 6872652097,
  },
} as const;

export function testResults(
  city: City,
  stage: TestStage,
  previous?: Results | null,
): Results {
  if (stage === "delayed" && previous?.totalVotes)
    return { ...previous, sequence: "test-delayed" };
  const waiting = stage === "waiting";
  const changed = stage === "lead-change" || stage === "complete";
  const complete = stage === "complete";
  const entries: [string, number][] =
    city === "toronto"
      ? [
          ["Olivia Chow", changed ? 181_200 : 52_400],
          ["Brad Bradford", changed ? 192_500 : 47_100],
          ["Imad Abdulkadir", changed ? 8_300 : 2_500],
        ]
      : [
          ["David West", changed ? 8_400 : 2_100],
          ["Domenic Bardari", changed ? 8_900 : 1_700],
          ["Holo Devnani", changed ? 2_100 : 600],
        ];
  const totalVotes = waiting
    ? 0
    : entries.reduce((sum, [, votes]) => sum + votes, 0);
  const polls = city === "toronto" ? 1431 : 21;
  return {
    sequence: `test-${stage}`,
    polls,
    pollsReceived: waiting
      ? 0
      : complete
        ? polls
        : changed
          ? Math.floor(polls * 0.7)
          : Math.floor(polls * 0.25),
    totalVotes,
    candidates: entries
      .map(([name, votes]) => ({
        name,
        votesReceived: waiting ? 0 : votes,
        percentage: totalVotes ? (votes / totalVotes) * 100 : 0,
        photo: portraits[name] ?? null,
      }))
      .sort(
        (a, b) =>
          b.votesReceived - a.votesReceived ||
          a.name.localeCompare(b.name, "en-CA"),
      ),
  };
}
