export type City = "toronto" | "richmond-hill";
export type Candidate = {
  name: string;
  votesReceived: number;
  percentage: number;
  photo: string | null;
};
export type Results = {
  sequence: string;
  candidates: Candidate[];
  polls: number;
  pollsReceived: number;
  totalVotes: number;
  // The publisher's timestamp, separate from the last successful retrieval.
  sourceUpdatedAt?: string;
};
export type PublicResults = {
  results: Results | null;
  checkedAt: string | null;
  stale: boolean;
};
export type ActivityStatus = {
  status: "ready" | "waiting" | "unavailable";
  embedUrl: string | null;
  intervalMinutes: number;
};
export type SourceValidators = {
  etag?: string | null;
  lastModified?: string | null;
};
export type FeedUpdate = {
  results: Results | null;
  etag: string | null;
  lastModified: string | null;
  cacheSeconds: number;
};
