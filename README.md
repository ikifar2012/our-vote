# Our Vote

Toronto and Richmond Hill mayoral races on your Lock Screen.

Next.js 16, React, TypeScript, shadcn/ui (Base UI), PostgreSQL, Drizzle, and [WebActivity](https://webliveactivity.com/). Designed for a small VPS, with no required Vercel services. MIT-licensed code; photographs keep their own licenses in [PHOTO-CREDITS.md](PHOTO-CREDITS.md).

## Run locally

Use Bun 1.4+ (the Docker image and package manager are pinned to 1.4.0). Next.js commands explicitly use Bun’s runtime, and TypeScript scripts run directly with Bun.

```sh
bun install
bun run dev
```

Open http://localhost:3000. In development without a database, each city uses one shared in-memory collector with the same cadence and backoff as the worker. It does not send phone updates. Blank/zero votes show a waiting state, never an alphabetical leading pair. Production requires Postgres: page views and Server Actions only read saved snapshots and never fetch upstream.

For the full pipeline, copy `.env.example` to `.env`, set `DATABASE_URL` to your Postgres instance, then run:

```sh
bun run db:migrate
bun run sync
bun run worker
```

Keep the web server running in a separate terminal. `sync` performs one scheduled cycle for both cities; `worker` runs continuously. `bun run sync --city richmond-hill` targets one city and still respects its saved next-fetch time. Migrations are committed in `drizzle/`; after schema edits, use `bun run db:generate` and review the generated SQL before migrating.

## Deploy on a VPS

Prerequisites: Docker Compose, DNS for `ourvote.mstep.dev` pointing to the VPS, and a reverse proxy with HTTPS. Check the VPS has enough memory for a Next.js production build; building locally and transferring the image is also possible.

The multi-stage Docker image uses the official Bun 1.4.0 image for installation, building, and runtime. Dependencies are installed with `--frozen-lockfile`. The final image runs as the unprivileged `bun` user and contains Next.js standalone output, static/public assets, bundled Bun worker/migration entrypoints, and SQL migrations. It excludes the full source tree and build tools. Compose runs all three entrypoints with Bun; Node and tsx are not used. Environment files stay outside the image.

1. Copy `.env.example` to `.env`. Set a strong, URL-safe `POSTGRES_PASSWORD`. Leave `LIVE_ACTIVITIES_ENABLED=false` for a website-only launch. The Compose file supplies the internal `DATABASE_URL` automatically.
2. Run `docker compose up -d --build`. This starts Postgres, applies migrations once, and starts the web server and worker. Postgres data is stored in the named `postgres_data` volume. Neither Postgres nor the web server is exposed directly to the internet; the web server binds to `127.0.0.1:3000`.
3. Configure your HTTPS reverse proxy to forward to `127.0.0.1:3000`. Allow ports 80/443 and point DNS to the VPS. Do not use `Referrer-Policy: no-referrer` or `same-origin`: WebActivity’s embed needs to see the hosting origin.
4. Watch `docker compose logs -f worker web`. The worker prints totals when a source is fetched: once on startup, then at most every six hours before polls close; on election night, roughly every minute for Toronto and every two minutes for Richmond Hill. Back up the Postgres volume before future upgrades.

For an upgrade: pull the code, run `docker compose up -d --build`, and inspect the migration and worker logs. Do not use `docker compose down -v` unless you intend to delete the database.

## Docker images on GHCR

`.github/workflows/docker-build.yml` uses the same publishing workflow as `ikifar2012/smtpbound`. Pushes to `main` build the Dockerfile and publish `ghcr.io/ikifar2012/our-vote:main`. The workflow can also be run manually from GitHub Actions. It uses the repository's `GITHUB_TOKEN` with package write permission; no separate registry credentials are needed in repository secrets.

The image contains the web server, worker, and migration entrypoints. Compose currently builds and uses `our-vote:local`; adding this workflow does not switch an existing deployment to GHCR or deploy it automatically. Package visibility is managed separately in GitHub Packages; a private package requires authentication to pull.

## Enable Lock Screen tracking

The app is integration-ready; **a real WebActivity account, selected plan, API key, and phone verification are still required**. Deployment and real pushes have not been performed on your behalf.

1. Create a WebActivity account and explicitly select its Free plan if you want no paid usage. Confirm its current allowance in the dashboard: the pricing page calls usage “calls”, while the delivery docs describe **pushes per receiving phone**, including group sends. Budget for per-phone usage until the provider confirms otherwise.
2. Put the key in `WEBACTIVITY_API_KEY` in `.env` and set `LIVE_ACTIVITIES_ENABLED=true`. Set `SITE_URL=https://ourvote.mstep.dev` so phones can download public HTTPS portraits.
3. Restart the web and worker processes (`docker compose up -d --force-recreate web worker` with Compose).
4. The worker creates a separate reusable launch button for each city after **October 26, 2026 at 8 p.m. America/Toronto**, once nonzero votes arrive. Before then each city button explains when tracking opens. A zeroed feed does not produce alphabetical “leaders”.
5. On election night, use a physical iPhone to add the activity, verify candidate names/photos and vote totals fit, and verify a subsequent result update. Android requires the WebActivity app; iPhone can use its App Clip.

The public page uses **Server Actions** in `app/actions/election.ts` for results and activity availability. These actions only read state; public requests cannot create activities or send pushes. The only custom HTTP endpoint is `/api/portrait`, which serves a PNG initials fallback for phones without an available candidate photo.

## Test actual Live Activities before election night

Run `bun run test:setup`, restart the web server, and open `/test`. Sign in with `TEST_ACCESS_TOKEN` from your ignored environment file. Configure Postgres, `WEBACTIVITY_API_KEY`, and a public HTTPS `SITE_URL` for phone delivery. Start a test, add it to your phone, and send sample stages using the private buttons. Each city has its own test audience and saved state; real races are unaffected. `LIVE_ACTIVITIES_ENABLED` can stay off. See [the full test setup and cleanup instructions](docs/activity-test.md), including Docker usage.

## Results and delivery behavior

- Toronto official feed: https://mediaresults.toronto.ca/results/unofficialresult.json
- Toronto source guide: https://www.toronto.ca/city-government/elections/election-results-reports/election-results/live-results-information-for-media/
- Mayor → city-wide ward `0` only. Rank numeric `votesReceived` descending, then candidate name for ties. Select the current top two. Percentages use votes for **all** mayoral candidates.
- Richmond Hill official results: https://electionresults.richmondhill.ca/ — see [the collection notes](docs/richmond-hill.md) for its HTML contract, limitations, and recovery steps.
- A shared scheduler checks persisted `next_fetch_at` values every ten seconds. Before polls close, check at most once every six hours, with a scheduled wake-up at 8 p.m. ET. After that, use a minimum of 60 seconds for Toronto and 120 seconds for Richmond Hill, plus a small positive jitter. Respect cache lifetimes, ETag/Last-Modified validators, and Retry-After.
- A separate PostgreSQL advisory lock per city serializes source requests across worker replicas. Backoff, next-fetch times, and paused status survive restarts. Keep the last good snapshot on network, validation, or upstream failure. Reject older Toronto `seq` values and older Richmond Hill publication timestamps.
- Richmond Hill collection identifies itself, checks robots.txt, and pauses on access denials. No proxy rotation, browser impersonation, cache-busting query strings, or challenge bypass is used.
- The page refreshes saved data once a minute while visible. During results reporting, mark Toronto delayed after three minutes without a successful retrieval and Richmond Hill after six. Richmond Hill’s publisher timestamp is shown separately; published totals older than ten minutes are marked delayed even if the HTML downloads successfully. Retain old results on screen during outages. Before election night, blank source data is an expected waiting state.
- Phone updates default to at most once every **five minutes**, only when the displayed state changes. Set `PUSH_INTERVAL_SECONDS=60` for up to once a minute. That increases per-phone push usage substantially. WebActivity can add up to 45 seconds of delivery delay.
- Ordinary sends use `priority: 5`. **Changing a candidate photo URL restarts the activity and can alert**, even with quiet priority. A switch in the top two can therefore alert. Stable local photo paths avoid unnecessary restarts.
- The native score uses compact votes (for example `125K`), with exact `votesReceived` in each candidate’s status. The provider’s smallest layouts have limited space, so check it on a real phone. Full exact totals are always on the website.
- Both the group and reusable template are refreshed so existing phones and later joiners see updated results. A failed provider request does not discard new election totals. Retrying after an ambiguous network timeout may resend a state: WebActivity does not document an idempotency key.
- All polls/tabulators reporting is labelled “Reported”, not “Winner”. Results remain unofficial until certified. The worker does not automatically remove the final card. iOS stops ordinary updates after eight hours; WebActivity can restart an older activity with an alert.
- Free-plan exhaustion can stop phone delivery. VPS hosting does not remove this provider limit. At five-minute intervals, 250 phones receiving updates for three hours is about 9,000 pushes, before later results/end calls or other usage. No automatic paid upgrade is implemented. Website results keep working independently.

## Candidate photos

Before votes arrive, both city dialogs show candidate rosters with available portraits. Toronto’s remaining names are in an expandable list. Saved feed snapshots take precedence over the fallback rosters in `lib/candidates.ts`; Toronto’s fallback was checked against the official mayoral feed on October 20, 2026. Keep it current if the City changes the list. Roster display does not fetch upstream or select leaders.

The homepage includes an iPhone Lock Screen mockup of the Versus activity captured from the [WebActivity builder](https://webliveactivity.com/builder). Its caption identifies invented sample totals. The image is served locally, so viewing it requires no provider account, iframe, or API call. It is separate from election snapshots and phone delivery. See [PHOTO-CREDITS.md](PHOTO-CREDITS.md) for the portraits used in the composite.

Attributed 400×400 WebP portraits are included for Olivia Chow, Brad Bradford, David West, Domenic Bardari, and Holo Devnani. Bardari and Devnani’s sources do not advertise open photo licenses; their photo rights are separate from MIT. See [PHOTO-CREDITS.md](PHOTO-CREDITS.md) for exact sources, transformations, and rights. Devnani’s available source is low-resolution. They do not affect ranking. Other candidates show initials if they enter the top two; add a reusable photo to `public/candidates/`, register its exact feed name in `lib/candidates.ts`, and update `/credits` and `PHOTO-CREDITS.md`. There is no runtime scraping or guessing at identities.

## Verification

Run `bun run format` to format the code with Prettier. The shared configuration uses two-space indentation, double quotes, and semicolons. Generated migrations, build output, and assets are excluded.

```sh
bun run format:check
bun run lint
bun run build
```

No test suite is included. Before launch, check the production build, migration/worker logs, a mobile browser, the HTTPS image URLs, and actual phone delivery with your account. No deployment, account creation, or DNS changes are performed by the repo.
