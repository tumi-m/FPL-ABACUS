import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERSONA,
  GAFFER_CONSTRAINTS,
  PERSONAS,
  personaById,
  personaFallback,
  personaPrompt,
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

  it("personaById resolves canon ids and defaults safely", () => {
    expect(personaById("ana").name).toBe("ANA");
    expect(personaById(null).id).toBe(DEFAULT_PERSONA);
    expect(personaById("zidane").id).toBe(DEFAULT_PERSONA);
  });
});

describe("GAFFER_CONSTRAINTS — the strict numbers rule holds", () => {
  it("caps the reply at 40 words", () => {
    expect(GAFFER_CONSTRAINTS).toMatch(/40 words/);
  });

  it("forbids the persona from stating any figures", () => {
    expect(GAFFER_CONSTRAINTS).toMatch(/Never state numbers/);
  });

  it("grounds statements in resolved facts", () => {
    expect(GAFFER_CONSTRAINTS).toMatch(/facts provided/);
  });
});

describe("personaPrompt composes voice + constraints + facts", () => {
  it("carries the persona's voice, the constraints and the injected context", () => {
    const p = personaPrompt(personaById("kofi"), "captaincy: template is Salah");
    expect(p).toContain("differential hunter");
    expect(p).toContain("40 words");
    expect(p).toContain("Never state numbers");
    expect(p).toContain("captaincy: template is Salah");
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
