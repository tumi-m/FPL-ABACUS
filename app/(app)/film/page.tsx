import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEntry, getHistory } from "@/lib/fpl/endpoints";
import { GwSigil } from "@/components/generative/GwSigil";
import { Aurora } from "@/components/generative/Aurora";

export const dynamic = "force-dynamic";
export const metadata = { title: "The Film" };

/**
 * The Film — your season as an archive. The sigil is deterministic art seeded
 * by entry + gameweek; the aurora is the only motion on the page and stops
 * under reduced-motion / Save-Data.
 */
export default async function FilmPage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/?next=/film");

  const [entry, history] = await Promise.all([getEntry(teamId), getHistory(teamId)]);
  const currentGw = history.current[history.current.length - 1]?.event ?? 1;
  const best = Math.min(...history.current.map((c) => c.overall_rank ?? Infinity));

  return (
    <div className="space-y-4">
      <section
        aria-label="Season cover"
        className="relative overflow-hidden rounded-lg has-gloss card-lift bg-raised p-6 md:p-10"
      >
        <Aurora seed={teamId} />
        <div className="relative flex flex-wrap items-center justify-between gap-8">
          <div>
            <p className="upper-label text-2xs text-ink-lo">FPL Gaffer presents</p>
            <h1 className="hero-figure mt-2 text-[clamp(40px,7vw,72px)] leading-none">The Film</h1>
            <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-ink-lo">
              {entry.name} · {history.current.length} gameweeks in the can
              {Number.isFinite(best) ? ` · best rank ${best.toLocaleString("en-GB")}` : ""}.
            </p>
          </div>
          <GwSigil seed={teamId * 1000 + currentGw} size={220} label={`Sigil for gameweek ${currentGw}`} />
        </div>
      </section>

      <section aria-label="Gameweek archive" className="rounded-lg bg-surface-1 card-ring p-5">
        <h2 className="upper-label text-2xs text-ink-lo">The reels</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...history.current].reverse().map((c) => {
            const chip = history.chips.find((ch) => ch.event === c.event)?.name ?? null;
            return (
              <li key={c.event} className="flex items-baseline justify-between gap-3 rounded-md bg-surface-0 px-3 py-2.5 card-ring">
                <span className="text-xs uppercase-label text-ink-lo">GW{c.event}</span>
                <span className="fig-num text-lg text-ink-hi">{c.points}</span>
                <span className="text-right text-xs text-ink-lo num-tabular">
                  {chip ? `${chip} · ` : ""}
                  {c.overall_rank ? c.overall_rank.toLocaleString("en-GB") : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-xs text-ink-lo">
        Same entry, same sigil — every render, forever. The generative layer is deterministic, so
        what you share is exactly what others see.
      </p>
    </div>
  );
}
