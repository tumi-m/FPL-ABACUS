"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/primitives/Sheet";
import { CLUB } from "@/config/clubs";
import { cn } from "@/lib/ui/cn";

/**
 * The command palette (v10 A2).
 *
 * Twenty routes and no way to jump; power users navigate by typing. Opens
 * on ⌘K (or the desktop hint button), or a long-press on the brand on a
 * phone. Fuse-free on purpose: a ranked substring match over three small
 * sources — routes, the ask registry's question vocabulary, and player
 * names — needs no library and no network call, so it opens inside the
 * frame budget with nothing fetched on the critical path (players load in
 * the background, once, and the palette is fully usable before they do).
 *
 * Focus is trapped by the Sheet primitive; Esc closes and the primitive
 * restores focus to the trigger.
 */

const POS_LABEL: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

interface Item {
  /** Stable key. */
  key: string;
  /** What the row shows. */
  label: string;
  /** The secondary line — where it goes or what it opens. */
  hint: string;
  /** Ranked by match position then length then this base weight. */
  weight: number;
  href: string;
}

const ROUTES: Item[] = [
  { key: "r-live", label: "Home", hint: "Live scores and the round", weight: 10, href: "/live" },
  { key: "r-field", label: "Field", hint: "Your pitch, this gameweek", weight: 10, href: "/field" },
  { key: "r-planner", label: "Planner", hint: "Stage transfers and chips", weight: 10, href: "/planner" },
  { key: "r-board", label: "Board", hint: "Fixture ticker and the market", weight: 10, href: "/board" },
  { key: "r-leagues", label: "Leagues", hint: "Mini-leagues and rivals", weight: 8, href: "/leagues" },
  { key: "r-combos", label: "Combinations", hint: "Player pairs", weight: 6, href: "/field/combos" },
  { key: "r-understanding", label: "Season understanding", hint: "The ledger, the luck, true form", weight: 6, href: "/field/understanding" },
  { key: "r-squad", label: "My team", hint: "The fifteen and their value", weight: 8, href: "/squad" },
  { key: "r-players", label: "Players", hint: "The explorer", weight: 6, href: "/players" },
  { key: "r-news", label: "Newsdesk", hint: "Injuries and club news", weight: 6, href: "/news" },
  { key: "r-film", label: "Film", hint: "Your season archived", weight: 6, href: "/film" },
  { key: "r-dna", label: "Manager DNA", hint: "Transfer record under the lens", weight: 6, href: "/dna" },
  { key: "r-arcade", label: "Arcade", hint: "Pick your gaffer", weight: 6, href: "/arcade" },
];

/** Question vocabulary — the desk's own words, so ⌘K → "captain" asks it. */
const QUESTIONS: Item[] = [
  { key: "q-captain", label: "Who should I captain?", hint: "Ask the gaffer", weight: 4, href: "?ask=captain" },
  { key: "q-price", label: "Will anyone rise tonight?", hint: "Ask the gaffer", weight: 4, href: "?ask=price" },
  { key: "q-hit", label: "Is it worth taking a hit?", hint: "Ask the gaffer", weight: 4, href: "?ask=hit" },
  { key: "q-chip", label: "When should I play my wildcard?", hint: "Ask the gaffer", weight: 4, href: "?ask=chip" },
  { key: "q-injury", label: "Any injury doubts?", hint: "Ask the gaffer", weight: 4, href: "?ask=injury" },
];

interface PlayerRow {
  id: number;
  name: string;
  pos: number;
  club: number;
}

/** Rank one item against a query — the fuse-free scorer. */
function score(item: Item, q: string): number {
  const hay = item.label.toLowerCase();
  const pos = hay.indexOf(q);
  if (pos < 0) {
    // All query words present anywhere still counts, ranked last.
    const words = q.split(/\s+/).filter(Boolean);
    const all = words.length > 1 && words.every((w) => hay.includes(w));
    if (!all) return -1;
    return 0;
  }
  // Earlier matches outrank later; a prefix match outranks a mid-word one.
  const base = pos === 0 ? 100 : 60 - Math.min(50, pos);
  return base + item.weight;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [players, setPlayers] = React.useState<PlayerRow[]>([]);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Players load once, in the background, after mount — never on the open path.
  React.useEffect(() => {
    let dead = false;
    fetch("/api/gaffer/palette-players")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { players?: PlayerRow[] } | null) => {
        if (!dead && d?.players) setPlayers(d.players);
      })
      .catch(() => {
        /* the palette works without them — routes and questions remain */
      });
    return () => {
      dead = true;
    };
  }, []);

  // ⌘K / Ctrl-K.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Long-press the brand on mobile — the press-and-hold opens the palette.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let timer = 0;
    const brand = document.querySelector<HTMLAnchorElement>('a[aria-label*="Arcade"]');
    if (!brand) return;
    const start = (e: TouchEvent) => {
      timer = window.setTimeout(() => {
        e.preventDefault();
        setOpen(true);
      }, 550);
    };
    const clear = () => window.clearTimeout(timer);
    brand.addEventListener("touchstart", start, { passive: true });
    brand.addEventListener("touchend", clear);
    brand.addEventListener("touchmove", clear);
    return () => {
      brand.removeEventListener("touchstart", start);
      brand.removeEventListener("touchend", clear);
      brand.removeEventListener("touchmove", clear);
      window.clearTimeout(timer);
    };
  }, []);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const results = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pool: Item[] = needle
      ? [...ROUTES, ...QUESTIONS].filter((i) => score(i, needle) >= 0)
      : [...ROUTES];
    if (needle) {
      const seen = new Set(pool.map((i) => i.key));
      const playerHits = players
        .filter((p) => p.name.toLowerCase().includes(needle))
        .slice(0, 8)
        .map((p): Item => {
          const club = CLUB[p.club];
          return {
            key: `p-${p.id}`,
            label: p.name,
            hint: `${POS_LABEL[p.pos] ?? "?"} · ${club?.name ?? ""}`,
            weight: 2,
            href: `/players/${p.id}`,
          };
        });
      const extras = playerHits.filter((p) => !seen.has(p.key));
      return [...pool].sort((a, b) => {
        const sa = score(a, needle);
        const sb = score(b, needle);
        return sb - sa || a.label.length - b.label.length;
      }).concat(extras);
    }
    return pool;
  }, [q, players]);

  const go = React.useCallback(
    (item: Item) => {
      setOpen(false);
      if (item.href.startsWith("?ask=")) {
        // The desk accepts a prefilled question — it opens with the query
        // in the box, ready to consult.
        window.dispatchEvent(
          new CustomEvent("gaffer:open-ask", { detail: { question: item.label } }),
        );
        return;
      }
      router.push(item.href);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((v) => Math.min(results.length - 1, v + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((v) => Math.max(0, v - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[active];
      if (item) go(item);
    }
  };

  // Keep the highlighted row in view without stealing the scroll.
  React.useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Command palette — jump anywhere"
        className="hidden md:inline-flex h-8 items-center gap-2 rounded-full glass-edge px-3 text-xs text-ink-lo transition-colors dur-instant hover:text-ink-hi"
      >
        Jump
        <kbd className="rounded bg-surface-3 px-1 py-0.5 text-2xs num-tabular">⌘K</kbd>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-lg" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Command palette</SheetTitle>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Jump to… (Home, Planner, Salah, captain)"
            aria-label="Search commands and players"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            className="h-10 w-full rounded-md border border-line bg-sunk px-3 text-sm text-ink-hi placeholder:text-ink-lo focus-visible:outline focus-visible:outline-volt"
          />
          <div
            id="palette-results"
            ref={listRef}
            role="listbox"
            aria-label="Results"
            className="mt-3 max-h-[52dvh] space-y-0.5 overflow-y-auto"
          >
            {results.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-ink-lo">
                Nothing matches — try a route name or a player.
              </p>
            )}
            {results.map((item, i) => (
              <button
                key={item.key}
                type="button"
                data-idx={i}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={cn(
                  "flex w-full items-baseline justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors dur-instant",
                  i === active ? "bg-surface-3 text-ink-hi" : "text-ink-mid hover:bg-surface-2",
                )}
              >
                <span className="min-w-0 truncate text-sm">{item.label}</span>
                <span className="shrink-0 text-2xs uppercase-label text-ink-lo">{item.hint}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}