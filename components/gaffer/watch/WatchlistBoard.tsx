"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Est } from "@/components/gaffer/Est";
import { Published } from "@/components/gaffer/Provenance";
import { WatchStar } from "./WatchStar";
import { useWatchlist } from "./useWatchlist";
import { formatPrice, POSITION_SHORT } from "@/lib/ui/format";
import type { WatchRow } from "@/app/api/gaffer/watchlist/route";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; rows: WatchRow[] }
  | { kind: "failed" };

/**
 * The watchlist, at the deadline.
 *
 * Starring a player is only worth doing if the stars then tell you something,
 * so this is the payoff surface: what each one costs, whether the market is
 * about to move them, whether they are fit, and who they play. The ids are the
 * browser's; everything else is fetched for exactly those ids.
 */
export function WatchlistBoard() {
  const { ids } = useWatchlist();
  const [state, setState] = useState<State>({ kind: "idle" });
  const key = ids.join(",");

  useEffect(() => {
    if (!key) {
      setState({ kind: "idle" });
      return;
    }
    let live = true;
    setState({ kind: "loading" });
    fetch(`/api/gaffer/watchlist?ids=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { rows: WatchRow[] }) => {
        if (live) setState({ kind: "ready", rows: d.rows });
      })
      .catch(() => {
        if (live) setState({ kind: "failed" });
      });
    return () => {
      live = false;
    };
  }, [key]);

  return (
    <section aria-label="Watchlist" className="rounded-lg bg-surface-1 card-ring p-5">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Watchlist</h2>
        <span className="text-2xs text-ink-lo num-tabular">{ids.length}</span>
        <Link href="/players" className="ml-auto text-xs text-ink-3 underline decoration-dotted hover:text-ink-1">
          Add players
        </Link>
      </div>

      {state.kind === "idle" && (
        <p className="text-sm text-ink-3">
          Star a player anywhere in the app and they land here — price pressure, fitness and who they play, in
          one list. It is kept in this browser, so nobody else sees it and it does not travel to another device.
        </p>
      )}
      {state.kind === "loading" && <p className="text-sm text-ink-3">Reading the market…</p>}
      {state.kind === "failed" && (
        <p className="text-sm text-ink-3">
          The watchlist could not be priced just now — FPL did not answer. Your stars are safe; try again in a
          moment.
        </p>
      )}
      {state.kind === "ready" && state.rows.length === 0 && (
        <p className="text-sm text-ink-3">None of the starred players are in the game any more.</p>
      )}
      {state.kind === "ready" && state.rows.length > 0 && (
        <>
          {/* Three unlabelled columns of "COV 2 · £9.5m · —" is a puzzle. */}
          <div className="flex items-center gap-2 pb-1 text-2xs uppercase tracking-wide text-ink-lo">
            <span className="flex-1">Player</span>
            <span className="shrink-0">Next</span>
            <span className="w-14 shrink-0 text-right">Price</span>
            <span className="w-16 shrink-0 text-right">Move</span>
          </div>
        <ul className="divide-y divide-hairline">
          {state.rows.map((r) => (
            <Row key={r.id} r={r} />
          ))}
        </ul>
        <p className="mt-2 text-2xs text-ink-lo">
          Move is the modelled chance of a price change before the deadline. It reads &ldquo;—&rdquo; for anyone
          we have no stored transfer history for yet, rather than guessing at zero.
        </p>
        </>
      )}
    </section>
  );
}

function Row({ r }: { r: WatchRow }) {
  const moved = r.costChangeEvent;
  return (
    <li className="flex items-center gap-2 py-1.5">
      <WatchStar id={r.id} name={r.webName} className="-ml-3 h-9 w-9" />
      <div className="min-w-0 flex-1">
        <Link href={`/players/${r.id}`} className="text-sm font-medium text-ink-1 hover:text-brand">
          {r.webName}
        </Link>
        <span className="ml-1.5 text-2xs text-ink-lo">
          {POSITION_SHORT[r.pos]} · {r.teamShort}
        </span>
        {r.flag && (
          <p
            className={`truncate text-2xs ${r.flagKind === "doubt" ? "text-warning" : "text-critical"}`}
            title={r.flag}
          >
            {r.flag}
          </p>
        )}
      </div>

      {r.next ? (
        <span
          className="shrink-0 text-2xs text-ink-3 num-tabular"
          title={`Difficulty ${r.next.difficulty} of 5`}
        >
          {r.next.home ? "" : "@"}
          {r.next.opponent}
          <span className="ml-1 text-ink-lo">{r.next.difficulty}</span>
        </span>
      ) : (
        <span className="shrink-0 text-2xs text-ink-lo">no fixture</span>
      )}

      <span className="w-14 shrink-0 text-right text-xs num-tabular text-ink-2">
        <Published>
          {formatPrice(r.price)}
          {moved !== 0 && (
            <span className={moved > 0 ? "ml-1 text-positive" : "ml-1 text-critical"}>
              {moved > 0 ? "▲" : "▼"}
            </span>
          )}
        </Published>
      </span>

      <span className="w-16 shrink-0 text-right text-2xs num-tabular">
        {r.price_covered ? (
          <span className={r.price_direction === "up" ? "text-positive" : "text-critical"}>
            <Est method="Modelled from stored transfer snapshots since the last confirmed change. Not FPL's own figure.">
              {`${Math.round(Math.abs(r.price_pRise) * 100)}%`}
            </Est>
          </span>
        ) : (
          <span className="text-ink-lo" title="No stored snapshot history for this player yet">
            —
          </span>
        )}
      </span>
    </li>
  );
}
