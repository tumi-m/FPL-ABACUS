/**
 * D4 — the chart palette audit.
 *
 * The rule, from the style guide: chart series use the validated 8-slot
 * palette, never UI accents; fixture heat is blue→green, never red→green;
 * club colour is identity (always paired with the code), never data.
 *
 * Enforced two ways:
 *
 *   1. No raw hex anywhere in components/charts/ — zero exceptions. The
 *      only hex in the app lives in globals.css (plus config/brand.ts for
 *      the meta tag).
 *   2. Every var(--*) token used in components/charts/ must be either a
 *      data-system token (series/seq/div/heat/surge/flare/defcon/bonus) or
 *      chrome (grid/axis/ink/surface/bg/line), or a DECLARED identity use
 *      below — single-mark emphasis in volt (style guide: "one line, one
 *      bar, one endpoint — that's an identity mark, not a series"), the
 *      price lane's amber, the lumen threshold rule's ice, background
 *      washes, and club rails. A new accent-coloured mark fails CI until it
 *      is declared here with its justification — that declaration IS the
 *      review.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const CHARTS_DIR = path.join(import.meta.dirname, "..", "components", "charts");

/** The validated 8-slot categorical palette, from the style guide. */
const VALIDATED_SERIES = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
];

/** Tokens that may encode data anywhere in components/charts/. */
const DATA_TOKENS = new Set([
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `--series-${n}`),
  "--seq-100",
  "--seq-250",
  "--seq-400",
  "--seq-550",
  "--seq-700",
  "--div-pos",
  "--div-neg",
  "--div-mid",
  ...[1, 2, 3, 4, 5, 6].map((n) => `--heat-${n}`),
  "--surge",
  "--flare",
  "--defcon",
  "--defcon-hit",
  "--bonus",
]);

/** Chrome tokens — structure and type, never data. */
const CHROME_TOKENS = new Set([
  "--grid",
  "--axis",
  "--line",
  "--line-hi",
  "--ink-1",
  "--ink-2",
  "--ink-3",
  "--ink-hi",
  "--ink-mid",
  "--ink-lo",
  "--ink-fixed-dark",
  "--ink-on-dark",
  "--on-accent",
  "--surface-1",
  "--surface-2",
  "--surface-3",
  "--bg-raised",
  "--bg-sunk",
]);

/**
 * Declared identity/chrome uses of accent tokens, per file. Each entry is a
 * conscious exception with its rule — add to this map (with the reason) when
 * a new mark needs an accent, never by widening the sets above.
 */
const DECLARED: Record<string, Record<string, string>> = {
  "RankCurve.tsx": {
    "--volt": "single-mark emphasis: your line + endpoint dot (style guide: one line is an identity mark, not a series)",
  },
  "EOScatter.tsx": {
    "--volt": "single-mark emphasis: the captain dot, named in the legend",
    "--ultra": "quadrant background wash at 0.05 opacity — ground, not data",
    "--flare": "quadrant background wash at 0.04 opacity — ground, not data",
  },
  "DistributionCurve.tsx": {
    "--volt": "single-mark emphasis: your-score rule",
  },
  "ProbabilityBand.tsx": {
    "--volt": "single-mark emphasis: the median line, named in the legend",
  },
  "PointsWaterfall.tsx": {
    "--volt": "single-mark emphasis: the total bar + captain marks (bars wear club identity)",
  },
  "Sparkline.tsx": {
    "--volt": "single-mark emphasis: the current-period segment + endpoint dot",
  },
  "Meter.tsx": {
    "--brand": "generic single-value progress chrome (volt = primary action)",
    "--warning": "price-lane progress (amber is price movement's meaning)",
    "--volt": "bullet-bar value mark — single value, no hue mapping",
  },
  "PriceGauge.tsx": {
    "--amber": "price-lane identity: pressure arc, velocity line, hero figure",
    "--flare": "trigger-zone status: tripped reads as risk",
  },
  "DefconRate.tsx": {
    "--ice": "lumen threshold rule + label — chrome reference, not data",
  },
  "OwnershipFlow.tsx": {},
  "ChipTimeline.tsx": {},
  "HeatGrid.tsx": {},
  "SwingBars.tsx": {},
  "XgVsActual.tsx": {},
  "FixtureSwing.tsx": {},
};

function chartFiles(): string[] {
  return readdirSync(CHARTS_DIR).filter((f) => f.endsWith(".tsx") && f !== "ChartFrame.tsx");
}

function varsIn(source: string): string[] {
  const out: string[] = [];
  const re = /var\(--([\w-]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) out.push(`--${m[1]}`);
  return [...new Set(out)];
}

describe("D4 chart palette audit", () => {
  it("the series registry is the validated 8-slot palette", () => {
    const series = readFileSync(
      path.join(import.meta.dirname, "..", "lib", "charts", "series.ts"),
      "utf8",
    );
    const found = [...series.matchAll(/"var\(--series-(\d)\)"/g)].map((m) => Number(m[1])).sort();
    expect(found).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const globals = readFileSync(
      path.join(import.meta.dirname, "..", "app", "globals.css"),
      "utf8",
    );
    for (let i = 0; i < VALIDATED_SERIES.length; i++) {
      const re = new RegExp(`--series-${i + 1}\\s*:\\s*(#[0-9a-fA-F]{6})`);
      const hit = globals.match(re);
      expect(hit, `--series-${i + 1} defined in globals.css`).toBeTruthy();
      expect(hit![1].toLowerCase()).toBe(VALIDATED_SERIES[i]);
    }
  });

  it("no raw hex in components/charts/", () => {
    const bad: string[] = [];
    for (const file of chartFiles()) {
      const source = readFileSync(path.join(CHARTS_DIR, file), "utf8");
      // url(#id) clip references are not colours — exclude them first.
      const scrubbed = source.replace(/url\(#[\w-]+\)/g, "url(#id)");
      const hits = scrubbed.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      for (const h of hits) bad.push(`${file}: ${h}`);
    }
    expect(bad, `raw hex in components/charts/ — move it to a token in globals.css:\n${bad.join("\n")}`).toEqual([]);
  });

  it("every accent token in components/charts/ is declared", () => {
    const bad: string[] = [];
    for (const file of chartFiles()) {
      const source = readFileSync(path.join(CHARTS_DIR, file), "utf8");
      const declared = DECLARED[file] ?? {};
      for (const token of varsIn(source)) {
        if (DATA_TOKENS.has(token) || CHROME_TOKENS.has(token)) continue;
        if (token.startsWith("--club-")) continue; // identity rails, always paired with the code
        if (token in declared) continue;
        bad.push(`${file}: ${token} — undeclared accent use`);
      }
      // Declared entries must still exist — a stale declaration hides drift.
      for (const token of Object.keys(declared)) {
        if (!source.includes(token)) bad.push(`${file}: stale declaration for ${token}`);
      }
    }
    expect(bad, `undeclared accent colours in components/charts/:\n${bad.join("\n")}`).toEqual([]);
  });
});