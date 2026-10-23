"use client";

import Image from "next/image";
import { useState } from "react";
import { androidLaunchLinks } from "@/lib/android-launch";

export function AndroidLaunch({ embedUrl }: { embedUrl: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const embed = new URL(embedUrl);
  const links = androidLaunchLinks(
    embed.searchParams.get("userId") || "",
    embed.searchParams.get("o") || "",
  );
  if (!links) return null;

  return (
    <details
      className="android-launch"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          const url = new URL(links.path, window.location.origin);
          setQr(
            `https://api.webliveactivity.com/api/qr?data=${encodeURIComponent(url.href)}`,
          );
        }
      }}
    >
      <summary>Using Android?</summary>
      <p>
        <a className="source-link" href={links.path}>
          Open Android setup
        </a>{" "}
        on your phone, or scan this QR code. WebActivity must be installed.
      </p>
      {qr && (
        <Image
          src={qr}
          alt="Scan with an Android phone to open Our Vote setup"
          width={220}
          height={220}
          unoptimized
        />
      )}
    </details>
  );
}
