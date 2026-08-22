import "server-only";

const cache = new Map<number, { name: string | null; at: number }>();
const TTL = 300_000;

export async function getEntryName(teamId: number): Promise<string | null> {
  const hit = cache.get(teamId);
  if (hit && Date.now() - hit.at < TTL) return hit.name;
  let name: string | null = null;
  try {
    const res = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/`, {
      headers: { Accept: "application/json", "User-Agent": "GAFFER/1.0 (+https://gaffer.app)" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (res.ok) name = ((await res.json()) as { name?: string }).name ?? null;
  } catch {
    name = null;
  }
  if (name) cache.set(teamId, { name, at: Date.now() });
  return name;
}
