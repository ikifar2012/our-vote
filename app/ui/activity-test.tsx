"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  getTestStatus,
  sendActivityTest,
  signInToTest,
  signOutOfTest,
} from "@/app/actions/activity-test";
import { Button } from "@/components/ui/button";
import { TEST_STAGES } from "@/lib/test-scenarios";
import { CITIES, ELECTIONS } from "@/lib/elections";
import { initials } from "@/lib/candidates";
import type { TestStatus } from "@/lib/activity-test";
import type { City } from "@/lib/types";

const number = new Intl.NumberFormat("en-CA");

export function TestLogin() {
  const [state, action, pending] = useActionState(signInToTest, { error: "" });
  return (
    <main className="test-page test-login">
      <Link href="/" className="source-link">
        Back to Our Vote
      </Link>
      <h1>Live Activity Test</h1>
      <p>
        Private controls for sending fictional election results to test phones.
      </p>
      <form action={action}>
        <label htmlFor="test-access-token">Test access token</label>
        <input
          id="test-access-token"
          name="accessToken"
          type="password"
          required
          maxLength={256}
          autoComplete="current-password"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Open test controls"}
        </Button>
        {state.error && <p role="alert">{state.error}</p>}
      </form>
    </main>
  );
}

export function ActivityTest() {
  const [city, setCity] = useState<City>("toronto");
  const [status, setStatus] = useState<TestStatus | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(0);
  const election = ELECTIONS[city];
  const remaining = status?.nextSendAt
    ? Math.max(0, Math.ceil((Date.parse(status.nextSendAt) - now) / 1000))
    : 0;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const next = await getTestStatus(city);
        if (!cancelled) {
          setStatus(next);
          setNow(Date.now());
        }
      } catch {
        if (!cancelled)
          setMessage(
            "Your session may have expired. Reload and sign in again.",
          );
      }
    }
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [city]);

  function send(stage: string) {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await sendActivityTest(city, stage);
        setStatus(result.status);
        setMessage(result.message);
        setNow(Date.now());
      } catch {
        setMessage("Unable to send. Reload and sign in again before retrying.");
      }
    });
  }

  return (
    <main className="test-page">
      <nav className="topbar" aria-label="Test navigation">
        <Link href="/" className="wordmark">
          Our Vote
        </Link>
        <form action={signOutOfTest}>
          <Button variant="ghost" type="submit">
            Sign out
          </Button>
        </form>
      </nav>
      <header className="test-heading">
        <span className="test-label">Private · Fictional results</span>
        <h1>Live Activity Test</h1>
        <p>
          Send real updates to your test phone. The election activities stay
          separate.
        </p>
      </header>
      <div className="test-layout">
        <section
          className="test-controls"
          aria-label="Live Activity test controls"
        >
          <h2>Choose a city</h2>
          <div className="test-city-buttons">
            {CITIES.map((value) => (
              <Button
                key={value}
                disabled={pending}
                variant={city === value ? "default" : "outline"}
                aria-pressed={city === value}
                onClick={() => {
                  setCity(value);
                  setStatus(null);
                  setMessage("");
                }}
              >
                {ELECTIONS[value].name}
              </Button>
            ))}
          </div>
          <h2>{status?.embedUrl ? "Send a test update" : "Start a test"}</h2>
          <div className="test-stages">
            {TEST_STAGES.map((stage) => (
              <Button
                key={stage.id}
                variant="outline"
                disabled={pending || !status?.ready || remaining > 0}
                onClick={() => send(stage.id)}
              >
                {stage.label}
              </Button>
            ))}
          </div>
          {remaining > 0 && (
            <p className="test-caption" role="status">
              Next send in {remaining}s.
            </p>
          )}
          <Button
            className="test-end"
            variant="destructive"
            disabled={pending || !status?.embedUrl}
            onClick={() => send("end")}
          >
            End this city’s test
          </Button>
          <p className="test-caption">
            Start with “First results”, add it to your phone, then send “Lead
            change” or another stage. Wait a minute between sends. Ending
            removes only this city’s test activity.
          </p>
          <p className="test-caption">
            These are real WebActivity calls and use your push allowance. Phone
            delivery can take up to 45 seconds. A candidate/photo change can
            restart the card and alert.
          </p>
          {status?.message && <p role="status">{status.message}</p>}
          {status?.lastError && (
            <p role="alert">Last delivery error: {status.lastError}</p>
          )}
          {message && (
            <p className="test-message" role="status">
              {message}
            </p>
          )}
        </section>
        <section className="test-phone" aria-labelledby="test-phone-heading">
          <h2 id="test-phone-heading">{election.name} test activity</h2>
          {status?.embedUrl ? (
            <>
              <iframe
                key={`${city}-${status.embedUrl}`}
                className="launch-frame"
                title={`Add ${election.name} test activity`}
                src={status.embedUrl}
                width="340"
                height="110"
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <p className="test-caption">
                Tap on your phone, or scan the QR code from your computer. The
                native activity is labelled TEST.
              </p>
            </>
          ) : (
            <p className="test-caption">
              {status
                ? "Send a stage to create the launch button for your phone."
                : "Checking test configuration…"}
            </p>
          )}
          {status?.results && (
            <div className="test-snapshot">
              <h3>Last successfully sent</h3>
              {status.results.totalVotes === 0 ? (
                <p>Waiting for sample votes.</p>
              ) : (
                <>
                  {status.results.candidates.map((candidate) => (
                    <div className="result-row" key={candidate.name}>
                      <span className="avatar">
                        {candidate.photo ? (
                          <Image
                            src={candidate.photo}
                            alt={candidate.name}
                            width={58}
                            height={58}
                          />
                        ) : (
                          initials(candidate.name)
                        )}
                      </span>
                      <span className="result-name">{candidate.name}</span>
                      <span className="result-votes">
                        {number.format(candidate.votesReceived)}
                        <span>{candidate.percentage.toFixed(1)}%</span>
                      </span>
                    </div>
                  ))}
                  <p className="test-caption">
                    {number.format(status.results.pollsReceived)} of{" "}
                    {number.format(status.results.polls)}{" "}
                    {election.reportingUnit} reporting.
                  </p>
                </>
              )}
            </div>
          )}
        </section>
      </div>
      <footer className="site-footer">
        <p>
          Test audiences and saved results are isolated from the real races. No
          election feeds are downloaded here.
        </p>
        <p>
          By <a href="https://mstep.dev">Matheson Steplock</a>.
        </p>
      </footer>
    </main>
  );
}
