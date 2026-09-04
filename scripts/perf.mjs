#!/usr/bin/env node
/**
 * v10 C1 — cold-load perf harness.
 *
 * Measures LCP, CLS, TTFB and total transfer for the four heaviest routes on
 * a throttled 4G profile with a cold cache (fresh browser context per route).
 *
 * Usage:
 *   pnpm build && (pnpm start &) && pnpm perf
 *   PERF_BASE_URL=http://localhost:3000 PERF_TEAM_ID=1851681 pnpm perf
 *
 * The server must already be running (same contract as `pnpm e2e`, which
 * builds + starts its own). Every optimisation task in workstream C must
 * quote a before/after pair from this script in its commit message.
 */

import { chromium } from "@playwright/test";

const BASE = process.env.PERF_BASE_URL ?? "http://localhost:3000";
const TEAM_ID = process.env.PERF_TEAM_ID ?? "1851681";
const ROUTES = ["/live", "/field", "/planner", "/players"];

// Throttled 4G: ~1.6 Mbps down, 750 Kbps up, 150 ms RTT.
const PROFILE_4G = {
  offline: false,
  downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
  uploadThroughput: Math.floor((750 * 1024) / 8),
  latency: 150,
};

async function measureRoute(browser, route) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  // Cold cache per route: a fresh context carries no disk/memory cache.
  await context.addCookies([{ name: "gaffer_team", value: TEAM_ID, url: BASE }]);
  await context.addInitScript(() => {
    window.__gafferPerf = { lcp: 0, cls: 0 };
    const lcp = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.entryType === "largest-contentful-paint") window.__gafferPerf.lcp = e.startTime;
      }
    });
    lcp.observe({ type: "largest-contentful-paint", buffered: true });
    const cls = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.entryType === "layout-shift" && !e.hadRecentInput) window.__gafferPerf.cls += e.value;
      }
    });
    cls.observe({ type: "layout-shift", buffered: true });
  });

  const page = await context.newPage();
  const transfer = { total: 0, js: 0, requests: 0 };
  page.on("response", async (res) => {
    try {
      const buf = await res.body().catch(() => null);
      const bytes = buf ? buf.length : Number(res.headers()["content-length"] ?? 0);
      transfer.total += bytes;
      transfer.requests += 1;
      const url = res.url();
      if (url.endsWith(".js") || url.includes("/_next/static/")) transfer.js += bytes;
    } catch {
      transfer.requests += 1;
    }
  });

  // Throttle the page's own CDP session (per-page so routes stay independent).
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.emulateNetworkConditions", PROFILE_4G);

  const started = Date.now();
  let ok = true;
  let navMs = 0;
  try {
    const t0 = Date.now();
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 60_000 });
    navMs = Date.now() - t0;
    // Let late LCP settle (hero imagery arriving after idle).
    await page.waitForTimeout(1500);
  } catch {
    ok = false;
    navMs = Date.now() - started;
  }

  let timing = { ttfbMs: null, lcpMs: null, cls: null };
  try {
    timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const ttfb = nav ? nav.responseStart - nav.requestStart : null;
      const p = window.__gafferPerf ?? { lcp: 0, cls: 0 };
      return {
        ttfbMs: ttfb == null ? null : Math.round(ttfb),
        lcpMs: p.lcp ? Math.round(p.lcp) : null,
        cls: Math.round(p.cls * 1000) / 1000,
      };
    });
  } catch {
    ok = false;
  }
  await context.close();
  return {
    route,
    ok,
    navMs,
    ttfbMs: timing.ttfbMs,
    lcpMs: timing.lcpMs,
    cls: timing.cls,
    transferKb: Math.round(transfer.total / 1024),
    jsKb: Math.round(transfer.js / 1024),
    requests: transfer.requests,
  };
}

async function main() {
  const browser = await chromium.launch();
  const rows = [];
  for (const route of ROUTES) {
    const row = await measureRoute(browser, route);
    rows.push(row);
    console.log(
      `${row.ok ? "ok  " : "FAIL"} ${row.route.padEnd(9)} nav=${row.navMs}ms ` +
        `ttfb=${row.ttfbMs ?? "?"}ms lcp=${row.lcpMs ?? "?"}ms cls=${row.cls ?? "?"} ` +
        `xfer=${row.transferKb}kB js=${row.jsKb}kB reqs=${row.requests}`,
    );
  }
  await browser.close();

  console.log("\n| route | nav ms | TTFB ms | LCP ms | CLS | transfer kB | JS kB | reqs |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    console.log(
      `| ${r.route} | ${r.navMs} | ${r.ttfbMs ?? "—"} | ${r.lcpMs ?? "—"} | ${r.cls ?? "—"} | ${r.transferKb} | ${r.jsKb} | ${r.requests} |`,
    );
  }
  if (rows.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[perf] harness failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
