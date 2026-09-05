import { ImageResponse } from "next/og";
import { buildMatchday } from "@/lib/server/buildMatchday";
import { sigilGlyphs, type SigilSwing } from "@/lib/generative/specs";

const size = { width: 1200, height: 630 };

/** Palette mirrors the OG dark theme (raw hex is allowed here as OG art,
 *  mirroring the existing field OG card). */
const MUTED = "#87A2BB";
const SURGE = "#2CF2B6";
const FLARE = "#FF525B";
const LINE = "#36597D";
const CORE = "#061A31";

/**
 * E1's share surface: /api/og/film/{entryId} — one gameweek's swing sequence
 * as the sigil glyph. The geometry comes from the same sigilGlyphs() the app
 * renders, so screenshot, app and OG image agree by construction.
 *
 * Degrades to the empty dial when the matchday cannot be built — a share
 * never errors, it shows less. Ten-minute cache like the field card.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ entry: string }> }) {
  const { entry: entryParam } = await params;
  const entryId = Number(entryParam);
  if (!Number.isFinite(entryId) || entryId <= 0) {
    return new Response("bad entry", { status: 400 });
  }
  const cacheHeaders = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" };

  let gw: number | null = null;
  let points: number | null = null;
  let swings: SigilSwing[] = [];
  const res = await buildMatchday(entryId);
  if (res.ok) {
    gw = res.model.event.id;
    points = Math.round(
      res.model.squad.filter((s) => !s.onBench).reduce((sum, s) => sum + s.livePoints, 0),
    );
    swings = res.model.swings.slice(0, 30).map((s) => ({
      minute: s.minute,
      delta: s.ranksGained,
      yours: s.yourMultiplier > 0,
    }));
  }

  // Same function, same seed, same glyph — the share rule made testable.
  const glyphs = sigilGlyphs(entryId * 1000 + (gw ?? 0), swings);
  const c = 110;
  const r0 = 34;
  const rMax = 92;
  const scale = 2.55; // viewBox 220 → 561px on the card

  const strokes = glyphs.map((g, i) => {
    const x1 = (c + Math.cos(g.angle) * r0) * scale;
    const y1 = (c + Math.sin(g.angle) * r0) * scale;
    const r1 = r0 + (rMax - r0) * g.reach;
    const x2 = (c + Math.cos(g.angle) * r1) * scale;
    const y2 = (c + Math.sin(g.angle) * r1) * scale;
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={g.tone === "surge" ? SURGE : g.tone === "flare" ? FLARE : MUTED}
        strokeWidth={g.yours ? 8 : 4}
        strokeLinecap="round"
        opacity={g.yours ? 0.95 : 0.45}
      />
    );
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(178deg, #08213D, #030F22 78%)",
          position: "relative",
        }}
      >
        <svg width="561" height="561" viewBox="0 0 220 220" style={{ position: "absolute", top: -40 }}>
          {/* the minute dial */}
          <circle cx={c * scale} cy={c * scale} r={r0 * scale} fill="none" stroke={LINE} strokeWidth={scale / 2} />
          <circle cx={c * scale} cy={c * scale} r={rMax * scale} fill="none" stroke={LINE} strokeWidth={scale / 2} strokeDasharray={`${2 * scale} ${6 * scale}`} />
          <line
            x1={c * scale}
            y1={(c - r0) * scale}
            x2={c * scale}
            y2={(c - rMax) * scale}
            stroke={LINE}
            strokeWidth={scale / 2}
            opacity="0.5"
          />
          {strokes}
          <circle cx={c * scale} cy={c * scale} r={10 * scale} fill={CORE} stroke="#9DF0FF" strokeWidth={1.5 * scale} />
        </svg>
        <div
          style={{
            marginTop: 560,
            fontSize: 34,
            color: MUTED,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          {gw != null ? `GW${gw} · The swing sequence` : "The swing sequence"}
        </div>
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "baseline",
            gap: 18,
          }}
        >
          {points != null && (
            <span style={{ fontSize: 76, fontWeight: 900, fontStyle: "italic", color: "#0AD0FF" }}>
              {points}
            </span>
          )}
          <span style={{ fontSize: 28, color: MUTED }}>points · angle = minute, length = swing</span>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 40,
            width: 220,
            height: 6,
            background: "#0AD0FF",
            borderRadius: 3,
          }}
        />
      </div>
    ),
    { ...size, headers: cacheHeaders },
  );
}