import type { SourceValidators } from "./types";

export const SOURCE_USER_AGENT =
  "OurVote/0.1 (+https://ourvote.mstep.dev; election-results)";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export class SourceError extends Error {
  constructor(
    message: string,
    public status = 0,
    public retryAfterMs = 0,
    public pause = false,
  ) {
    super(message);
  }
}

function retryAfterMs(value: string | null) {
  if (!value) return 0;
  if (/^\d+$/.test(value.trim())) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

export async function fetchSource(
  url: string,
  validators: SourceValidators = {},
  accept = "text/html",
) {
  const headers = new Headers({
    Accept: accept,
    "User-Agent": SOURCE_USER_AGENT,
  });
  if (validators.etag) headers.set("If-None-Match", validators.etag);
  if (validators.lastModified)
    headers.set("If-Modified-Since", validators.lastModified);
  const response = await fetch(url, {
    headers,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok && response.status !== 304) {
    await response.body?.cancel();
    throw new SourceError(
      `Results source returned HTTP ${response.status}`,
      response.status,
      retryAfterMs(response.headers.get("retry-after")),
      response.status === 401 || response.status === 403,
    );
  }
  const maxAge = response.headers
    .get("cache-control")
    ?.match(/(?:^|,)\s*(?:s-maxage|max-age)=(\d+)/i)?.[1];
  const cacheSeconds = Math.max(
    0,
    Number(maxAge || 0) - Number(response.headers.get("age") || 0),
  );
  const metadata = {
    etag: response.headers.get("etag") || validators.etag || null,
    lastModified:
      response.headers.get("last-modified") || validators.lastModified || null,
    cacheSeconds: Number.isFinite(cacheSeconds) ? cacheSeconds : 0,
  };
  if (response.status === 304) return { ...metadata, text: null };
  // An updated response with no validators must clear old validators.
  metadata.etag = response.headers.get("etag");
  metadata.lastModified = response.headers.get("last-modified");
  const reader = response.body?.getReader();
  if (!reader) throw new SourceError("Results source returned an empty body");
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new SourceError("Results source exceeded the response size limit");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return { ...metadata, text };
}
