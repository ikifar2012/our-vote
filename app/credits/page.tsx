import Link from "next/link";
export const metadata = { title: "Credits — Our Vote" };
export default function Credits() {
  return (
    <main className="credits">
      <Link href="/">Back to Our Vote</Link>
      <h1>Credits & privacy</h1>
      <h2>Election results</h2>
      <p>
        Unofficial results are supplied by{" "}
        <a href="https://www.toronto.ca/city-government/elections/election-results-reports/election-results/live-results-information-for-media/">
          Toronto Elections
        </a>{" "}
        and the{" "}
        <a href="https://electionresults.richmondhill.ca/">
          City of Richmond Hill
        </a>
        . Our Vote is an independent project and is not affiliated with any city
        or candidate. A lead is not a declared win. Even when all polls report,
        results remain unofficial until certified by the City.
      </p>
      <h2>Candidate photos</h2>
      <p>
        Olivia Chow:{" "}
        <a href="https://commons.wikimedia.org/wiki/File:Olivia_Chow_at_the_2024_Toronto_International_Film_Festival.jpg">
          Frank Sun / WikiPortraits, Wikimedia Commons
        </a>
        ,{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">
          CC BY-SA 4.0
        </a>
        . Cropped to a square, resized, and converted to WebP. This adapted
        photo remains under CC BY-SA 4.0.
      </p>
      <p>
        Brad Bradford:{" "}
        <a href="https://commons.wikimedia.org/wiki/File:BB2026_Headshot1.jpg">
          Laryssa WH, Wikimedia Commons
        </a>
        ,{" "}
        <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 1.0</a>
        . Cropped to a square, resized, and converted to WebP.
      </p>
      <p>
        David West:{" "}
        <a href="https://commons.wikimedia.org/wiki/File:David_West_mayor.jpg">
          OhanaUnited, Wikimedia Commons
        </a>
        ,{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">
          CC BY-SA 4.0
        </a>
        . Cropped to a square, resized, and converted to WebP. This adapted
        photo remains under CC BY-SA 4.0.
      </p>
      <p>
        Domenic Bardari: portrait from{" "}
        <a href="https://domenicformayor.ca/about-domenic/">
          his campaign’s about page
        </a>
        . Holo Devnani: portrait from{" "}
        <a href="https://strongrh.ca/candidate/devnani-holo/">
          his Strong Richmond Hill candidate profile
        </a>
        . Both are cropped and resized to identify candidates. Their sources do
        not state an open reuse license; these photos are not covered by the MIT
        code license. Rights remain with their respective owners.
      </p>
      <p>
        Other candidates show initials until a reusable portrait is available.
        Photos identify candidates and do not imply endorsement.
      </p>
      <h2>Live Activities</h2>
      <p>
        Delivered by <a href="https://webliveactivity.com/">WebActivity</a>.
        Adding an activity connects your phone to their service. Read{" "}
        <a href="https://webliveactivity.com/docs/live-activities/guides/privacy">
          their data and privacy documentation
        </a>{" "}
        before adding one.
      </p>
      <p>
        The homepage mockup was captured from WebActivity’s{" "}
        <a href="https://webliveactivity.com/builder">Versus builder</a> with
        our candidate portraits. Its vote totals and reporting percentage are
        invented examples, not election results. The portraits retain the
        credits and licenses above.
      </p>
      <h2>Your privacy</h2>
      <p>
        Our Vote has no accounts, advertising, or analytics. We store shared
        election totals and activity configuration, not individual device
        identifiers. The hosting server may retain ordinary access logs.
        WebActivity handles device delivery under its own privacy policy.
      </p>
      <h2>Open source</h2>
      <p>
        Our Vote’s code is licensed under MIT. Candidate photos retain the
        separate licenses listed above.
      </p>
    </main>
  );
}
