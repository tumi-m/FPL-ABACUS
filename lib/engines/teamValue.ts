/**
 * Team value — what your side is worth, and where that came from.
 *
 * Everything here is in tenths of a million, the unit FPL stores money in, and
 * only crosses into pounds at the formatter. Doing the arithmetic in tenths
 * keeps it exact: £0.1m is an integer, and a squad of fifteen summed in floats
 * drifts by enough to show the wrong price.
 *
 * The one rule that makes this harder than adding up prices: FPL pays you only
 * half of a player's rise when you sell, rounded down to the nearest £0.1m. So
 * your team value is NOT the sum of what your players cost today, and a
 * player's season rise is not what he put in your bank. Both facts are
 * modelled rather than glossed, because a value page that quietly adds full
 * rises overstates every squad on it.
 */

/** Everyone starts the season on £100.0m. */
export const STARTING_BUDGET_TENTHS = 1000;

export interface ValuePoint {
  gw: number;
  /** Squad selling prices plus bank at that deadline. */
  totalTenths: number;
  bankTenths: number;
}

export interface ValueSwing {
  gw: number;
  deltaTenths: number;
}

export interface TeamValueRead {
  squadTenths: number;
  bankTenths: number;
  totalTenths: number;
  /** Where you started — the budget, not the first recorded week. */
  startTenths: number;
  changeTenths: number;
  /** Biggest single-gameweek gain and loss, null until two weeks exist. */
  best: ValueSwing | null;
  worst: ValueSwing | null;
  /** Per-gameweek movement, oldest first. */
  swings: ValueSwing[];
  series: ValuePoint[];
}

/**
 * Read today's figures against the season's trail.
 *
 * Takes the total and the bank rather than the squad and the bank, because
 * FPL's own team value is a single number it has already computed with the
 * selling-price rule applied. Summing fifteen `now_cost` values instead
 * overstates any squad that has made money, and the two would then disagree
 * between one screen and the next. Squad is whatever is left after the bank.
 */
export function readTeamValue(
  series: ValuePoint[],
  now: { totalTenths: number; bankTenths: number },
): TeamValueRead {
  const sorted = [...series].sort((a, b) => a.gw - b.gw);
  const totalTenths = now.totalTenths;

  const swings: ValueSwing[] = [];
  for (let i = 1; i < sorted.length; i++) {
    swings.push({ gw: sorted[i].gw, deltaTenths: sorted[i].totalTenths - sorted[i - 1].totalTenths });
  }

  let best: ValueSwing | null = null;
  let worst: ValueSwing | null = null;
  for (const s of swings) {
    if (s.deltaTenths > 0 && (!best || s.deltaTenths > best.deltaTenths)) best = s;
    if (s.deltaTenths < 0 && (!worst || s.deltaTenths < worst.deltaTenths)) worst = s;
  }

  return {
    squadTenths: totalTenths - now.bankTenths,
    bankTenths: now.bankTenths,
    totalTenths,
    startTenths: STARTING_BUDGET_TENTHS,
    changeTenths: totalTenths - STARTING_BUDGET_TENTHS,
    best,
    worst,
    swings,
    series: sorted,
  };
}

/**
 * What FPL will actually pay you for a player.
 *
 * Half the rise since you bought him, rounded DOWN to £0.1m; falls come off in
 * full. This is the rule that makes a 15-man squad worth less than its sticker
 * price, and it is why "profit" and "price change" are two different numbers.
 */
export function sellPrice(boughtTenths: number, nowTenths: number): number {
  if (nowTenths <= boughtTenths) return nowTenths;
  return boughtTenths + Math.floor((nowTenths - boughtTenths) / 2);
}

export interface PriceMove {
  id: number;
  name: string;
  code: string;
  photo: string;
  pos: number;
  teamId: number;
  /** Price today. */
  costTenths: number;
  /** Moved since the season opened. */
  startTenths: number;
  /** Moved in this gameweek alone. */
  eventTenths: number;
  /** Net transfers this gameweek — the engine behind the next move. */
  netTransfers: number;
}

export interface PriceLedger {
  moves: PriceMove[];
  risen: number;
  fallen: number;
  flat: number;
  /** Sum of season moves across the set. */
  netTenths: number;
  /** Movement in this gameweek alone. */
  netEventTenths: number;
  best: PriceMove | null;
  worst: PriceMove | null;
}

/**
 * Summarise a set of players' price history, newest money first.
 *
 * `netTenths` is the sum of what these men have done since the season opened,
 * which is a fact about them rather than about you: you only ride the part of
 * a rise that happened after you bought him, and only bank half of it. The
 * surface that prints this has to say so — see the note in PriceLedgerCard.
 */
export function priceLedger(moves: PriceMove[]): PriceLedger {
  const sorted = [...moves].sort(
    (a, b) => b.startTenths - a.startTenths || b.eventTenths - a.eventTenths || a.name.localeCompare(b.name),
  );
  let risen = 0;
  let fallen = 0;
  let flat = 0;
  let netTenths = 0;
  let netEventTenths = 0;
  for (const m of sorted) {
    if (m.startTenths > 0) risen++;
    else if (m.startTenths < 0) fallen++;
    else flat++;
    netTenths += m.startTenths;
    netEventTenths += m.eventTenths;
  }
  return {
    moves: sorted,
    risen,
    fallen,
    flat,
    netTenths,
    netEventTenths,
    best: sorted.length && sorted[0].startTenths > 0 ? sorted[0] : null,
    worst:
      sorted.length && sorted[sorted.length - 1].startTenths < 0 ? sorted[sorted.length - 1] : null,
  };
}

/**
 * The n biggest movers in one direction.
 *
 * Filtering comes before slicing on purpose: taking the top eight off a sorted
 * list hands back eight risers under a "biggest fallers" heading on a week when
 * nobody has fallen, which is a caption contradicting its own rows. A short
 * list — or none — is the honest answer.
 */
export function topMovers(moves: PriceMove[], dir: "up" | "down", n = 8): PriceMove[] {
  const up = dir === "up";
  return moves
    .filter((m) => (up ? m.startTenths > 0 : m.startTenths < 0))
    .sort((a, b) => (up ? b.startTenths - a.startTenths : a.startTenths - b.startTenths))
    .slice(0, n);
}

/** "£100.4m" — the one place tenths become pounds. */
export function fmtM(tenths: number): string {
  const sign = tenths < 0 ? "−" : "";
  return `${sign}£${(Math.abs(tenths) / 10).toFixed(1)}m`;
}

/** "+£1.4m", "−£0.3m", or "level" — never a bare "+£0.0m". */
export function fmtDeltaM(tenths: number): string {
  if (tenths === 0) return "level";
  return `${tenths > 0 ? "+" : "−"}£${(Math.abs(tenths) / 10).toFixed(1)}m`;
}
