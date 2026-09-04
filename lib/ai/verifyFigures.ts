/**
 * Let the gaffer use numbers — but only the ones we gave it.
 *
 * The rule that matters is "never invent a figure", and it was implemented as
 * "never state a figure": scrubFigures deleted every digit in the model's
 * reply. That is safe and it is also why the gaffer could never say anything
 * worth reading — "Haaland is on 13, two goals and three bonus" came out as
 * "Haaland is on , goals and bonus", so the prompt told it not to try, and
 * what was left was a horoscope beside a table of real numbers.
 *
 * Verification gets the same guarantee with none of that cost. Every figure in
 * the reply is checked against the facts the resolver supplied; anything that
 * does not appear there was invented, and the sentence carrying it is dropped
 * whole. Dropping the sentence rather than the digits matters — a sentence
 * with a hole in it still reads as a claim, and the reader cannot tell which
 * word went missing.
 */

/** Numbers pulled out of the fact object, at the precision they were given. */
export function allowedFigures(facts: unknown): Set<string> {
  const out = new Set<string>();
  const add = (n: number) => {
    if (!Number.isFinite(n)) return;
    out.add(normalise(n));
    // A fact of 13.0 licenses "13"; a fact of 32.4 licenses "32" because
    // rounding for prose is not inventing.
    out.add(normalise(Math.round(n)));
    out.add(normalise(Math.trunc(n)));
  };
  const walk = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === "number") return add(v);
    if (typeof v === "string") {
      for (const m of v.matchAll(/-?\d+(?:\.\d+)?/g)) add(Number(m[0]));
      return;
    }
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === "object") return Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(facts);
  return out;
}

function normalise(n: number): string {
  // Trailing zeros are noise: 13, 13.0 and 13.00 are the same claim.
  return String(Math.round(n * 100) / 100);
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

export interface VerifyResult {
  /** The reply with every unverifiable sentence removed. */
  text: string;
  /** Figures the model asserted that the facts do not support. */
  invented: string[];
  /** True when nothing had to be dropped. */
  clean: boolean;
}

/**
 * Ordinals and the small counting numbers carry no claim about the data —
 * "the first thing to say", "a couple of weeks" — so they never need a fact
 * behind them. Kept deliberately short: anything that could be a score, a
 * price, a rank or a percentage is not on it.
 */
const FREE = new Set(["0", "1", "2", "3"]);

export function verifyFigures(text: string, facts: unknown): VerifyResult {
  const allowed = allowedFigures(facts);
  const invented: string[] = [];

  // Split on sentence ends, keeping the punctuation with its sentence.
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const kept: string[] = [];

  for (const s of sentences) {
    const bad = figuresIn(s).filter((f) => !allowed.has(f) && !FREE.has(f));
    if (bad.length > 0) {
      invented.push(...bad);
      continue;
    }
    kept.push(s.trim());
  }

  return {
    text: kept.join(" ").replace(/\s{2,}/g, " ").trim(),
    invented,
    clean: invented.length === 0,
  };
}
