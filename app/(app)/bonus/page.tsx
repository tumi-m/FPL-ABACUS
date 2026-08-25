import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BonusBoard, type BonusBoardData } from "@/components/gaffer/boards/BonusBoard";
import { buildBonusWindow, buildSeason } from "@/lib/server/buildBoards";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bonus",
  description:
    "Who actually takes the 1·2·3 — season totals, the three-two-one split across recent gameweeks, and how much BPS each bonus point cost.",
};

/** Gameweeks of live feed read for the 3·2·1 split. */
const WINDOW = 5;

export default async function BonusPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  if (!raw || !/^\d+$/.test(raw)) redirect("/?next=/bonus");

  const season = await buildSeason();
  // The split needs the weeks themselves; a failed week drops out of the
  // window rather than being counted as nobody scoring.
  const window = await buildBonusWindow(season.currentGw, WINDOW).catch(() => ({
    gws: [] as number[],
    rows: new Map(),
  }));

  const data: BonusBoardData = {
    currentGw: season.currentGw,
    players: season.players,
    window: { gws: window.gws, rows: [...window.rows.values()] },
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="fig-num text-[22px] leading-none">Bonus</h1>
        <p className="mt-1 max-w-[70ch] text-2xs uppercase-label text-ink-lo">
          The 1·2·3 · who takes it, how, and what it cost them in BPS
        </p>
      </header>
      <BonusBoard data={data} />
    </div>
  );
}
