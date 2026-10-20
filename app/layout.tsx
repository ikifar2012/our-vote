import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://ourvote.mstep.dev"),
  title: "Our Vote — Election night, on your Lock Screen",
  description:
    "Follow Toronto and Richmond Hill mayoral results on your Lock Screen. Free to follow. Open source. Results begin October 26, 2026 at 8 p.m. ET.",
  openGraph: {
    title: "Our Vote",
    description:
      "Election night, on your Lock Screen. Toronto and Richmond Hill · October 26.",
    type: "website",
    locale: "en_CA",
  },
  twitter: { card: "summary_large_image" },
};
export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA" className="dark">
      <body>{children}</body>
    </html>
  );
}
