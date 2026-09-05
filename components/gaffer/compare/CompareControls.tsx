"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/ui/cn";

/**
 * Compare controls — the player picker and the share link.
 *
 * Adding a player navigates with the new id in the query string, so the
 * table and the address update together: the URL is the state, which is
 * what makes a comparison shareable. Removing is a plain link per column
 * (no JS needed); copying the link is the one action that needs the
 * clipboard.
 */
interface PaletteRow {
  id: number;
  name: string;
  pos: number;
  club: number;
}

export function CompareControls({ ids }: { ids: number[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [pool, setPool] = React.useState<PaletteRow[]>([]);
  const [copied, setCopied] = React.useState(false);

  // The same background load the command palette makes — once, shared by
  // the browser cache, never on the critical path of the table itself.
  React.useEffect(() => {
    let dead = false;
    fetch("/api/gaffer/palette-players")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { players?: PaletteRow[] } | null) => {
        if (!dead && d?.players) setPool(d.players);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, []);

  const needle = q.trim().toLowerCase();
  const hits =
    needle.length < 2
      ? []
      : pool
          .filter((p) => !ids.includes(p.id) && p.name.toLowerCase().includes(needle))
          .slice(0, 8);

  const add = (id: number) => {
    const next = [...ids, id].slice(0, 5);
    setQ("");
    router.push(`/compare?ids=${next.join(",")}`);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard needs a secure context — the URL bar is right there.
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ids.length >= 5 ? "Five is the table's width" : "Add a player…"}
          aria-label="Add a player to compare"
          disabled={ids.length >= 5}
          className="h-9 w-44 rounded-md bg-sunk card-ring px-3 text-xs text-ink-hi placeholder:text-ink-lo focus:outline-none focus-visible:outline-2 focus-visible:outline-volt disabled:opacity-50"
        />
        {hits.length > 0 && (
          <ul
            role="listbox"
            aria-label="Matching players"
            className="absolute left-0 right-0 top-10 z-20 max-h-56 overflow-y-auto rounded-md bg-raised card-ring py-1 overlay-shadow"
          >
            {hits.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => add(p.id)}
                  className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-xs text-ink-hi transition-colors hover:bg-surface-3"
                >
                  <span className="truncate">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {ids.length > 1 && (
        <button
          type="button"
          onClick={copy}
          className={cn(
            "skewed inline-flex h-9 items-center rounded-md px-3 text-2xs uppercase-label transition-colors dur-instant",
            copied ? "bg-surge text-on-accent" : "card-ring text-ink-mid hover:text-ink-hi",
          )}
        >
          <span>{copied ? "Link copied" : "Share this table"}</span>
        </button>
      )}
    </div>
  );
}
