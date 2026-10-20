import { ImageResponse } from "next/og";
export const alt =
  "Our Vote — Toronto and Richmond Hill election results on your Lock Screen, October 26, 2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#000",
        color: "#f5f5f7",
        padding: "60px 70px",
        justifyContent: "space-between",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>
        our vote
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 70,
          fontWeight: 700,
          letterSpacing: -3,
        }}
      >
        <div>Election night.</div>
        <div style={{ color: "#929297" }}>On your Lock Screen.</div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 24,
          color: "#929297",
        }}
      >
        <span>Toronto & Richmond Hill · October 26</span>
        <span>ourvote.mstep.dev</span>
      </div>
    </div>,
    size,
  );
}
