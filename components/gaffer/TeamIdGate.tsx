"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/primitives/Input";
import { Button } from "@/components/primitives/Button";
import { Sheet, SheetContent, SheetTitle } from "@/components/primitives/Sheet";
import { X } from "@/components/primitives/icons";
import { CrestTile } from "@/components/gaffer/ClubCrest";
import { formatCompactRank } from "@/lib/ui/format";
import { forgetTeam, getFavClub, getRecentTeams, parseGateInput, rememberTeam, setFavClub, type RecentTeam } from "@/lib/store/team";
import { COPY } from "@/lib/copy/deck";
import { CLUB } from "@/config/clubs";

type Stage = "form" | "checking" | "confirm" | "league";

interface ConfirmInfo {
  id: number;
  teamName: string;
  manager: string;
  rank: number | null;
  region: string | null;
  favouriteTeam: number | null;
}

interface LeaguePick {
  entry: number;
  entryName: string;
  playerName: string;
  rank: number;
}

const LEAGUE_HARDCAP = 500_000;

export function TeamIdGate({ compact = false, next = "/live" }: { compact?: boolean; next?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [stage, setStage] = React.useState<Stage>("form");
  const [error, setError] = React.useState<string | null>(null);
  const [confirmInfo, setConfirmInfo] = React.useState<ConfirmInfo | null>(null);
  const [league, setLeague] = React.useState<{ name: string; rows: LeaguePick[] } | null>(null);
  const [leagueFilter, setLeagueFilter] = React.useState("");
  const [explainOpen, setExplainOpen] = React.useState(false);
  const [recent, setRecent] = React.useState<RecentTeam[]>([]);

  React.useEffect(() => {
    setRecent(getRecentTeams());
  }, []);

  // paste hint — says what it looks like before you commit
  const hint = React.useMemo(() => {
    const t = value.trim();
    if (!t) return null;
    if (/entry\/\d+/.test(t)) return "Looks like a team link";
    if (/leagues?\/\d+/.test(t)) return "Looks like a league link";
    if (/^\d{4,10}$/.test(t)) return "Team ID";
    return null;
  }, [value]);

  async function checkEntry(id: number) {
    setStage("checking");
    setError(null);
    try {
      const res = await fetch(`/api/fpl/entry/${id}`);
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as {
        name?: string;
        player_first_name?: string;
        player_last_name?: string;
        player_region_name?: string | null;
        summary_overall_rank?: number | null;
        favourite_team?: number | null;
      };
      setConfirmInfo({
        id,
        teamName: d.name ?? `Team ${id}`,
        manager: `${d.player_first_name ?? ""} ${d.player_last_name ?? ""}`.trim(),
        rank: d.summary_overall_rank ?? null,
        region: d.player_region_name ?? null,
        favouriteTeam: d.favourite_team ?? null,
      });
      setStage("confirm");
    } catch {
      setStage("form");
      setError(COPY.teamIdInvalid);
    }
  }

  async function loadLeague(id: number) {
    setStage("checking");
    setError(null);
    try {
      const res = await fetch(`/api/fpl/standings/${id}/1`);
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as {
        league?: { name?: string; max_entries?: number | null };
        standings?: { results?: { entry: number; entry_name: string; player_name: string; rank: number }[] };
      };
      if ((d.league?.max_entries ?? 0) > LEAGUE_HARDCAP) {
        setStage("form");
        setError("That league is bigger than we can search here — paste your own team link instead.");
        return;
      }
      const rows: LeaguePick[] = (d.standings?.results ?? []).map((r) => ({
        entry: r.entry,
        entryName: r.entry_name,
        playerName: r.player_name,
        rank: r.rank,
      }));
      if (!rows.length) {
        setStage("form");
        setError("No standings in that league yet — they publish after the first deadline.");
        return;
      }
      setLeague({ name: d.league?.name ?? `League ${id}`, rows });
      setLeagueFilter("");
      setStage("league");
    } catch {
      setStage("form");
      setError("Couldn't load that league. Check the link and try again.");
    }
  }

  function submit(raw: string) {
    const parsed = parseGateInput(raw);
    if (!parsed) {
      setError("Enter your team ID — the number on your FPL Points page URL.");
      return;
    }
    if (parsed.kind === "entry") void checkEntry(parsed.id);
    else void loadLeague(parsed.id);
  }

  function confirm() {
    if (!confirmInfo) return;
    rememberTeam({ id: confirmInfo.id, name: confirmInfo.teamName, rank: confirmInfo.rank });
    if (confirmInfo.favouriteTeam != null) setFavClub(confirmInfo.favouriteTeam);
    // Only follow internal destinations — a crafted ?next must not leave the app.
    router.push(next.startsWith("/") && !next.startsWith("//") ? next : "/live");
  }

  const filteredLeague = React.useMemo(() => {
    if (!league) return [];
    const q = leagueFilter.trim().toLowerCase();
    if (!q) return league.rows;
    return league.rows.filter(
      (r) => r.entryName.toLowerCase().includes(q) || r.playerName.toLowerCase().includes(q),
    );
  }, [league, leagueFilter]);

  // ── confirmation chip — team · manager · rank, is this you? ────────────
  if (stage === "confirm" && confirmInfo) {
    return (
      <div className="w-full max-w-md" role="status">
        <div className="rounded-lg bg-surface-1 card-ring p-5">
          <div className="flex items-center gap-3">
            {confirmInfo.favouriteTeam != null && <CrestTile teamId={confirmInfo.favouriteTeam} />}
            <div className="min-w-0">
              <p className="fig-num truncate text-lg leading-tight">{confirmInfo.teamName}</p>
              <p className="mt-0.5 text-xs text-ink-lo">
                {confirmInfo.manager || "Manager"}
                {confirmInfo.region ? ` · ${confirmInfo.region}` : ""}
              </p>
            </div>
            {confirmInfo.rank != null && (
              <p className="ml-auto shrink-0 text-right">
                <span className="upper-label block text-2xs text-ink-lo">Rank</span>
                <span className="fig-num text-lg">{formatCompactRank(confirmInfo.rank)}</span>
              </p>
            )}
          </div>
          <p className="mt-4 text-sm text-ink-2">Is this you?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={confirm}>
              <span>This is me — continue</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStage("form");
                setConfirmInfo(null);
                setValue("");
              }}
            >
              <span>Not my team</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── league pick-list — find yourself in the standings ──────────────────
  if (stage === "league" && league) {
    return (
      <div className="w-full max-w-md" aria-label={`Pick your team from ${league.name}`}>
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="fig-num truncate text-base leading-none">{league.name}</h2>
            <button
              type="button"
              onClick={() => {
                setStage("form");
                setLeague(null);
              }}
              className="text-2xs uppercase-label text-ink-lo hover:text-ink-hi"
            >
              ← Back
            </button>
          </div>
          <p className="mb-3 text-2xs text-ink-lo">
            {league.rows.length} managers on page one — tap yours. Big leagues: filter by name.
          </p>
          <Input
            value={leagueFilter}
            onChange={(e) => setLeagueFilter(e.target.value)}
            placeholder="Filter by team or manager"
            aria-label="Filter league standings"
            className="h-10"
          />
          <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto" role="listbox" aria-label="Managers">
            {filteredLeague.map((r) => (
              <li key={r.entry}>
                <button
                  type="button"
                  onClick={() => void checkEntry(r.entry)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors dur-instant hover:bg-surface-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink-hi">{r.entryName}</span>
                    <span className="block truncate text-xs text-ink-lo">{r.playerName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-mid num-tabular">#{r.rank}</span>
                </button>
              </li>
            ))}
            {filteredLeague.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-ink-lo">
                No one matches that filter on page one.
              </li>
            )}
          </ul>
        </div>
      </div>
    );
  }

  // ── the gate itself ────────────────────────────────────────────────────
  return (
    <div className={compact ? "" : "w-full max-w-md"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex gap-2"
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Team ID, or paste your FPL link"
          aria-label="Your FPL team ID"
          aria-invalid={error != null}
          className={compact ? "h-9 text-sm" : "h-14 text-base"}
        />
        <Button type="submit" size={compact ? "sm" : "lg"} disabled={stage === "checking"}>
          {stage === "checking" ? "Checking…" : "Go"}
        </Button>
      </form>

      {hint && !error && stage === "form" && (
        <p className="mt-2 text-2xs uppercase-label text-volt" role="status">
          {hint}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-critical">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => setExplainOpen(true)}
        className="skewed mt-4 inline-flex h-11 items-center rounded-md bg-raised card-ring px-4 text-xs uppercase-label text-ink-2 transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
      >
        <span>Where do I find my ID?</span>
      </button>

      {!compact && recent.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Recent</span>
          {recent.map((t) => (
            <span
              key={t.id}
              className="skewed inline-flex h-11 items-center gap-1 rounded-md bg-raised card-ring pl-3 pr-1 text-xs"
            >
              <button onClick={() => void checkEntry(t.id)} className="text-ink-2 transition-colors dur-instant hover:text-ink-1">
                {t.name}
                {t.rank ? <span className="ml-1.5 text-ink-3 num-tabular">{formatCompactRank(t.rank)}</span> : null}
              </button>
              <button
                aria-label={`Forget ${t.name}`}
                onClick={() => setRecent(forgetTeam(t.id))}
                className="relative grid h-8 w-8 place-items-center rounded-full text-ink-3 transition-colors dur-instant hover:bg-surface-3 hover:text-ink-1 after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']"
              >
                <X width={11} height={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {!compact && <ClubCarousel />}

      {/* ID explainer — the three routes to your number */}
      <Sheet open={explainOpen} onOpenChange={setExplainOpen}>
        {explainOpen && (
          <SheetContent side="bottom" aria-label="How to find your FPL team ID">
            <div className="mb-3 flex items-center justify-between">
              <SheetTitle className="text-base">Where your ID lives</SheetTitle>
              <button
                type="button"
                onClick={() => setExplainOpen(false)}
                aria-label="Close"
                className="relative grid h-11 w-11 place-items-center rounded-md text-ink-mid transition-colors dur-instant after:absolute after:inset-0 after:rounded-md after:content-[''] hover:bg-surface-3 hover:text-ink-hi"
              >
                <X width={16} height={16} />
              </button>
            </div>
            <div className="space-y-4">
              <Route title="On the web" first>
                Open your Points page — the number sits in the address bar:
                <AddressBar>
                  fantasy.premierleague.com/entry/<span className="font-bold text-volt">1851681</span>/history
                </AddressBar>
              </Route>
              <Route title="In the app">
                Use <em>Share team</em> — the shared link contains the same number after “entry/”.
                <AddressBar>
                  https://fantasy.premierleague.com/entry/<span className="font-bold text-volt">1851681</span>
                </AddressBar>
              </Route>
              <Route title="From a league link">
                Paste any mini-league link instead — you&apos;ll pick yourself from its standings.
                <AddressBar>
                  fantasy.premierleague.com/leagues/<span className="font-bold text-volt">12345</span>
                </AddressBar>
              </Route>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}

function Route({ title, first, children }: { title: string; first?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className={`upper-label text-2xs text-ink-lo ${first ? "" : "mt-2"}`}>{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

function AddressBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 overflow-x-auto whitespace-nowrap rounded-md bg-sunk card-ring px-3 py-2 text-xs text-ink-mid num-tabular">
      {children}
    </div>
  );
}

/**
 * Favourite-club carousel — ◀ ▶ steps through the twenty crests; selecting
 * recolours chrome accents app-wide via [data-club]. No selection = the
 * default floodlight look.
 */
function ClubCarousel() {
  const clubs = React.useMemo(() => Object.values(CLUB).filter((c) => c.id >= 1 && c.id <= 20), []);
  const [fav, setFav] = React.useState<number | null>(null);
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    const stored = getFavClub();
    setFav(stored);
    if (stored != null) {
      const i = clubs.findIndex((c) => c.id === stored);
      if (i >= 0) setIdx(i);
    }
  }, [clubs]);

  const club = clubs[idx];
  const selected = fav === club?.id;

  const pick = (id: number | null) => {
    setFav(id);
    setFavClub(id);
  };

  return (
    <div className="mt-5 w-full max-w-md rounded-lg bg-surface-1/70 card-ring px-4 py-3">
      <p className="upper-label text-2xs text-ink-lo">Your club — tints the chrome</p>
      <div className="mt-2 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setIdx((i) => (i - 1 + clubs.length) % clubs.length)}
          aria-label="Previous club"
          className="skewed grid h-11 w-11 place-items-center rounded-md bg-raised card-ring text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
        >
          <span className="text-sm">◀</span>
        </button>
        <button
          type="button"
          onClick={() => pick(selected ? null : club.id)}
          aria-pressed={selected}
          aria-label={selected ? `Clear ${club.name} — back to the default look` : `Tint chrome to ${club.name}`}
          className="skewed flex min-h-[44px] min-w-[128px] flex-col items-center gap-1 rounded-md bg-raised card-ring px-3 py-1.5 transition-all dur-instant hover:-translate-y-0.5"
          style={
            selected
              ? { boxShadow: `inset 0 0 0 1.5px ${club.rail}, var(--lift)` }
              : undefined
          }
        >
          <CrestTile teamId={club.id} />
          <span className="text-xs font-semibold text-ink-hi">{club.name}</span>
        </button>
        <button
          type="button"
          onClick={() => setIdx((i) => (i + 1) % clubs.length)}
          aria-label="Next club"
          className="skewed grid h-11 w-11 place-items-center rounded-md bg-raised card-ring text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
        >
          <span className="text-sm">▶</span>
        </button>
      </div>
      <p className="mt-1.5 text-center text-2xs text-ink-lo">
        {selected ? `${club.name} tint on — tap again to clear` : "Skip it and the default floodlight look stays"}
      </p>
    </div>
  );
}
