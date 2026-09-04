/**
 * B4 — the grounding harness.
 *
 * Routing is half the contract; the other half is that the gaffer never
 * speaks a figure the resolver did not hand it. This suite resolves a sample
 * of routed questions against a stubbed upstream (the recorded fixture
 * bootstrap, no live calls) and then audits every card on one property:
 *
 *   every number in `prose` must appear in, or be derived from, the card's
 *   own props/note — the facts object. A figure in prose that exists nowhere
 *   in the resolved data is an invented number and fails CI.
 *
 * The resolver's template prose is generated from resolved data, so a pass
 * here is the norm — this suite exists so that stays true. It is the same
 * guarantee the sentence gate gives the model's voice, pinned on our own
 * templates: we hold ourselves to the rule we wrote for the model.
 */
import { describe, expect, it, vi, beforeAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { route } from "@/lib/genui/router";
import { resolveCard } from "@/lib/genui/resolve";
import { REGISTRY } from "@/lib/genui/registry";

const FIXTURES = path.join(import.meta.dirname, "..", "..", "..", "__fixtures__");

/** Recorded upstream fixture — a real bootstrap captured by record-fixtures. */
const BOOTSTRAP = JSON.parse(readFileSync(path.join(FIXTURES, "bootstrap.json"), "utf8"));

/**
 * Stub every upstream path the resolver can touch. Anything not in the
 * fixture set returns a reasonable empty — the resolver is required to
 * degrade, and this suite pins that too.
 */
function stubUpstream() {
  const live = (() => {
    try {
      return JSON.parse(readFileSync(path.join(FIXTURES, "live-gw1.json"), "utf8"));
    } catch {
      return { elements: [] };
    }
  })();
  const fixtures = (() => {
    try {
      return JSON.parse(readFileSync(path.join(FIXTURES, "fixtures-gw1.json"), "utf8"));
    } catch {
      return [];
    }
  })();

  return vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), { status });
      if (url.includes("bootstrap-static")) return body(BOOTSTRAP);
      if (url.includes("/event/")) return body(live);
      if (url.includes("/fixtures/")) return body(fixtures);
      if (url.includes("/event-status/")) return body({ status: [] });
      if (url.includes("/picks/")) return body({ picks: [], entry_history: {}, chips: [] });
      if (url.includes("/transfers/")) return body([]);
      if (url.includes("/history/")) return body({ current: [], chips: [] });
      if (url.includes("entry/")) throw new Error("404");
      if (url.includes("leagues-classic")) return body({ standings: { results: [] } });
      if (url.includes("element-summary")) return body({ history: [], fixtures: [] });
      // The resolver must survive anything else with its honest fallbacks.
      throw new Error(`404 ${url}`);
    }),
  );
}

/**
 * Pull numeric tokens out of a string. Matches integers, decimals, signed
 * values, thousands-separated, rank suffixes and percentages — the shapes
 * template prose actually emits. Skews toward over-matching: the audit's
 * follow-up check (does the figure appear in the card's data) is what
 * decides, so a generous capture is the safe direction.
 */
function figuresIn(text: string): string[] {
  const matches = text.match(/-?£?\d[\d,.]*%?/g) ?? [];
  return matches.filter((m) => !/^[.,]$/.test(m));
}

/** Is `figure` accounted for somewhere in the card's resolved data? */
function figureGrounded(figure: string, card: { props: Record<string, unknown> | null; note?: string }): boolean {
  // Normalise: strip £, thousands separators, trailing %.
  const norm = (s: string) => s.replace(/[£,]/g, "").replace(/%$/, "");
  const target = norm(figure);
  // Walk the entire JSON of props + note and look for the figure as a
  // substring of its serialised form — the same rule the figure gate uses:
  // if the number cannot be found in the data, it is not grounded.
  const corpus = JSON.stringify(card.props ?? {}) + (card.note ? ` ${card.note}` : "");
  if (corpus.includes(target)) return true;
  // Numbers are often rounded in prose but raw in props (2.4 vs 2.4123):
  // accept the prose figure when it is a prefix of a longer decimal in data.
  const num = Number(target.replace(/^-/, ""));
  if (!Number.isFinite(num)) return false;
  const pattern = new RegExp(`${target.replace(".", "\\.")}(\\d)`);
  return pattern.test(corpus);
}

/** The questions this suite resolves — one per intent, stable and fast. */
const GROUNDING_SAMPLES = [
  "should I captain haaland?",
  "will mbeumo rise tonight?",
  "is it worth taking a hit?",
  "how are liverpool's fixtures looking?",
  "does gabriel hit 10 defcon?",
  "what rank could I finish?",
  "when should I play my wildcard?",
  "who is flagged this week?",
  "what's the latest gossip?",
  "how did I do last week?",
  "where is the alpha this week?",
];

beforeAll(() => {
  stubUpstream();
});

afterEach(() => {
  // resolveCard's internals may install their own stubs; restore ours.
  stubUpstream();
});

describe("B4 answer quality — every prose figure is grounded", () => {
  it.each(GROUNDING_SAMPLES)("grounds: %s", async (q) => {
    const r = route(q);
    if (!r) return; // routing floor is the other suite's job
    const card = await resolveCard(r.component, r.params, {
      teamId: null,
      currentGw: 1,
      matchday: null,
    });
    if (!card) {
      // A null card is an honest "no data" — allowed; the UI says so.
      return;
    }
    const ungrounded = figuresIn(card.prose).filter((f) => !figureGrounded(f, card));
    expect(
      ungrounded,
      `"${q}" prose contains figures the resolver did not produce: ${ungrounded.join(", ")}\nprose: ${card.prose}\nnote: ${card.note ?? ""}\nprops: ${JSON.stringify(card.props ?? {}).slice(0, 400)}`,
    ).toEqual([]);
    // The card always names a registry component — even the resolver.
    expect(Object.keys(REGISTRY)).toContain(card.component);
  }, 30_000);
});