import { ImageResponse } from "next/og";
import { getEntry, getHistory } from "@/lib/fpl/endpoints";
import { fingerprintStrokes, type GwRecord } from "@/lib/generative/specs";

const size = { width: 1200, height: 630 };

const MUTED = "#87A2BB";
const SURGE = "#2CF2B6";
const FLARE = "#FF525B";
const LINE = "#36597D";
const CORE = "#061A31";

/**
 * E3 — the share card worth sharing: /api/og/dna/{entryId} renders the
 * manager's Season Fingerprint into a 1200×630 card with one hero figure.
 *
 * The geometry comes from the same fingerprintStrokes() the /dna page
 * renders, so what a manager shares is exactly what visitors see — the
 * generative layer's share rule, applied to the acquisition asset. One hero
 * figure (best rank, the number every FPL manager reads first), the team
 * name, a single line. Degrades to the season's length when upstream is
 * quiet — a share never errors.
 *
 * Aggressively cached: an hour serving + a day of stale-while-revalidate,
 * because a crawler share is cold anyway.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ entry: string }> }) {
  const { entry: entryParam } = await params;
  const entryId = Number(entryParam);
  if (!Number.isFinite(entryId) || entryId <= 0) {
    return new Response("bad entry", { status: 400 });
  }
  const cacheHeaders = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };

  let teamName = `Team ${entryId}`;
  let records: GwRecord[] = [];
  try {
    const [entry, history] = await Promise.all([getEntry(entryId), getHistory(entryId)]);
    if (entry.name) teamName = entry.name;
    records = history.current.map((c) => ({
      event: c.event,
      points: c.points,
      overallRank: c.overall_rank,
      chip: history.chips.find((ch) => ch.event === c.event)?.name ?? null,
    }));
  } catch {
    /* degrade to name-only — the share still renders */
  }

  const best = Math.min(...records.map((r) => r.overallRank ?? Infinity));
  const hero =
    records.length > 0 && Number.isFinite(best) ? best.toLocaleString("en-GB") : "—";
  const heroCaption = records.length > 0 && Number.isFinite(best) ? "best overall rank" : "no gameweeks yet";

  const strokes = fingerprintStrokes(entryId, records);
  const c = 110;
  const r0 = 110 * 0.42;
  const rMax = 96;
  const scale = 2.3; // viewBox 220 → 506px on the card

  const spokes = strokes.map((s, i) => {
    const a = s.angle;
    const rr1 = r0 + (rMax - r0 - 4) * (0.25 + 0.75 * s.length) * (0.55 + 0.45 * s.magnitude);
    return (
      <line
        key={i}
        x1={(c + Math.cos(a) * r0) * scale}
        y1={(c + Math.sin(a) * r0) * scale}
        x2={(c + Math.cos(a) * rr1) * scale}
        y2={(c + Math.sin(a) * rr1) * scale}
        stroke={s.tone === "surge" ? SURGE : s.tone === "flare" ? FLARE : LINE}
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.9}
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
        <svg width="506" height="506" viewBox="0 0 220 220" style={{ position: "absolute", top: -120 }}>
          <circle cx={c * scale} cy={c * scale} r={r0 * scale} fill="none" stroke={LINE} strokeWidth={scale / 2} />
          {spokes}
          <circle cx={c * scale} cy={c * scale} r={10 * scale} fill={CORE} stroke="#9DF0FF" strokeWidth={1.5 * scale} />
        </svg>
        <div
          style={{
            marginTop: 400,
            fontSize: 34,
            color: MUTED,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Season fingerprint
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 64,
            fontWeight: 800,
            color: "#EFF8FF",
            letterSpacing: "-0.02em",
            textAlign: "center",
            padding: "0 60px",
          }}
        >
          {teamName}
        </div>
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "baseline",
            gap: 18,
          }}
        >
          <span style={{ fontSize: 80, fontWeight: 900, fontStyle: "italic", color: "#0AD0FF" }}>
            {hero}
          </span>
          <span style={{ fontSize: 28, color: MUTED }}>{heroCaption} · FPL Gaffer</span>
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