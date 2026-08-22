/** IMPACT — points gained on your league by owning this player. */
export function impact(yourMult: number, leagueEo: number, livePoints: number): number {
  return (yourMult - leagueEo / 100) * livePoints;
}

/** IMPORTANCE — how much of your league position still rides on this player. */
export function importance(
  yourMult: number,
  rivalMults: number[],
  remainingMins: number,
  xpRemaining: number,
): number {
  const all = [yourMult, ...rivalMults];
  const m = all.reduce((a, b) => a + b, 0) / all.length;
  const sd = Math.sqrt(all.reduce((s, v) => s + (v - m) ** 2, 0) / all.length);
  return sd * (remainingMins / 90) * xpRemaining;
}
