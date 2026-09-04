/**
 * v3 Tier C — better estimates of the player (feature 6).
 *
 * 6 TRUE FORM — local-level Kalman filter over per-90 contribution; cameos
 *   discounted by minutes, absences grow uncertainty via process noise only.
 *
 * The feature 7 (BOCPD role radar) and feature 8 (Cox engine temperature)
 * estimators that used to live below were never wired to anything and were
 * removed — recover them from git history if a screen ever needs them.
 */

// ── Feature 6: TRUE FORM ────────────────────────────────────────────────────

export interface FormObservation {
  /** Per-90 contribution rate observed in the match. */
  y90: number | null; // null → did not play
  minutes: number;
}

export interface KalmanState {
  ability: number;
  variance: number;
  filtered: { gwIndex: number; ability: number; sd: number }[];
}

/**
 * y_t = θ_t + ε, θ_{t+1} = θ_t + w — the standard local-level recursion.
 * Observations are shrunk toward 0 by minutes weight (cameos say little);
 * missing matches only add process noise so uncertainty widens during injury.
 */
export function trueForm(
  observations: FormObservation[],
  opts: { processVar?: number; obsVar?: number; prior?: number; priorVar?: number } = {},
): KalmanState {
  const q = opts.processVar ?? 0.02;
  const r = opts.obsVar ?? 0.25;
  let theta = opts.prior ?? 0.15;
  let p = opts.priorVar ?? 0.2;

  const filtered: KalmanState["filtered"] = [];
  observations.forEach((obs, i) => {
    p += q; // predict — uncertainty grows even without a match
    if (obs.y90 != null && obs.minutes > 0) {
      const w = Math.min(1, obs.minutes / 90); // cameo discount
      const rEff = r / Math.max(0.15, w);
      const k = p / (p + rEff);
      theta = theta + k * (obs.y90 - theta);
      p = (1 - k) * p;
    }
    filtered.push({ gwIndex: i, ability: theta, sd: Math.sqrt(p) });
  });

  return { ability: theta, variance: p, filtered };
}