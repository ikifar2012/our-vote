# Richmond Hill collection

## Official sources checked October 20, 2026

- [Official results website](https://electionresults.richmondhill.ca/)
- [Certified mayoral candidates](https://www.richmondhill.ca/en/living-here/election-candidates.aspx): Domenic Bardari, Holo Devnani, David West.
- [Election information](https://www.richmondhill.ca/en/living-here/election-information.aspx): voting closes October 26, 2026 at 8 p.m. ET.
- [Results site's robots.txt](https://electionresults.richmondhill.ca/robots.txt): root page was allowed when checked. The collector rechecks this policy every six hours and stops if it disallows the results page.

The official site renders totals directly in HTML. No documented public JSON feed or guaranteed publication interval was found. Its HTML includes a 60-second meta refresh; that is a browser reload instruction, **not a commitment to publish new totals every minute**. Our collector fetches less frequently than one browser left open: at least 120 seconds between election-night requests, plus positive jitter and a scheduler check of at most ten seconds. This usually detects a published change within roughly two minutes, but cannot make the City's own updates faster or guarantee uninterrupted access.

At inspection, the source showed “Last Updated: October 1, 2026, 11:40 a.m.”, three mayoral candidates with blank votes, and “/ 21” tabulators. Those are pre-election placeholders. Blank tables become a waiting state, not ranked results. The source timestamp is retained separately from retrieval time. No historical 2022 results or third-party estimates are substituted.

## Request policy

- One worker-backed snapshot per city, served through Server Actions. More visitors produce **zero additional source requests in production**.
- One initial readiness fetch, then at most one every six hours before polls close. Wake at polls close, then at least two minutes between Richmond Hill fetches. A successful source response with a longer cache lifetime or robots crawl delay increases the wait.
- User-Agent: `OurVote/0.1 (+https://ourvote.mstep.dev; election-results)`.
- Send If-None-Match/If-Modified-Since when the server supplies validators. At inspection it supplied neither and used no-cache headers, so conditional responses are supported but not assumed.
- Persist schedule, failure count, and paused state in Postgres. A per-city advisory lock prevents concurrent workers from duplicating source fetches.
- On transient errors, back off exponentially from two minutes up to one hour. Honor a longer Retry-After header or the last known robots crawl delay, even beyond that cap and when retrieval/parsing fails. Before polls close, retain the slower readiness cadence. Add only positive jitter.
- On HTTP 401/403 or a robots disallow, **pause that city's collection** until an operator reviews it. Do not evade a block. Network/5xx/429/parse failures retain the last good data and update `last_error`.
- Do not append cache-busting parameters, rotate IPs, impersonate a browser, bypass CAPTCHAs, or query admin/private endpoints.
- Bound each request to 15 seconds and each body to 2 MiB; refuse unplanned redirects.

## HTML contract and validation

The adapter in `lib/richmond-hill.ts` requires the official Richmond Hill document title and the exact MAYOR accordion. It reads that contest's Votes column, matches all three certified candidate names, rejects duplicates/missing rows, parses comma-formatted integer counts, and reads the city-wide tabulator ratio from `#tabulators`. Percentages are calculated over all three mayoral candidates.

It also requires consistent publication timestamps, interprets them in America/Toronto, rejects future timestamps, and rejects responses older than the saved publication. The sequence is a hash of normalized mayoral results, tabulators, and publication time; irrelevant navigation/analytics changes do not create a new result sequence. A source correction with a newer timestamp may legitimately reduce a vote count.

Unexpected markup, partial blank tables, nonnumeric totals, changed candidate lists, or missing publication dates fail closed. The prior snapshot remains visible and is marked delayed. A successful download of published totals more than ten minutes old also stays marked delayed and is not pushed as a fresh update.

The source can change its HTML before or during election night. Recheck the official page before launch. The adapter is verified against the current zeroed page, not a guaranteed election-night feed contract. An official media feed or explicit polling guidance from the City's elections team would be preferable if offered. No outreach has been sent on your behalf.

## Operations

Apply migrations before starting the new worker:

```sh
bun run db:migrate
bun run sync --city richmond-hill
bun run worker
```

With Docker Compose, the migration service applies the change before web/worker start:

```sh
docker compose up -d --build
docker compose logs -f worker
```

Inspect scheduling and failures in Postgres (using your usual database console):

```sql
SELECT id, checked_at, next_fetch_at, failure_count, collection_paused, last_error
FROM elections
ORDER BY id;
```

`sync` respects next_fetch_at; repeatedly invoking it does not force requests. A city in a paused state makes a one-shot sync exit nonzero. Continuous workers stay alive to serve the other city, without repeatedly requesting the blocked source.

After resolving an access/policy issue with the operator or publisher, resume only the affected city:

```sql
UPDATE elections
SET collection_paused = false, failure_count = 0, last_error = NULL, next_fetch_at = NULL
WHERE id = 'richmond-hill-2026';
```

Do not repeatedly clear this state to work around a denial. If the City's page moves or changes markup, update the source/adapter, verify a saved response locally, then resume normal scheduling. The website links directly to official results while collection is unavailable.

The two cities use different database rows, locks, widget containers, and WebActivity groups. Phone delivery remains at the shared configured interval (five minutes by default), independent of upstream fetching. The top two follow votes, not photo availability. Until real votes arrive, the Richmond Hill dialog shows the certified candidates without vote rankings.
