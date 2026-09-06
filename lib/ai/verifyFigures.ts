import { CLUB } from "@/config/clubs";

/**
 * Let the gaffer use numbers — but only the ones we gave it, about the player
 * we gave them about, measuring the thing we measured.
 *
 * The first version checked one thing: does this number appear anywhere in the
 * facts? That is a useful filter and it is not a guarantee, because a number
 * carries no attribution. With facts {player:"Saka", goals:13} it accepted all
 * four of these:
 *
 *   "Haaland scored 13 goals."   — right number, wrong player
 *   "Saka costs £13m."           — right number, wrong measure
 *   "Saka scored 2 goals."       — unsupported count (2 was on the free list)
 *   "Saka is definitely fit."    — no number at all, and a claim we cannot back
 *
 * A verifier that accepts those cannot support the claim that this assistant
 * does not invent things, and the bigger the fact object gets the easier those
 * collisions become. So a figure is now checked as a *claim* — the number, the
 * entity it is attributed to, and the measure it is attached to must agree with
 * one evidence record. Anything unattributable is dropped with its sentence,
 * because a sentence with a hole in it still reads as a claim.
 */

/* ─────────────────────────────  metric classes  ───────────────────────────── */

/**
 * How a number in prose announces what it measures, and which fact keys carry
 * that measure. Both halves are needed: "£13m" says money, and only a fact
 * stored under a money-ish key can license it.
 *
 * Deliberately conservative — a metric that is not listed here is simply not
 * attached, and falls back to the plain does-this-number-exist check.
 */
interface Metric {
  name: string;
  /** Matched against the words immediately around the number. */
  prose: RegExp;
  /** Matched against the fact key the number was stored under. */
  keys: RegExp;
}

const METRICS: Metric[] = [
  { name: "money", prose: /£\s*$|^\s*m\b|^\s*million|cost|price|worth|value|bank/i, keys: /price|cost|value|bank|sell|buy/i },
  { name: "percent", prose: /^\s*%|per ?cent|owned|ownership|\beo\b/i, keys: /percent|owned|ownership|\beo\b|chance|share|pstart|p60|probab/i },
  { name: "points", prose: /point|\bpts\b/i, keys: /point|pts|\bxp\b|^ep|epnext|score|total/i },
  { name: "minutes", prose: /minute|\bmins?\b/i, keys: /minute|mins/i },
  { name: "goals", prose: /goal/i, keys: /goal/i },
  { name: "assists", prose: /assist/i, keys: /assist/i },
  { name: "bonus", prose: /bonus/i, keys: /bonus/i },
  { name: "cleanSheets", prose: /clean ?sheet/i, keys: /clean/i },
  { name: "rank", prose: /\brank/i, keys: /rank/i },
];

/** Words either side of a number that say what it measures. */
const BEFORE = 20;
const AFTER = 16;

function metricAround(text: string, at: number, len: number): Metric | null {
  const before = text.slice(Math.max(0, at - BEFORE), at);
  const after = text.slice(at + len, at + len + AFTER);
  for (const m of METRICS) {
    // The prose pattern is written to be tried against both sides; anchors in
    // it (^ / $) pick the side that matters for units like "£" and "%".
    if (m.prose.test(before) || m.prose.test(after)) return m;
  }
  return null;
}

/* ────────────────────────────  name vocabulary  ──────────────────────────── */

const CLUB_WORDS = new Set(
  Object.values(CLUB).flatMap((c) => [c.name.toLowerCase(), c.code.toLowerCase()]),
);

/** Capitalised words that are not somebody's name. */
const NOT_A_NAME = new Set([
  "i", "you", "your", "he", "his", "they", "their", "it", "we", "our",
  "the", "a", "an", "and", "but", "so", "if", "then", "that", "this",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
  "gw", "gameweek", "fpl", "defcon", "premier", "league", "captain", "bench",
]);

/* ──────────────────────────────  the evidence  ────────────────────────────── */

export interface Evidence {
  /** Every figure in the facts, however it was stored. */
  all: Set<string>;
  /** Figures stored under a key belonging to each metric class. */
  byMetric: Map<string, Set<string>>;
  /** Lower-cased entity name → the figures recorded about that entity. */
  byEntity: Map<string, { all: Set<string>; byMetric: Map<string, Set<string>> }>;
  /** Every entity name the facts mention, lower-cased. */
  names: Set<string>;
  /** True when the facts carry anything about availability or fitness. */
  hasAvailability: boolean;
}

/** Keys whose string value names the thing an object is about. */
const NAME_KEY = /^(name|webname|player|teamname|entryname|club)$/i;
/**
 * FPL's own word on whether somebody can play, recognised by what it SAYS
 * rather than by the field it arrived in.
 *
 * Keying this off field names was wrong and the app's own briefing proved it:
 * "Your captain Haaland is out: Knock · Expected back 8 Mar" is backed by the
 * feed, but its evidence sits under `label`, so a key-name rule threw away a
 * true sentence. Availability evidence is a phrase like "knock" or "expected
 * back", wherever it is stored.
 */
const AVAILABILITY_KEY = /status|availab|news|chance|flag|injur|suspend|doubt/i;
const AVAILABILITY_TEXT =
  /\b(?:knock|injur|injury|strain|ankle|hamstring|groin|calf|knee|back|illness|ill|virus|suspend|ban|doubt|fitness|fit|out|unavailable|expected back|chance of playing|return|late test|assess)/i;

function variants(n: number): string[] {
  if (!Number.isFinite(n)) return [];
  // A fact of 13.0 licenses "13"; 32.4 licenses "32", because rounding for
  // prose is not inventing.
  return [normalise(n), normalise(Math.round(n)), normalise(Math.trunc(n))];
}

function metricsForKey(key: string): string[] {
  return METRICS.filter((m) => m.keys.test(key)).map((m) => m.name);
}

/**
 * Walk the facts once and record what each number is evidence *of* — the
 * measure its key names, and the entity whose object it sits in.
 */
export function buildEvidence(facts: unknown): Evidence {
  const ev: Evidence = {
    all: new Set(),
    byMetric: new Map(),
    byEntity: new Map(),
    names: new Set(),
    hasAvailability: false,
  };

  const bucket = (map: Map<string, Set<string>>, metric: string, figure: string) => {
    const set = map.get(metric) ?? new Set<string>();
    set.add(figure);
    map.set(metric, set);
  };

  const record = (key: string, n: number, entity: string | null) => {
    const metrics = metricsForKey(key);
    for (const f of variants(n)) {
      ev.all.add(f);
      for (const m of metrics) bucket(ev.byMetric, m, f);
      if (entity) {
        const e = ev.byEntity.get(entity) ?? { all: new Set<string>(), byMetric: new Map() };
        e.all.add(f);
        for (const m of metrics) bucket(e.byMetric, m, f);
        ev.byEntity.set(entity, e);
      }
    }
  };

  const walk = (value: unknown, key: string, entity: string | null): void => {
    if (value == null) return;
    if (typeof value === "number") return record(key, value, entity);
    if (typeof value === "string") {
      if (value.trim() !== "" && (AVAILABILITY_KEY.test(key) || AVAILABILITY_TEXT.test(value))) {
        ev.hasAvailability = true;
      }
      // A fact written as a sentence carries its own measure and its own
      // subject: "Haaland (32% EO)" says 32 is a percentage and says whose.
      // Reading only the key ("threats") loses both, and then the verifier
      // rejects the app's own true statement about it.
      const named: string[] = [];
      for (const w of value.matchAll(/[A-Z][\p{L}'’-]+/gu)) {
        const low = w[0].toLowerCase();
        if (!CLUB_WORDS.has(low) && !NOT_A_NAME.has(low)) {
          named.push(low);
          ev.names.add(low);
        }
      }
      const subject = named.length === 1 ? named[0] : entity;
      for (const m of value.matchAll(/-?\d+(?:\.\d+)?/g)) {
        const inner = metricAround(value, m.index ?? 0, m[0].length);
        record(inner ? `${key} ${inner.name}` : key, Number(m[0]), subject);
      }
      return;
    }
    if (Array.isArray(value)) return value.forEach((v) => walk(v, key, entity));
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      // An object that names itself is an entity, and every number inside it is
      // evidence about that entity rather than about the squad in general.
      let own = entity;
      for (const [k, v] of Object.entries(obj)) {
        if (NAME_KEY.test(k) && typeof v === "string" && v.trim() !== "") {
          own = v.trim().toLowerCase();
          ev.names.add(own);
        }
      }
      for (const [k, v] of Object.entries(obj)) {
        if (AVAILABILITY_KEY.test(k) && v != null && v !== "") ev.hasAvailability = true;
        walk(v, k, own);
      }
      return;
    }
  };

  walk(facts, "", null);
  return ev;
}

function normalise(n: number): string {
  // Trailing zeros are noise: 13, 13.0 and 13.00 are the same claim.
  return String(Math.round(n * 100) / 100);
}

/** Kept for callers that only need the flat set — the old contract. */
export function allowedFigures(facts: unknown): Set<string> {
  return buildEvidence(facts).all;
}

/** Every number a piece of prose actually asserts. */
export function figuresIn(text: string): string[] {
  const out: string[] = [];
  // Commas inside a number are separators, not decimals: 1,204 is one figure.
  for (const m of text.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(normalise(n));
  }
  return out;
}

/* ────────────────────────────  unbacked claims  ───────────────────────────── */

/**
 * Assertions about whether somebody can play, stated flatly. Availability is
 * FPL's word and never ours (AGENTS.md), so these need a fact behind them.
 * Hedged forms are deliberately absent: "looks sharp", "may start" and "if he
 * plays" claim nothing and stay.
 */
const ASSERTED_AVAILABILITY =
  /\b(?:definitely|certainly|guaranteed)\b|\b(?:is|are|will be)\s+(?:definitely\s+)?(?:fit|unfit|injured|out|suspended|available|starting)\b|\bwill\s+(?:start|play|feature)\b|\bruled out\b/i;

/* ──────────────────────────────  the check  ───────────────────────────────── */

export interface VerifyResult {
  /** The reply with every unverifiable sentence removed. */
  text: string;
  /** Figures the model asserted that the facts do not support. */
  invented: string[];
  /** True when nothing had to be dropped. */
  clean: boolean;
}

/**
 * Small counting numbers carry no claim when nothing is being measured — "the
 * first thing to say", "a couple of weeks". They are NOT free once attached to
 * a measure: "scored 2 goals" is a statistic and needs evidence like any other.
 */
const FREE = new Set(["0", "1", "2", "3"]);


/**
 * Verbs that take a footballer as their subject. They are how a capitalised
 * word at the start of a sentence is told apart from an ordinary opener: the
 * gaffer begins sentences with "Hold", "Since" and "Your" all the time, and
 * none of those is a person — but "Haaland scored" is, and skipping every
 * sentence-initial capital let exactly that claim through.
 */
const PLAYER_PREDICATE =
  /^(?:scored?|scores|has|had|is|was|are|were|costs?|plays?|played|starts?|started|returns?|misses|missed|faces?|takes?|took|brought|brings|carries|carried|leads?|led|sits?|goes|went|keeps?|kept)\b/i;

/** Names the sentence appears to talk about, split into known and unknown. */
function namesIn(sentence: string, known: Set<string>): { known: string[]; unknown: string[] } {
  const hit: string[] = [];
  for (const name of known) if (sentence.toLowerCase().includes(name)) hit.push(name);

  const unknown: string[] = [];
  const trimmed = sentence.trimStart();
  const first = trimmed.split(/\s+/)[0]?.replace(/[^\p{L}'’-]/gu, "") ?? "";
  const afterFirst = trimmed.slice(trimmed.indexOf(first) + first.length).trimStart();

  for (const m of sentence.matchAll(/[A-Z][\p{L}'’-]+/gu)) {
    const w = m[0];
    const low = w.toLowerCase();
    if (NOT_A_NAME.has(low) || CLUB_WORDS.has(low)) continue;
    if (hit.some((n) => n.includes(low))) continue;
    // A capital at the start only names somebody if what follows reads as
    // something a footballer does.
    if (w === first && !PLAYER_PREDICATE.test(afterFirst)) continue;
    unknown.push(low);
  }
  return { known: hit, unknown };
}

export function verifyFigures(text: string, facts: unknown): VerifyResult {
  const ev = buildEvidence(facts);
  const invented: string[] = [];

  // Split on sentence ends, keeping the punctuation with its sentence. The
  // period in 42.5 is not a sentence end: splitting there left an orphan "5"
  // that no fact could license, so a true statement was dropped for a number
  // it never made.
  const sentences = text.match(/(?:[^.!?]|\.(?=\d))+[.!?]*/g) ?? [text];
  const kept: string[] = [];

  for (const s of sentences) {
    const { known, unknown } = namesIn(s, ev.names);
    // One named subject means its figures are the ones in scope. Several, or
    // none, and we cannot attribute, so the whole fact object stands in.
    const scope =
      known.length === 1 ? ev.byEntity.get(known[0]) ?? { all: ev.all, byMetric: ev.byMetric } : null;
    const allowedAll = scope?.all ?? ev.all;
    const allowedByMetric = scope?.byMetric ?? ev.byMetric;

    let bad = false;

    // A flat claim about fitness needs FPL's word behind it.
    if (ASSERTED_AVAILABILITY.test(s) && !ev.hasAvailability) {
      bad = true;
    }

    for (const m of s.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) {
      const figure = normalise(Number(m[0].replace(/,/g, "")));
      if (!Number.isFinite(Number(m[0].replace(/,/g, "")))) continue;
      const metric = metricAround(s, m.index ?? 0, m[0].length);

      if (metric) {
        // Attached to a measure: only evidence of THAT measure licenses it.
        if (!(allowedByMetric.get(metric.name)?.has(figure) ?? false)) {
          invented.push(figure);
          bad = true;
        }
        continue;
      }
      if (!allowedAll.has(figure) && !FREE.has(figure)) {
        invented.push(figure);
        bad = true;
      }
    }

    // A statistic attributed to somebody the facts have never heard of is
    // unattributable however well the number itself checks out.
    if (!bad && unknown.length > 0 && ev.names.size > 0 && figuresIn(s).some((f) => !FREE.has(f))) {
      bad = true;
    }

    if (bad) continue;
    kept.push(s.trim());
  }

  return {
    text: kept.join(" ").replace(/\s{2,}/g, " ").trim(),
    invented,
    clean: invented.length === 0 && kept.length === sentences.length,
  };
}
