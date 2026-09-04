import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getBootstrapLite } from "@/lib/fpl/bootstrapLite";
import { Countdown } from "@/components/gaffer/Countdown";
import { Cockpit, CockpitKey } from "@/components/gaffer/deadline/Cockpit";
import { CalendarSubscribe } from "@/components/gaffer/deadline/CalendarSubscribe";
import { buildCockpit } from "@/lib/server/buildCockpit";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Deadline Cockpit",
  description: "Am I done? One screen of verdicts: legality, flags, the armband, the free transfer and the price traffic.",
};

/**
 * The Deadline Cockpit (v10 A1) — the ninety-minutes-before-deadline screen.
 *
 * It used to be a triage of availability lanes, which answered "who is
 * flagged" and nothing else. It is now one column of verdicts: is the XI
 * legal, who is flagged, where the armband sits, what the free transfer is
 * worth and who is closing on a price move — each traceable to an engine,
 * each with the evidence a tap away. The countdown and the calendar feed
 * keep their places: the clock above the verdicts, the subscribe card below.
 */
export default async function DeadlinePage() {
  const store = await cookies();
  const raw = store.get("gaffer_team")?.value;
  const teamId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (!teamId) redirect("/");

  // The feed URL has to be absolute — it is handed to an operating system, not
  // followed inside the app — so it comes off the request rather than off an
  // env var that is only right in one environment.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const [cockpitData, boot] = await Promise.all([
    buildCockpit(teamId),
    getBootstrapLite(),
  ]);
  const nextEvent =
    boot.events.find((e) => e.is_next) ?? boot.events.find((e) => e.is_current) ??
    boot.events[boot.events.length - 1];

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Deadline Cockpit</h1>
      <div className="grid gap-4 md:grid-cols-[minmax(280px,360px)_1fr]">
        <div className="space-y-3">
          <Countdown deadlineTime={nextEvent?.deadline_time ?? cockpitData.nextDeadline ?? boot.events[boot.events.length - 1].deadline_time} />
          <div className="flex items-center justify-between rounded-lg bg-surface-1 card-ring px-4 py-3">
            <span className="upper-label text-2xs text-ink-lo">Banked</span>
            <span className="fig-num text-lg text-ink-1">
              £{(cockpitData.bankTenths / 10).toFixed(1)}m
            </span>
          </div>
          <CockpitKey blocks={cockpitData.cockpit.blocks} />
        </div>
        <div className="space-y-3">
          <Cockpit cockpit={cockpitData.cockpit} />
          <p className="text-2xs leading-relaxed text-ink-lo">
            {cockpitData.projectionMissed
              ? "The projection desk did not answer in time, so the armband and the free transfer are not priced — open the Planner to price them directly."
              : "Every verdict above is computed from the same engines the Planner reads. Figures marked ~ are modelled estimates."}
          </p>
        </div>
      </div>
      <CalendarSubscribe origin={origin} />
    </div>
  );
}