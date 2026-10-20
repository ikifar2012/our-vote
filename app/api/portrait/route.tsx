import { ImageResponse } from "next/og";
import { initials } from "@/lib/candidates";

export async function GET(request: Request) {
  const name = (new URL(request.url).searchParams.get("name") || "?").slice(
    0,
    80,
  );
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: "#242426",
        color: "#ffffff",
        fontSize: 140,
        fontWeight: 600,
      }}
    >
      {initials(name)}
    </div>,
    {
      width: 400,
      height: 400,
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}
