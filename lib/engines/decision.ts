import { HIT_COST, type PlanMove, type PlannerPlayer } from "./planner";

/** Compare the same basket now or one week later against keeping its outgoings.
 * This is a player-points comparison, not an optimised XI or chip simulation.
 * Missing projections are unknown; an explicit zero is a genuine blank.
 */
export function compareDecision(input: {
  moves: PlanMove[];
  playerOf: (id: number) => PlannerPlayer | undefined;
  freeTransfers: number;
  weeks: number;
  /** Scenario assumption applied only to incoming projections, not a probability. */
  incomingFactor?: number;
}) {
  const pairs = input.moves.map((m) => ({ out: input.playerOf(m.out), incoming: input.playerOf(m.in) }));
  const weeks = Math.max(0, Math.floor(input.weeks));
  if (!pairs.length || !Number.isFinite(weeks) || weeks < 1) return null;
  if (pairs.some(({ out, incoming }) => !out || !incoming || out.horizon.length < weeks || incoming.horizon.length < weeks ||
    [...out.horizon.slice(0, weeks), ...incoming.horizon.slice(0, weeks)].some((p) => !Number.isFinite(p)))) return null;
  const ft = Number.isFinite(input.freeTransfers) ? Math.min(5, Math.max(0, Math.floor(input.freeTransfers))) : 0;
  const factor = Number.isFinite(input.incomingFactor) ? Math.max(0, input.incomingFactor!) : 1;
  const nowHit = Math.max(0, pairs.length - ft) * HIT_COST;
  const waitHit = Math.max(0, pairs.length - Math.min(5, ft + 1)) * HIT_COST;
  let now = -nowHit;
  let wait = 0;
  let incomingTotal = 0;
  let outgoingTotal = 0;
  const round = (n: number) => Math.round(n * 10) / 10;
  const rows = Array.from({ length: weeks }, (_, week) => {
    const incoming = pairs.reduce((sum, p) => sum + p.incoming!.horizon[week], 0);
    const outgoing = pairs.reduce((sum, p) => sum + p.out!.horizon[week], 0);
    incomingTotal += incoming;
    outgoingTotal += outgoing;
    const gain = incoming * factor - outgoing;
    now += gain;
    if (week === 1) wait -= waitHit;
    if (week > 0) wait += gain;
    return { week, now: round(now), wait: round(wait), hold: 0 };
  });
  const end = rows[rows.length - 1];
  // Prefer keeping the transfer on an exact tie. Waiting needs a second GW.
  const options = [{ key: "hold" as const, net: 0 }, ...(weeks > 1 ? [{ key: "wait" as const, net: end.wait }] : []), { key: "now" as const, net: end.now }];
  const best = options.reduce((a, b) => b.net > a.net ? b : a).key;
  const payback = rows.findIndex((r, i) => r.now >= 0 && rows.slice(i).every((later) => later.now >= 0));
  return {
    rows, best, nowHit, waitHit: weeks > 1 ? waitHit : null,
    nowNet: end.now, waitNet: weeks > 1 ? end.wait : null,
    nowNextFt: Math.min(5, Math.max(0, ft - pairs.length) + 1),
    holdNextFt: Math.min(5, ft + 1),
    paybackWeek: payback < 0 ? null : payback,
    /** Required fraction of the original incoming projection to match holding. */
    breakEvenFactor: incomingTotal > 0 ? (outgoingTotal + nowHit) / incomingTotal : null,
  };
}
