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
 * Player headshots. The PL site serves the 2025/26 asset set
 * (premierleague25/photos/players/110x140/{code}.png — no p prefix) and new
 * signings exist ONLY there; the legacy generic path still has everyone from
 * earlier seasons and stays as the fallback.
 */
export function playerImgSources(photo: string): string[] {
  const code = photo.replace(/\.(jpg|png)$/i, "");
  return [
    `https://resources.premierleague.com/premierleague25/photos/players/110x140/${code}.png`,
    `https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png`,
  ];
}

export function playerImg(photo: string): string {
  return playerImgSources(photo)[0];
}

export function crest(teamCode: number): string {
  return `https://resources.premierleague.com/premierleague/badges/70/t${teamCode}.png`;
}
