import Link from "next/link";
import { androidLaunchLinks } from "@/lib/android-launch";
import { buttonVariants } from "@/components/ui/button";

export function AndroidSetup({
  userId,
  origin,
}: {
  userId: string;
  origin: string;
}) {
  const links = androidLaunchLinks(userId, origin);

  return (
    <main className="test-page test-login">
      <Link href="/" className="source-link">
        Back to Our Vote
      </Link>
      <h1>Follow on Android</h1>
      {links ? (
        <>
          <p>
            Install WebActivity, then return here to add this Live Activity.
          </p>
          <p>
            <a className="source-link" href={links.play}>
              Get WebActivity on Google Play
            </a>
          </p>
          <a className={buttonVariants()} href={links.intent}>
            Open WebActivity
          </a>
          <p>
            Powered by{" "}
            <a className="source-link" href="https://webliveactivity.com">
              WebActivity
            </a>
          </p>
        </>
      ) : (
        <p>
          This activity link is invalid. Scan a fresh QR code from Our Vote.
        </p>
      )}
    </main>
  );
}
