import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERSONA,
  GAFFER_CONSTRAINTS,
  PERSONAS,
  arcadeFacts,
  factsToPromptContext,
  personaById,
  personaFallback,
  personaPrompt,
  scrubFigures,
  type ArcadeMatchdayLite,
} from "@/lib/ai/personas";

describe("persona registry — the four arcade gaffers", () => {
  it("carries the four canon personas with unique ids", () => {
    expect(PERSONAS.map((p) => p.id)).toEqual(["oleg", "kofi", "mei", "ana"]);
    expect(PERSONAS.map((p) => p.name)).toEqual(["OLEG", "KOFI", "MEI", "ANA"]);
    expect(new Set(PERSONAS.map((p) => p.role)).size).toBe(4);
    expect(new Set(PERSONAS.map((p) => p.accentVar)).size).toBe(4);
  });

  it("each persona has a distinct analytical lens", () => {
    const voices = PERSONAS.map((p) => p.voice);
    expect(new Set(voices).size).toBe(4);
    expect(PERSONAS[0].voice).toMatch(/high-ownership/i);
    expect(PERSONAS[1].voice).toMatch(/low-ownership/i);
    expect(PERSONAS[2].voice).toMatch(/budget/i);
    expect(PERSONAS[3].voice).toMatch(/fixture/i);
  });

  it("select-screen intros are number-free and short (arcade tone)", () => {
    for (const persona of PERSONAS) {
      expect(persona.intro.split(/\s+/).length).toBeLessThanOrEqual(40);
      expect(persona.intro).not.toMatch(/\d/);
      expect(persona.intro).not.toMatch(/!!/);
    }
    expect(new Set(PERSONAS.map((p) => p.intro)).size).toBe(4);
  });

  it("personaById resolves canon ids and defaults safely", () => {
    expect(personaById("ana").name).toBe("ANA");
    expect(personaById(null).id).toBe(DEFAULT_PERSONA);
    expect(personaById("zidane").id).toBe(DEFAULT_PERSONA);
  });
});

describe("GAFFER_CONSTRAINTS — no invented figures", () => {
  it("caps the reply length", () => {
    expect(GAFFER_CONSTRAINTS).toMatch(/at most \d+ words/);
  });

  it("permits quoting the facts and forbids going beyond them", () => {
    // The rule used to be "never state numbers", which bought safety by
    // making the gaffer useless beside a table of real ones. The guarantee is
    // the same — nothing invented — and is enforced by verifyFigures.
    expect(GAFFER_CONSTRAINTS).toMatch(/ONLY ones that appear verbatim in the FACTS/);
    expect(GAFFER_CONSTRAINTS).toMatch(/Never estimate, extrapolate or round/);
  });

  it("asks for one figure per sentence, because a sentence is what the check drops", () => {
    expect(GAFFER_CONSTRAINTS).toMatch(/at most one figure in a sentence/i);
  });

  it("still tells it to say what to watch when the facts are thin", () => {
    expect(GAFFER_CONSTRAINTS).toMatch(/instead of inventing detail/);
  });
});

describe("personaPrompt composes voice + constraints + facts", () => {
  it("carries the persona's voice, the constraints and the injected context", () => {
    const p = personaPrompt(personaById("kofi"), "captaincy: template is Salah");
    expect(p).toContain("differential hunter");
    expect(p).toContain("ONLY ones that appear verbatim");
    expect(p).toContain("captaincy: template is Salah");
  });

  it("carries prior turns when given, and marks them as not a source of figures", () => {
    const p = personaPrompt(personaById("kofi"), "facts", "user: who do I captain?");
    expect(p).toContain("who do I captain?");
    expect(p).toMatch(/never a source of figures/);
  });

  it("leaves the history block out entirely on a first question", () => {
    expect(personaPrompt(personaById("kofi"), "facts")).not.toContain("EARLIER IN THIS CONVERSATION");
  });
});

describe("personaFallback — deterministic and number-free", () => {
  it("every fallback is under 40 words and contains no digits", () => {
    for (const persona of PERSONAS) {
      const text = personaFallback(persona);
      expect(text.split(/\s+/).length).toBeLessThanOrEqual(40);
      expect(text).not.toMatch(/\d/);
    }
  });

  it("each fallback speaks in its persona's lens", () => {
    expect(personaFallback(personaById("oleg"))).toMatch(/template/i);
    expect(personaFallback(personaById("kofi"))).toMatch(/differential/i);
    expect(personaFallback(personaById("mei"))).toMatch(/budget/i);
    expect(personaFallback(personaById("ana"))).toMatch(/fixture/i);
  });
});

describe("arcadeFacts — v6-C context passing", () => {
  const matchday: ArcadeMatchdayLite = {
    phase: "live",
    eventId: 14,
    teamName: "The Test XI",
    points: 44,
    played: 6,
    toPlay: 3,
    captain: "Haaland",
    benchByPos: { GK: 1, DEF: 2, MID: 1, FWD: 0 },
    threats: ["Watkins 40% EO live", "Saka differential live"],
    rankNow: 40210,
    rankDelta: 5120,
  };

  it("carries the gameweek state, team structure and the resolved card", () => {
    const facts = arcadeFacts("should I take a hit?", matchday, {
      component: "transfer-sim",
      title: "Transfer simulation",
      prose: "payback never pays back",
      props: { out: null, in: null },
    });
    expect(facts.question).toBe("should I take a hit?");
    expect(facts.gw).toBe(14);
    expect(facts.phase).toBe("live");
    expect(facts.team?.captain).toBe("Haaland");
    expect(facts.team?.benchByPos.DEF).toBe(2);
    expect(facts.team?.rankDelta).toBe(5120);
    expect(facts.card?.component).toBe("transfer-sim");
  });

  it("works with no matchday (guest) and no card", () => {
    const facts = arcadeFacts("hello", null, null);
    expect(facts.question).toBe("hello");
    expect(facts.team).toBeUndefined();
    expect(facts.card).toBeUndefined();
  });

  it("serialises compactly and stays bounded", () => {
    const facts = arcadeFacts("cap this", matchday, null);
    const ctx1 = factsToPromptContext(facts);
    expect(ctx1.length).toBeGreaterThan(40);
    expect(ctx1.length).toBeLessThanOrEqual(1600);
  });
});

describe("scrubFigures — the strict-numbers rule applied to prose", () => {
  it("strips points, percentages, ranks and prices", () => {
    const dirty = "Haaland has 12.4 points, 84% ownership, rank 4,210 tonight";
    const clean = scrubFigures(dirty);
    expect(clean).not.toMatch(/\d/);
    expect(clean).toMatch(/Haaland/);
  });

  it("keeps plain prose intact", () => {
    const clean = scrubFigures("trust the template");
    expect(clean).toBe("trust the template");
  });

  it("punctuation reattaches after stripping", () => {
    const dirty = "salad leads with 9 pts, then gabriel";
    const clean = scrubFigures(dirty);
    expect(clean).not.toMatch(/\b9\b/);
    expect(clean).toContain("leads");
  });
});
