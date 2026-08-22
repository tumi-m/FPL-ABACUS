import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { fplFetch, FPL_BASE } from "@/lib/fpl/client";
import {
  zBootstrap,
  zClassicStandings,
  zElementSummary,
  zEntry,
  zEntryHistory,
  zEventStatus,
  zFixture,
  zLive,
  zPicks,
  zTransfers,
} from "@/lib/fpl/schemas";

const OUT = path.join(import.meta.dirname, "..", "__fixtures__");
const ENTRY_ID = Number(process.env.FPL_ENTRY_ID ?? 1851681);

async function currentGw(): Promise<number> {
  const boot = await fplFetch("/bootstrap-static/", zBootstrap);
  return boot.events.find((e) => e.is_current)?.id ?? boot.events.find((e) => !e.finished)?.id ?? 1;
}

function trimBootstrap<T extends { elements: unknown[] }>(boot: T): T {
  const MAX_ELEMENTS = 40;
  return { ...boot, elements: boot.elements.slice(0, MAX_ELEMENTS) };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const gw = await currentGw();
  console.log(`recording fixtures for GW${gw}, entry ${ENTRY_ID} from ${FPL_BASE}`);

  const jobs: [string, () => Promise<unknown>][] = [
    ["bootstrap.json", async () => trimBootstrap(await fplFetch("/bootstrap-static/", zBootstrap))],
    ["fixtures-gw1.json", () => fplFetch(`/fixtures/?event=${gw}`, z.array(zFixture))],
    ["live-gw1.json", () => fplFetch(`/event/${gw}/live/`, zLive)],
    ["event-status.json", () => fplFetch("/event-status/", zEventStatus)],
    [`entry-${ENTRY_ID}.json`, () => fplFetch(`/entry/${ENTRY_ID}/`, zEntry)],
    [`history-${ENTRY_ID}.json`, () => fplFetch(`/entry/${ENTRY_ID}/history/`, zEntryHistory)],
    [`transfers-${ENTRY_ID}.json`, () => fplFetch(`/entry/${ENTRY_ID}/transfers/`, zTransfers)],
    [`picks-${ENTRY_ID}-gw${gw}.json`, () => fplFetch(`/entry/${ENTRY_ID}/event/${gw}/picks/`, zPicks)],
    ["standings-314-p1.json", () => fplFetch("/leagues-classic/314/standings/?page_standings=1", zClassicStandings)],
    ["element-summary-1.json", () => fplFetch("/element-summary/1/", zElementSummary)],
  ];

  let status: unknown = null;
  for (const [file, job] of jobs) {
    try {
      const data = await job();
      if (file === "event-status.json") status = data;
      await writeFile(path.join(OUT, file), JSON.stringify(data, null, 2));
      console.log(`  ok  ${file}`);
    } catch (err) {
      console.warn(`  skip ${file}: ${err instanceof Error ? err.message : err}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  // The replay gate only runs against a FINAL gameweek. Drop the marker once
  // the recorded GW has data_checked so `pnpm replay` stops skipping.
  const events = (status as { events?: { id: number; data_checked: boolean }[] } | null)?.events;
  if (events?.find((e) => e.id === gw)?.data_checked) {
    await writeFile(
      path.join(OUT, "replay-ready"),
      JSON.stringify({ gw, recordedAt: new Date().toISOString() }, null, 2),
    );
    console.log(`  ok  replay-ready (GW${gw} final — replay gate armed)`);
  }

  console.log("done → __fixtures__/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
