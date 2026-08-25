export function formatPrice(nowCost: number): string {
  return `£${(nowCost / 10).toFixed(1)}m`;
}

/** Ranks with thin-space thousands separators. */
export function formatRank(rank: number): string {
  return rank.toLocaleString("en-GB").replace(/,/g, "\u2009");
}

export function formatCompactRank(rank: number): string {
  if (rank >= 1_000_000) return `${(rank / 1_000_000).toFixed(2)}M`;
  if (rank >= 100_000) return `${Math.round(rank / 1000)}k`;
  return formatRank(rank);
}

/** Signed delta with explicit direction word — colour is never the only channel. */
export function formatSignedRank(delta: number | null | undefined): string | null {
  if (delta === null || delta === undefined || delta === 0) return null;
  const abs = Math.abs(delta);
  const num = abs >= 1000 ? `${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1)}k` : String(Math.round(abs));
  return delta > 0 ? `+${num} ranks gained` : `\u2212${num} ranks lost`;
}

export function formatDeltaShort(delta: number): string {
  const sign = delta > 0 ? "+" : "\u2212";
  const abs = Math.abs(delta);
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return `${sign}${Math.round(abs)}`;
}

export const POSITION_SHORT: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };

/**
 * Premier League headshot seasons, newest first.
 *
 * The PL publishes a fresh set per season under `premierleague{YY}` and only
 * ever backfills it — a player who moved in the summer exists in the new set
 * and nowhere else, while an established name may still only be in an older
 * one. So we ask for the current season first and walk back; `PlayerPhoto`
 * steps through this list on error and lands on the club crest if none of
 * them resolve. New faces appear the moment the PL publishes them, with no
 * code change.
 */
export const PHOTO_SEASONS = ["premierleague26", "premierleague25"] as const;

export function playerImgSources(photo: string): string[] {
  const code = photo.replace(/\.(jpg|png)$/i, "");
  return [
    ...PHOTO_SEASONS.map(
      (season) => `https://resources.premierleague.com/${season}/photos/players/110x140/${code}.png`,
    ),
    // The retired generic set — still the only home of some pre-2025 players.
    `https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png`,
  ];
}

export function playerImg(photo: string): string {
  return playerImgSources(photo)[0];
}

export function crest(teamCode: number): string {
  return `https://resources.premierleague.com/premierleague/badges/70/t${teamCode}.png`;
}
