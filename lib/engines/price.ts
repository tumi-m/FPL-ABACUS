export interface PriceSnapshot {
  capturedAt: Date;
  transfersIn: number;
  transfersOut: number;
}

export interface PricePressure {
  net: number;
  today: number;
  progress: number;
  velocityOk: boolean;
  pRise: number;
  etaDays: number | null;
}

const RISE_THRESHOLD = 220_000;
const DAILY_VELOCITY_GATE = 40_000;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const logistic = (v: number) => 1 / (1 + Math.exp(-v));
const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86_400_000);

function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

function netOverLast24h(snapshots: PriceSnapshot[], now: Date): number {
  const cutoff = now.getTime() - 86_400_000;
  const window = snapshots.filter((s) => s.capturedAt.getTime() >= cutoff);
  if (window.length < 2) return 0;
  return netBetween(window[0], last(window));
}

function netBetween(a: PriceSnapshot, b: PriceSnapshot): number {
  return b.transfersIn - a.transfersIn - (b.transfersOut - a.transfersOut);
}

export function pressure(
  snapshotsRaw: PriceSnapshot[],
  lastChangeAt: Date | null,
  opts: { wildcardWindow?: boolean; now?: Date } = {},
): PricePressure {
  if (snapshotsRaw.length < 2) {
    return { net: 0, today: 0, progress: 0, velocityOk: false, pRise: 0, etaDays: null };
  }
  const now = opts.now ?? new Date();
  const snapshots = [...snapshotsRaw].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

  const since = lastChangeAt
    ? snapshots.filter((s) => s.capturedAt > lastChangeAt)
    : snapshots;
  if (since.length < 2) since.push(...snapshots.slice(-2));

  let net = netBetween(since[0], last(since));
  // The algorithm counts unique managers, not raw transfers — discount wildcards.
  if (opts.wildcardWindow) net *= 0.75;

  const today = netOverLast24h(snapshots, now);
  const daysSince = lastChangeAt ? daysBetween(lastChangeAt, now) : 99;

  const progress = net / RISE_THRESHOLD;
  const velocityOk = Math.abs(today) >= DAILY_VELOCITY_GATE;
  const recencyPenalty = daysSince < 1 ? 0.15 : daysSince < 3 ? 0.6 : 1;

  const pRise =
    clamp01(logistic(4.2 * (progress - 0.92)) * (velocityOk ? 1 : 0.25) * recencyPenalty);

  const etaDays =
    today !== 0 && net < RISE_THRESHOLD
      ? Math.ceil((RISE_THRESHOLD - net) / Math.abs(today))
      : null;

  return { net, today, progress, velocityOk, pRise, etaDays };
}

/** Per-interval net-transfer deltas across the trailing 24h window, oldest
 *  first — the feed for the PriceGauge velocity sparkline. */
export function velocitySeries(snapshotsRaw: PriceSnapshot[], now: Date = new Date()): number[] {
  const cutoff = now.getTime() - 86_400_000;
  const sorted = [...snapshotsRaw].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  const window = sorted.filter((s) => s.capturedAt.getTime() >= cutoff);
  const out: number[] = [];
  for (let i = 1; i < window.length; i++) out.push(netBetween(window[i - 1], window[i]));
  return out;
}

export interface TonightRow {
  element: number;
  /** Modelled probability of a rise before the next deadline, 0..1 (0 when
   *  the player has no stored snapshot history — see covered). */
  pRise: number;
  direction: "up" | "down";
  /** Cumulative net transfers since the last confirmed change. */
  net: number;
  /** False when there is not enough snapshot history to run the model. */
  covered: boolean;
}

/** Tonight-list ranking: sort by |p(rise)| descending so the players closest
 *  to a move — in either direction — sit on top. Uncovered candidates stay in
 *  the list at zero so the UI can show them greyed rather than silently drop. */
export function rankTonight(
  candidates: { element: number; snapshots: PriceSnapshot[]; lastChangeAt: Date | null }[],
): TonightRow[] {
  return candidates
    .map(({ element, snapshots, lastChangeAt }) => {
      if (snapshots.length < 2) {
        return { element, pRise: 0, direction: "down" as const, net: 0, covered: false };
      }
      const p = pressure(snapshots, lastChangeAt);
      return {
        element,
        pRise: p.pRise,
        direction: p.net >= 0 ? ("up" as const) : ("down" as const),
        net: p.net,
        covered: true,
      };
    })
    .sort((a, b) => Math.abs(b.pRise) - Math.abs(a.pRise));
}
