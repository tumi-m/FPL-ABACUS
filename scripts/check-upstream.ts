/**
 * Upstream drift check.
 *
 * The e2e suite runs against fixtures, which is what makes it deterministic —
 * and what means it can no longer notice FPL changing the shape of a payload.
 * This job restores that, separately and for what it is: an upstream question,
 * asked once a day, that never reddens a commit.
 *
 * The zod schemas in lib/fpl/schemas.ts are the contract. Parsing live
 * payloads through them IS the test. A renamed or dropped field fails here by
 * name, the day it happens, rather than surfacing later as a blank page nobody
 * can explain — which `docs/NOTES.md` records happening twice already
 * (teams[].strength going nullable, and the standings `id` removal).
 *
 *   pnpm exec tsx scripts/check-upstream.ts
 */

import { z } from "zod";
import {
  zBootstrap,
  zEntry,
  zFixture,
  zLive,
} from "../lib/fpl/schemas";

const BASE = process.env.FPL_API_BASE ?? "https://fantasy.premierleague.com/api";
/** A long-lived public entry, only ever read. */
const SAMPLE_ENTRY = 1851681;

interface Probe {
  name: string;
  path: string;
  schema: z.ZodTypeAny;
}

async function main() {
  // An outage is not drift, and that has to hold for the FIRST call too —
  // the bootstrap read used to sit outside every guard, so a rate-limited
  // runner exited 1 and reported FPL having a bad morning as a broken
  // contract. Unreachable is a clean skip; only a payload we can read and
  // cannot parse is a failure.
  let boot: unknown;
  try {
    boot = await fetchJson(`${BASE}/bootstrap-static/`);
  } catch (err) {
    console.warn(`skip  upstream unreachable (${(err as Error).message}) — not drift, nothing to check`);
    return;
  }
  const parsedBoot = zBootstrap.safeParse(boot);
  // The current gameweek decides which live endpoint is worth asking for, so
  // it has to come out of the payload before the rest of the probes are built.
  const currentGw =
    parsedBoot.success
      ? (parsedBoot.data.events.find((e) => e.is_current)?.id ??
         parsedBoot.data.events.find((e) => e.is_next)?.id ??
         1)
      : 1;

  const probes: Probe[] = [
    { name: "bootstrap-static", path: "/bootstrap-static/", schema: zBootstrap },
    { name: "fixtures", path: "/fixtures/", schema: z.array(zFixture) },
    { name: "entry", path: `/entry/${SAMPLE_ENTRY}/`, schema: zEntry },
    { name: "event live", path: `/event/${currentGw}/live/`, schema: zLive },
  ];

  const failures: string[] = [];
  for (const probe of probes) {
    try {
      const body = probe.path === "/bootstrap-static/" ? boot : await fetchJson(`${BASE}${probe.path}`);
      const parsed = probe.schema.safeParse(body);
      if (parsed.success) {
        console.log(`ok    ${probe.name}`);
        continue;
      }
      // Only the first few issues: a shape change usually breaks one field in
      // every row, and ten thousand identical lines hide the one that matters.
      const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`);
      failures.push(`${probe.name} — ${issues.join("; ")}`);
      console.error(`DRIFT ${probe.name}`);
      for (const issue of issues) console.error(`        ${issue}`);
    } catch (err) {
      // An outage is not drift. Say which one this is, and do not fail on it:
      // this job exists to report a changed contract, not FPL's uptime.
      console.warn(`skip  ${probe.name} — unreachable (${(err as Error).message})`);
    }
  }

  if (failures.length > 0) {
    console.error(`\nupstream drift: ${failures.length} endpoint(s) no longer match our schemas`);
    process.exit(1);
  }
  console.log("\nno drift — every probed payload still parses");
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "user-agent": "gaffer-drift-check" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

main().catch((err) => {
  // Reachability is handled inside; anything arriving here is our own fault.
  console.error(`upstream drift check crashed: ${(err as Error).message}`);
  process.exit(1);
});
