import { ImageResponse } from "next/og";
import { getEntry } from "@/lib/fpl/endpoints";
import { buildMatchday } from "@/lib/server/buildMatchday";

const size = { width: 1200, height: 630 };

/** Per-entry share card: /api/og/field/{entryId}. Degrades to name-only when
 *  picks or upstream are unavailable — never errors the share. */
export async function GET(_req: Request, { params }: { params: Promise<{ entry: string }> }) {
  const { entry: entryParam } = await params;
  const entryId = Number(entryParam);
  if (!Number.isFinite(entryId) || entryId <= 0) {
    return new Response("bad entry", { status: 400 });
  }

  let teamName = `Team ${entryId}`;
  let gw: number | null = null;
  let points: number | null = null;
  let rank: number | null = null;

  try {
    const entry = await getEntry(entryId);
    if (entry.name) teamName = entry.name;
  } catch {
    /* name stays the fallback */
  }
  try {
    const result = await buildMatchday(entryId);
    if (result.ok) {
      gw = result.model.event.id;
      points = Math.round(
        result.model.squad.filter((s) => !s.onBench).reduce((sum, s) => sum + s.livePoints, 0),
      );
      rank = result.model.hero.officialLiveRank ?? null;
    }
  } catch {
    /* card renders without the live figures */
  }

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
        <div
          style={{
            position: "absolute",
            top: -140,
            left: "50%",
            transform: "translateX(-50%)",
            width: 900,
            height: 500,
            background: "radial-gradient(ellipse at center, rgba(157,240,255,.22), transparent 65%)",
          }}
        />
        <div
          style={{
            fontSize: 34,
            color: "#87A2BB",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          {gw != null ? `GW${gw} · The Field` : "The Field"}
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 72,
            fontWeight: 800,
            color: "#EFF8FF",
            letterSpacing: "-0.02em",
            textAlign: "center",
            padding: "0 60px",
          }}
        >
          {teamName}
        </div>
        {points != null && (
          <div
            style={{
              marginTop: 24,
              display: "flex",
              alignItems: "baseline",
              gap: 18,
            }}
          >
            <span style={{ fontSize: 96, fontWeight: 900, fontStyle: "italic", color: "#0AD0FF" }}>
              {points}
            </span>
            <span style={{ fontSize: 30, color: "#87A2BB" }}>points{rank != null ? ` · rank ${rank.toLocaleString("en-GB")}` : ""}</span>
          </div>
        )}
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
    size,
  );
}
