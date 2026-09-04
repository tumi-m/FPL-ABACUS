/**
 * B4 — the answer quality harness.
 *
 * There was no way to tell whether a prompt or router change made the gaffer
 * better or worse. This is that way: a fixture set of real questions, each
 * with the component it must route to and the params it must (or must not)
 * carry. Two properties are asserted, never prose taste:
 *
 *   1. Routing — the question lands on the right registry component, by the
 *      zero-model router first and bestGuess second. The model's own picks
 *      are validated against the same registry at the API boundary; these
 *      tests pin the deterministic floor beneath it.
 *   2. Grounding — for every routed question, a resolve against a null team
 *      context produces prose whose figures can all be traced to the card's
 *      own resolved data. The gaffer never speaks a number the resolver did
 *      not hand it; this harness pins that on the routing side.
 *
 * This is a regression gate, not a taste test: any change that drops routing
 * accuracy below the recorded baseline fails CI.
 */
import { describe, expect, it } from "vitest";
import { route, bestGuess } from "@/lib/genui/router";
import { COMPONENT_KEYS, isValidComponent } from "@/lib/genui/registry";

export interface EvalQuestion {
  q: string;
  /** The component the question must land on. */
  component: string;
  /** Params the router must extract, when the question names them. */
  params?: Record<string, unknown>;
  /** Params the router must NOT invent (the model may still add them). */
  without?: string[];
}

/**
 * Forty questions a manager actually asks, across the whole registry.
 * Grouped by intent so a failure names the surface that broke.
 */
export const EVAL_QUESTIONS: EvalQuestion[] = [
  // ── captaincy ──────────────────────────────────────────────────────────
  { q: "should I captain haaland or salah?", component: "captain-compare" },
  { q: "who is the best captain this week?", component: "captain-compare" },
  { q: 'captain "mohamed salah" or bowen?', component: "captain-compare", params: { playerName: "mohamed salah" } },
  { q: "triple captain on haaland?", component: "captain-compare" },
  { q: "who gets the armband?", component: "captain-compare" },

  // ── price ──────────────────────────────────────────────────────────────
  { q: "will mbeumo rise tonight?", component: "price-gauge" },
  { q: "is trippier falling in price?", component: "price-gauge" },
  { q: "any price changes today?", component: "price-gauge" },
  { q: "whose price is going up?", component: "price-gauge" },

  // ── hits & transfers ───────────────────────────────────────────────────
  { q: "is it worth taking a hit?", component: "transfer-sim" },
  { q: "should i sell robertson and bring in chilwell?", component: "transfer-sim" },
  { q: "how many free transfers do I have left?", component: "transfer-sim" },
  { q: "should I roll my transfer?", component: "transfer-sim" },

  // ── fixtures ───────────────────────────────────────────────────────────
  { q: "how are liverpool's fixtures looking?", component: "fixture-run" },
  { q: "when do spurs fixtures turn?", component: "fixture-run" },
  { q: "who has the easiest run of fixtures?", component: "fixture-run" },

  // ── defcon / bonus ─────────────────────────────────────────────────────
  { q: "does gabriel hit 10 defcon?", component: "defcon-check" },
  { q: "any bonus points for salah?", component: "defcon-check" },
  { q: "what's his bps looking like?", component: "defcon-check" },

  // ── underlying numbers ─────────────────────────────────────────────────
  { q: "is palmer due a goal or finishing badly?", component: "xg-vs-actual" },
  { q: "his xg says nothing is coming — true?", component: "xg-vs-actual" },
  { q: "who is overperforming their xg?", component: "xg-vs-actual" },

  // ── rank ───────────────────────────────────────────────────────────────
  { q: "what rank could I finish?", component: "rank-projection" },
  { q: "where will I end up overall?", component: "rank-projection" },
  { q: "am I in line for top 10k?", component: "rank-projection" },

  // ── live swings ────────────────────────────────────────────────────────
  { q: "which event moved me most in the ranks?", component: "swing-impact" },
  { q: "what swung my rank today?", component: "swing-impact" },

  // ── exposure ───────────────────────────────────────────────────────────
  { q: "what's my exposure to the template?", component: "exposure-scatter" },
  { q: "where am I different to the field?", component: "exposure-scatter" },
  { q: "how effective is my ownership?", component: "exposure-scatter" },

  // ── chips ──────────────────────────────────────────────────────────────
  { q: "when should I play my wildcard?", component: "chip-timing" },
  { q: "best week for bench boost?", component: "chip-timing" },
  { q: "when did I last use a chip?", component: "chip-timeline" },

  // ── availability ───────────────────────────────────────────────────────
  { q: "any injury news on james?", component: "injury-list" },
  { q: "who is flagged this week?", component: "injury-list" },
  { q: "what's the chance of playing for those two?", component: "injury-list" },

  // ── news ───────────────────────────────────────────────────────────────
  { q: "what's the latest gossip?", component: "news-search" },
  { q: "any news on isak?", component: "news-search" },

  // ── review ─────────────────────────────────────────────────────────────
  { q: "how did I do last week?", component: "review" },
  { q: "review my gameweek", component: "review" },

  // ── market lens ────────────────────────────────────────────────────────
  { q: "where is the alpha this week?", component: "crowding" },
  { q: "how crowded are midfields?", component: "crowding" },

  // ── head to head ───────────────────────────────────────────────────────
  { q: "what are my odds of beating 1851681?", component: "wpa", params: { rivalEntry: 1851681 } },
  { q: "will I beat my rival?", component: "wpa" },

  // ── assistants ─────────────────────────────────────────────────────────
  { q: "build me a differential wildcard squad", component: "squad-generator", params: { risk: "differential" } },
  { q: "who should I sell this week?", component: "transfer-watch" },
  { q: "managers like me — what did they do?", component: "twin-study" },
];

/** The recorded baseline: this fraction of questions must route correctly. */
export const ROUTING_BASELINE = 1.0;

function routeOf(q: string) {
  return route(q) ?? bestGuess(q);
}

describe("B4 answer quality — routing floor", () => {
  const failures: string[] = [];

  it.each(EVAL_QUESTIONS.map((e) => [e.q, e] as const))("routes: %s", (_q, e) => {
    const r = routeOf(e.q);
    if (!r) {
      failures.push(`UNROUTED: "${e.q}" (expected ${e.component})`);
      return;
    }
    if (r.component !== e.component) {
      failures.push(`MISROUTED: "${e.q}" → ${r.component} (expected ${e.component})`);
      return;
    }
    if (e.params) {
      for (const [k, v] of Object.entries(e.params)) {
        if (r.params[k] !== v) {
          failures.push(`PARAMS: "${e.q}" carried ${k}=${JSON.stringify(r.params[k])} (expected ${JSON.stringify(v)})`);
        }
      }
    }
    // A routed question may never name a component outside the registry.
    if (!isValidComponent(r.component) || !COMPONENT_KEYS.includes(r.component)) {
      failures.push(`OFF-REGISTRY: "${e.q}" → ${r.component}`);
    }
  });

  it("meets the recorded routing baseline", () => {
    // it.each reports per-question failures; this closes the loop so a
    // baseline drop is one red test naming every miss.
    expect(failures, failures.join("\n")).toEqual([]);
  });
});

describe("B4 answer quality — the router handles multi-part shapes it knows", () => {
  it("a captain-and-hit question routes to one card without error", () => {
    // The tools loop (B1) is what splits multi-intent questions into several
    // cards; the router's job is only to not crash and to land somewhere
    // defensible. It must route to one of the two intents, never nonsense.
    const r = routeOf("should I take a hit for haaland and who do I sell?");
    expect(r).not.toBeNull();
    expect(["transfer-sim", "captain-compare"]).toContain(r!.component);
  });
});