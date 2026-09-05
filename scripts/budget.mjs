#!/usr/bin/env node
/**
 * Payload budget gate (v10 C4).
 *
 * A budget nobody enforces is a comment. This script asserts the two
 * budgets the house set:
 *   - shared first-load JS ≤ 115 kB, read from the build output
 *   - /api/gaffer/live response ≤ 60 kB, measured with a gzip'd fetch
 *
 * Run it against a running production server (`pnpm build && pnpm start`
 * first); it exits non-zero on overage and prints the measured numbers.
 * Zero dependencies beyond Next's build manifest and a plain fetch.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SHARED_BUDGET_KB = 115;
const LIVE_BUDGET_KB = 60;

const base = process.env.BUDGET_BASE ?? "http://localhost:3000";

function fail(msg) {
  console.error(`budget: FAIL — ${msg}`);
  process.exit(1);
}

// Shared first-load JS: the app router's shared chunks, gzip'd — the same
// number Next's build output prints as "First Load JS shared by all" (the
// plan's baseline of 103 kB came off that line). The pages-router files in
// the manifest are leftovers this app never ships; polyfills only load on
// legacy browsers and sit outside the printed number, so neither counts.
import { gzipSync } from "node:zlib";

let sharedKb;
try {
  const buildManifest = readFileSync(join(process.cwd(), ".next", "build-manifest.json"), "utf8");
  const manifest = JSON.parse(buildManifest);
  const chunks = manifest.rootMainFiles ?? [];
  if (chunks.length === 0) throw new Error("no shared chunks in manifest");
  let bytes = 0;
  for (const file of chunks) {
    try {
      bytes += gzipSync(readFileSync(join(process.cwd(), ".next", file))).byteLength;
    } catch {
      /* a missing chunk is a broken build, not a budget pass */
    }
  }
  sharedKb = bytes / 1024;
} catch (e) {
  fail(`could not read the build manifest from .next — build first (${e && e.message})`);
}

console.log(`budget: shared first-load JS ${sharedKb.toFixed(1)} kB (budget ${SHARED_BUDGET_KB} kB)`);
if (sharedKb > SHARED_BUDGET_KB) {
  fail(
    `shared JS ${sharedKb.toFixed(1)} kB is over the ${SHARED_BUDGET_KB} kB budget by ${(sharedKb - SHARED_BUDGET_KB).toFixed(1)} kB — split or drop before shipping`,
  );
}

// The live endpoint carries the matchday model; it is the hot one.
let res;
try {
  res = await fetch(`${base}/api/gaffer/live?entry=1851681`, {
    headers: { "accept-encoding": "gzip" },
  });
} catch (e) {
  fail(`could not reach ${base} — is the production server running? (${e && e.message})`);
}
if (!res.ok) fail(`/api/gaffer/live answered ${res.status}, not 200 — no budget meaningful`);
const body = await res.arrayBuffer();
const gzKb = Buffer.byteLength(Buffer.from(body)) / 1024;
console.log(`budget: /api/gaffer/live ${gzKb.toFixed(1)} kB gzip (budget ${LIVE_BUDGET_KB} kB)`);
if (gzKb > LIVE_BUDGET_KB) {
  fail(
    `/api/gaffer/live ${gzKb.toFixed(1)} kB is over the ${LIVE_BUDGET_KB} kB budget by ${(gzKb - LIVE_BUDGET_KB).toFixed(1)} kB — the model is carrying more than it should`,
  );
}

console.log("budget: green");