"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  initials,
  portraits,
  RICHMOND_HILL_CANDIDATES,
} from "@/lib/candidates";
import { CITIES, ELECTIONS } from "@/lib/elections";
import { getElectionResults, getLiveActivity } from "@/app/actions/election";
import type {
  ActivityStatus,
  Candidate,
  City,
  PublicResults,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const number = new Intl.NumberFormat("en-CA");

function Ballot({ small = false }: { small?: boolean }) {
  return (
    <svg
      width={small ? 17 : 28}
      height={small ? 17 : 28}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m8 10 4 4 8-8"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 5H4.5A1.5 1.5 0 0 0 3 6.5v17A1.5 1.5 0 0 0 4.5 25h19a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 23.5 5H23M8 20h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Avatar({
  candidate,
}: {
  candidate?: Pick<Candidate, "name" | "photo">;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="avatar">
      {candidate?.photo && !failed ? (
        <Image
          src={candidate.photo}
          alt={candidate.name}
          width={58}
          height={58}
          onError={() => setFailed(true)}
        />
      ) : candidate ? (
        initials(candidate.name)
      ) : (
        <svg
          width="26"
          height="26"
          viewBox="0 0 26 26"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="13"
            cy="9"
            r="4"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M5 23v-2a8 8 0 0 1 16 0v2"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      )}
    </span>
  );
}

export function Election() {
  const [data, setData] = useState<Partial<Record<City, PublicResults>>>({});
  const [activities, setActivities] = useState<
    Partial<Record<City, ActivityStatus | null>>
  >({});
  const [failed, setFailed] = useState<Partial<Record<City, boolean>>>({});
  const [selectedCity, setSelectedCity] = useState<City>("toronto");
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;
    async function refresh() {
      if (document.hidden || refreshing) return;
      refreshing = true;
      const updates = await Promise.all(
        CITIES.map(async (city) => {
          const [results, activity] = await Promise.allSettled([
            getElectionResults(city),
            getLiveActivity(city),
          ]);
          return { city, results, activity };
        }),
      );
      refreshing = false;
      if (cancelled) return;
      for (const { city, results, activity } of updates) {
        if (results.status === "fulfilled" && results.value.results) {
          setData((previous) => ({ ...previous, [city]: results.value }));
          setFailed((previous) => ({ ...previous, [city]: false }));
        } else setFailed((previous) => ({ ...previous, [city]: true }));
        setActivities((previous) => ({
          ...previous,
          [city]: activity.status === "fulfilled" ? activity.value : null,
        }));
      }
    }
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const selectedElection = ELECTIONS[selectedCity];
  const activity = activities[selectedCity];
  const hasSelectedVotes = Boolean(data[selectedCity]?.results?.totalVotes);
  const openCity = (city: City) => {
    setSelectedCity(city);
    setOpened(true);
  };

  return (
    <>
      <main className="home">
        <nav className="topbar" aria-label="Main navigation">
          <Link className="wordmark" href="/">
            <Ballot small />
            Our Vote
          </Link>
          <Link href="/credits">About</Link>
        </nav>
        <header className="page-heading">
          <p className="election-date">October 26, 2026</p>
          <h1>
            Mayoral results.
            <br />
            On your Lock Screen.
          </h1>
          <p>Follow your city as the votes come in.</p>
        </header>

        <figure className="activity-preview">
          <Image
            src="/previews/toronto-iphone.png"
            alt="iPhone Lock Screen showing an example Toronto Live Activity with Olivia Chow and Brad Bradford’s photos and sample vote totals."
            width={1022}
            height={2090}
            sizes="(max-width: 328px) calc(100vw - 48px), 280px"
          />
          <figcaption>
            <span>Example · Sample votes</span>
            <a href="https://webliveactivity.com/builder">
              WebActivity preview
            </a>
          </figcaption>
        </figure>

        <section
          className="settings-section"
          aria-labelledby="activities-heading"
        >
          <h2 id="activities-heading" className="section-label">
            Choose your city
          </h2>
          <div className="settings-group city-actions">
            <Button
              variant="ghost"
              className="city-row toronto"
              onClick={() => openCity("toronto")}
              aria-label="Follow Toronto mayoral election"
            >
              <span className="city-icon toronto-icon" aria-hidden="true">
                <svg width="23" height="28" viewBox="0 0 23 28" fill="none">
                  <path
                    d="M11.5 1v7m-3 4h6m-3-4-2 5 2 13 2-13-2-5ZM3 26h17M4 26V16h3m9 10V13h4v13"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="city-copy">
                <span className="city-name">Toronto</span>
                <span className="city-description">Mayoral election</span>
              </span>
              <svg
                className="chevron"
                width="9"
                height="15"
                viewBox="0 0 9 15"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m2 2 5 5.5L2 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
            <Separator className="city-separator" />
            <Button
              variant="ghost"
              className="city-row richmond"
              onClick={() => openCity("richmond-hill")}
              aria-label="Follow Richmond Hill mayoral election"
            >
              <span className="city-icon richmond-icon" aria-hidden="true">
                <svg width="23" height="25" viewBox="0 0 23 25" fill="none">
                  <path
                    d="M3 23h17M5 23V11h13v12M3 11l8.5-7L20 11M9 23v-7h5v7M11.5 4V1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="city-copy">
                <span className="city-name">Richmond Hill</span>
                <span className="city-description">Mayoral election</span>
              </span>
              <svg
                className="chevron"
                width="9"
                height="15"
                viewBox="0 0 9 15"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m2 2 5 5.5L2 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
          </div>
          <p className="section-note">
            Results begin after polls close October 26 at 8 p.m. ET.
          </p>
        </section>

        {CITIES.map((city) => {
          const snapshot = data[city];
          const results = snapshot?.results;
          if (!snapshot || !results?.totalVotes) return null;
          const election = ELECTIONS[city];
          const stale = snapshot.stale || failed[city];
          const reported =
            results.polls > 0 && results.pollsReceived === results.polls;
          const checked = snapshot.checkedAt
            ? new Date(snapshot.checkedAt).toLocaleTimeString("en-CA", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/Toronto",
              })
            : null;
          const sourceUpdated = results.sourceUpdatedAt
            ? new Date(results.sourceUpdatedAt).toLocaleString("en-CA", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/Toronto",
              })
            : null;
          return (
            <section
              className="settings-section"
              aria-labelledby={`${city}-results-heading`}
              key={city}
            >
              <h2 className="section-label" id={`${city}-results-heading`}>
                {election.name} results{" "}
                <span>{stale ? "Updates delayed" : "Unofficial"}</span>
              </h2>
              <div className="settings-group results-group">
                {results.candidates.slice(0, 2).map((candidate) => (
                  <div className="result-row" key={candidate.name}>
                    <Avatar candidate={candidate} />
                    <span className="result-name">{candidate.name}</span>
                    <span className="result-votes">
                      {number.format(candidate.votesReceived)}
                      <span>votes</span>
                    </span>
                  </div>
                ))}
                <div className="polls-row">
                  <span>
                    {reported
                      ? `All ${election.reportingUnit} reported`
                      : `${city === "richmond-hill" ? "Tabulators" : "Polls"} reporting`}
                  </span>
                  <span>
                    {number.format(results.pollsReceived)} of{" "}
                    {number.format(results.polls)}
                  </span>
                </div>
              </div>
              <p className="section-note">
                {stale ? "Showing the last available results. " : ""}Last
                checked {checked} ET.
                {sourceUpdated ? ` Source updated ${sourceUpdated} ET.` : ""}
              </p>
            </section>
          );
        })}

        <Separator className="section-separator" />
        <section
          className="settings-section how-section"
          aria-labelledby="instructions-heading"
        >
          <h2 className="section-label" id="instructions-heading">
            How to follow
          </h2>
          <ol className="settings-group instructions">
            <li>
              <span className="step">1</span>Choose your city.
            </li>
            <li>
              <span className="step">2</span>Add the Live Activity.
            </li>
            <li>
              <span className="step">3</span>Follow along on your Lock Screen.
            </li>
          </ol>
          <p className="section-note">
            iPhone uses WebActivity’s App Clip.
            <br />
            Android requires the WebActivity app.
          </p>
        </section>

        <footer className="site-footer">
          <nav aria-label="More information">
            <a href={ELECTIONS.toronto.resultsUrl}>Toronto results</a>
            <span aria-hidden="true" />
            <a href={ELECTIONS["richmond-hill"].resultsUrl}>
              Richmond Hill results
            </a>
            <span aria-hidden="true" />
            <Link href="/credits">Credits & privacy</Link>
          </nav>
          <p>
            An independent, open-source project by{" "}
            <a href="https://mstep.dev">mstep</a>.
          </p>
        </footer>
      </main>

      <Dialog open={opened} onOpenChange={setOpened}>
        <DialogContent className="launch-dialog">
          <DialogHeader>
            <DialogTitle>Follow {selectedElection.name}</DialogTitle>
            <DialogDescription>
              {activity?.status === "ready"
                ? "Add the mayoral race to your Lock Screen."
                : "Results begin October 26 at 8 p.m. ET."}
            </DialogDescription>
          </DialogHeader>
          {activity?.status === "ready" && activity.embedUrl ? (
            <>
              <iframe
                className="launch-frame"
                title={`Add ${selectedElection.name} results with WebActivity`}
                src={activity.embedUrl}
                width="340"
                height="110"
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <p className="dialog-note">
                On a computer, scan the QR code with your phone. Updates arrive
                up to every {activity.intervalMinutes} minutes when results
                change. A change in candidates or photos may alert your phone.
              </p>
            </>
          ) : (
            <p className="dialog-note">
              {hasSelectedVotes
                ? "Lock Screen tracking is temporarily unavailable. The latest available results are on this page."
                : activity?.status === "waiting"
                  ? "Tracking opens when the first votes arrive. Come back on election night to add it."
                  : "Lock Screen tracking isn’t available yet. Check back on election night."}
            </p>
          )}
          {selectedCity === "richmond-hill" && !hasSelectedVotes && (
            <section
              className="candidate-roster"
              aria-label="Richmond Hill mayoral candidates"
            >
              <h3>Candidates</h3>
              {RICHMOND_HILL_CANDIDATES.map((name) => (
                <div className="roster-row" key={name}>
                  <Avatar
                    candidate={{ name, photo: portraits[name] ?? null }}
                  />
                  <span>{name}</span>
                </div>
              ))}
              <p className="dialog-note">
                The two candidates with the most votes will appear in the Live
                Activity.
              </p>
            </section>
          )}
          <a className="source-link" href={selectedElection.informationUrl}>
            {selectedElection.name} election information
          </a>
        </DialogContent>
      </Dialog>
    </>
  );
}
