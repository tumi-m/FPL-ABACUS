import { Barlow, Saira } from "next/font/google";

/**
 * FLOODLIGHT rev-02 type system, self-hosted.
 *
 * These used to arrive as a render-blocking <link> to fonts.googleapis.com —
 * two extra DNS/TLS round trips before a single glyph could paint. next/font
 * inlines the @font-face rules and serves the woff2 from our own origin, so
 * the critical path is shorter and the fallback metrics are size-adjusted
 * (no layout shift when the real face lands).
 *
 * Saira carries every figure and keeps its width axis (`wdth`) — .fig-num and
 * .hero-figure ride it. Barlow carries everything you read.
 */
export const saira = Saira({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["wdth"],
  variable: "--font-saira",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const barlow = Barlow({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const fontClassName = `${saira.variable} ${barlow.variable}`;
