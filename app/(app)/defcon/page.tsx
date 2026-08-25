import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DefconBoard, type DefconBoardData } from "@/components/gaffer/boards/DefconBoard";
import { buildDefconWindow, buildSeason } from "@/lib/server/buildBoards";
import { defconThreshold } from "@/lib/engines/performance";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "DEFCON monsters",
  description:
    "Defensive contributions, per-90 rates, how often the two-point threshold is actually cleared, and who is a booking waiting to happen.",
};

/** Gameweeks of live feed read to count real threshold crossings. */
const WINDOW = 5;

export default async function DefconPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  if (!raw || !/^\d+$/.test(raw)) redirect("/?next=/defcon");

  const season = await buildSeason();
  const posOf = new Map(season.players.map((p) => [p.id, p.pos]));
  // Reading the weeks turns "hits" from an upper bound into a real count.
  const window = await buildDefconWindow(
    season.currentGw,
    WINDOW,
    defconThreshold,
    (element) => posOf.get(element) ?? 3,
  ).catch(() => ({ gws: [] as number[], rows: new Map() }));

  const data: DefconBoardData = {
    currentGw: season.currentGw,
    players: season.players,
    window: { gws: window.gws, rows: [...window.rows.values()] },
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="fig-num text-[22px] leading-none">DEFCON monsters</h1>
        <p className="mt-1 max-w-[70ch] text-2xs uppercase-label text-ink-lo">
          Defensive contributions · rates against the line · bookings
        </p>
      </header>
      <DefconBoard data={data} />
    </div>
  );
}
