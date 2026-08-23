import "server-only";

/**
 * Shared builder for the BoardDesk staging component — used by the Board and
 * by the Field's Planner mode so there is one source of desk truth.
 */
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { getFixturesAll, getHistory, getPicks } from "@/lib/fpl/endpoints";
import type { DeskCandidate, DeskSquadRow } from "@/components/gaffer/board/BoardDesk";

export interface BoardDeskProps {
  teamId: number;
  squad: DeskSquadRow[];
  candidates: DeskCandidate[];
  gws: number[];
  currentGw: number;
  wallGw: number | null;
  chips: { key: string; label: string; stopEvent: number }[];
  bankTenths: number;
}

export async function buildBoardDesk(
  teamId: number,
  opts: { fixtures?: Awaited<ReturnType<typeof getFixturesAll>> } = {},
): Promise<BoardDeskProps | null> {
  const boot = await getBootstrapLite();
  const currentGw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);

  let squadIds: number[] = [];
  const sellPrices = new Map<number, number>();
  try {
    const picks = await getPicks(teamId, currentGw, true);
    squadIds = picks.picks.map((p) => p.element);
    for (const p of picks.picks) {
      if (p.selling_price != null) sellPrices.set(p.element, p.selling_price);
    }
  } catch {
    return null;
  }

  const workRows = squadIds
    .map((id) => boot.elements[id])
    .filter((el): el is NonNullable<typeof el> => el != null);

  const squadSet = new Set(squadIds);
  const deskSquad: DeskSquadRow[] = workRows.map((el) => ({
    element: el.id,
    webName: el.web_name,
    pos: el.element_type,
    nowCost: el.now_cost,
    sellPrice: sellPrices.get(el.id) ?? null,
    epNext: el.ep_next,
  }));
  const candidates: DeskCandidate[] = Object.values(boot.elements)
    .filter((e) => !squadSet.has(e.id))
    .sort((a, b) => b.total_points - a.total_points)
    .slice(0, 50)
    .map((e) => ({
      id: e.id,
      webName: e.web_name,
      pos: e.element_type,
      nowCost: e.now_cost,
      epNext: e.ep_next,
    }));

  let bankTenths = 0;
  try {
    const history = await getHistory(teamId);
    bankTenths = history.current[history.current.length - 1]?.bank ?? 0;
  } catch {
    bankTenths = 0;
  }

  void (opts.fixtures ?? (await getFixturesAll().catch(() => [])));

  const wallGw = boot.chips.length ? Math.min(...boot.chips.map((ch) => ch.stop_event)) : null;

  // Horizon: current GW + next 5, matching the Field's planning frame.
  const gws = boot.events.filter((e) => e.id >= currentGw).slice(0, 6).map((g) => g.id);

  return {
    teamId,
    squad: deskSquad,
    candidates,
    gws,
    currentGw,
    wallGw,
    chips: boot.chips
      .map((ch) => ({ key: chipKey(ch.name, ch.number), label: chipLabel(ch.name), stopEvent: ch.stop_event }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    bankTenths,
  };
}

function chipKey(name: string, number: number): string {
  if (name === "wildcard") return number === 1 ? "wc1" : "wc2";
  if (name === "freehit") return "fh";
  if (name === "bboost") return "bb";
  return `chip-${number}`;
}

function chipLabel(name: string): string {
  switch (name) {
    case "wildcard":
      return "Wildcard";
    case "freehit":
      return "Free Hit";
    case "bboost":
      return "Bench Boost";
    default:
      return name;
  }
}
