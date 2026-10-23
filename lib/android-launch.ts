const PACKAGE = "com.eldrbreak.webactivities";

export function androidLaunchLinks(userId: string, originCode = "") {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(userId) || originCode.length > 2048)
    return null;
  const query = new URLSearchParams({ userId });
  if (originCode) query.set("o", originCode);
  const play = new URL("https://play.google.com/store/apps/details");
  play.searchParams.set("id", PACKAGE);
  play.searchParams.set("referrer", query.toString());
  const origin = originCode ? `?o=${encodeURIComponent(originCode)}` : "";
  return {
    path: `/android?${query}`,
    play: play.href,
    intent: `intent://user/${encodeURIComponent(userId)}${origin}#Intent;scheme=webactivities;package=${PACKAGE};S.browser_fallback_url=${encodeURIComponent(play.href)};end`,
  };
}
