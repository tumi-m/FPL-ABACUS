/**
 * v6 — THE ARCADE GAFFERS. Four persona voices for the assistant, each with a
 * distinct analytical lens. The strict-numbers rule is absolute: personas
 * speak prose only; every figure is rendered separately from resolver data.
 */
export type PersonaId = "oleg" | "kofi" | "mei" | "ana";

export interface Persona {
  id: PersonaId;
  name: string;
  role: string;
  region: string;
  /** Identity accent token — always paired with the name, never meaning-coded. */
  /** The plate colour: a bright fill that carries black type on any ground. */
  accentVar: string;
  /** The same identity written as text, darkened where the page is light. */
  accentInkVar: string;
  /** Still avatar art (owner-supplied mockup crops). */
  avatar: string;
  /** Idle sprite frame — the resting pose. */
  avatarIdle: string;
  /** Talking sprite frames — flipped while the bubble speaks. */
  avatarTalk: string[];
  /** One-line pitch for the select strip. */
  blurb: string;
  /** Select-screen speech bubble — deterministic, number-free, arcade tone. */
  intro: string;
  /** System-prompt fragment: voice + analytical lens. */
  voice: string;
}

export const PERSONAS: Persona[] = [
  {
    id: "oleg",
    name: "OLEG",
    role: "The Tactician",
    region: "Europe",
    accentVar: "var(--persona-oleg)",
    accentInkVar: "var(--persona-oleg-ink)",
    avatar: "/avatars/oleg-idle.png",
    avatarIdle: "/avatars/oleg-idle.png",
    avatarTalk: ["/avatars/oleg-idle.png", "/avatars/oleg-talk1.png", "/avatars/oleg-talk2.png"],
    blurb: "Template picks, proven quality, xG-led captaincy.",
    intro: "Proven quality first. The reliable route wins seasons — watch the expected goals and take the safe haul.",
    voice:
      "You are the template player. You trust proven quality: high-ownership captaincy, expected goals, reliable clean-sheet odds. Measured, boardroom-confident, allergic to punts.",
  },
  {
    id: "kofi",
    name: "KOFI",
    role: "The Maverick",
    region: "Africa",
    accentVar: "var(--persona-kofi)",
    accentInkVar: "var(--persona-kofi-ink)",
    avatar: "/avatars/kofi-idle.png",
    avatarIdle: "/avatars/kofi-idle.png",
    avatarTalk: ["/avatars/kofi-idle.png", "/avatars/kofi-talk1.png", "/avatars/kofi-talk2.png"],
    blurb: "Differentials, explosive captains, aggressive hits.",
    intro: "Everyone plays it safe — that is your edge. Find the differential the crowd ignores and swing big.",
    voice:
      "You are the differential hunter. You chase low-ownership gems, explosive captain picks and aggressive point hits. Bold, hungry, always hunting the big haul.",
  },
  {
    id: "mei",
    name: "MEI",
    role: "The Scout",
    region: "Asia",
    accentVar: "var(--persona-mei)",
    accentInkVar: "var(--persona-mei-ink)",
    avatar: "/avatars/mei-idle.png",
    avatarIdle: "/avatars/mei-idle.png",
    avatarTalk: ["/avatars/mei-idle.png", "/avatars/mei-talk1.png", "/avatars/mei-talk2.png"],
    blurb: "Budget enablers, value defenders, bench structure.",
    intro: "Value decides seasons. The budget route keeps your structure flexible and your bench useful. Spend wisely.",
    voice:
      "You are the budget enabler. You obsess over value: cheap defenders with strong underlying numbers, smart bench structure, points per million. Precise, thrifty, never wasteful.",
  },
  {
    id: "ana",
    name: "ANA",
    role: "The Fixture Specialist",
    region: "South America",
    accentVar: "var(--persona-ana)",
    accentInkVar: "var(--persona-ana-ink)",
    avatar: "/avatars/ana-idle.png",
    avatarIdle: "/avatars/ana-idle.png",
    avatarTalk: ["/avatars/ana-idle.png", "/avatars/ana-talk1.png", "/avatars/ana-talk2.png"],
    blurb: "Fixture swings, blanks, doubles, chip timing.",
    intro: "The calendar decides before you do. Read the fixture swings, plan the doubles, time your chips early.",
    voice:
      "You are the fixture specialist. You live in the fixture calendar: swings, blanks, doubles and long-horizon chip timing. Forward-looking, always three gameweeks ahead.",
  },
];

export const DEFAULT_PERSONA: PersonaId = "oleg";

export function personaById(id: string | null | undefined): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}

/**
 * The voice constraints — pinned by tests, never loosened.
 *
 * The third line used to read "never state numbers", which is not the rule we
 * actually want and cost the gaffer everything worth saying: beside a table of
 * real figures it could only offer atmosphere. The rule is *never invent* a
 * number, and that is now enforced downstream by verifyFigures, which checks
 * every figure against the facts and drops the sentence around any it cannot
 * find. So the prompt asks for the opposite of silence — quote the facts — and
 * asks for one figure per sentence, because a sentence is the unit the check
 * drops and two claims should not fall together.
 */
export const GAFFER_CONSTRAINTS = [
  "Reply in at most 55 words, in short sentences.",
  "Speak like a 90s arcade announcer: punchy and direct, one exclamation mark maximum.",
  "You may quote figures, but ONLY ones that appear verbatim in the FACTS below. Never estimate, extrapolate or round beyond what is written there.",
  "Put at most one figure in a sentence.",
  "Name the players in the FACTS by name. If the facts are thin, say what to watch instead of inventing detail.",
  "Answer the question that was asked before adding colour.",
].join(" ");

/** Compose the system prompt: persona voice + hard constraints + resolved facts. */
export function personaPrompt(persona: Persona, context: string, history?: string): string {
  return `${persona.voice}

${GAFFER_CONSTRAINTS}
${history ? `\nEARLIER IN THIS CONVERSATION (for pronouns and follow-ups only — never a source of figures):\n${history}\n` : ""}
FACTS — the user's current situation, resolved by the app's engines. Every figure you may use is in here:
${context}`;
}

/**
 * The context the gaffer sees (v6-C): the question, the gameweek state, the
 * team structure and the resolved card. Numbers live in the facts so the
 * advice is actionable — the constraints still forbid stating them; figures
 * render beside the bubble from the resolver, always.
 */
export interface ArcadeFacts {
  question: string;
  gw: number;
  phase?: string;
  team?: {
    name: string;
    points: number;
    played: number;
    toPlay: number;
    captain: string | null;
    benchByPos: Record<string, number>;
    threats: string[];
    rankNow: number | null;
    rankDelta: number | null;
  };
  card?: { component: string; title: string; prose: string; props: Record<string, unknown> | null };
}

export interface ArcadeMatchdayLite {
  phase: string;
  eventId: number;
  teamName: string;
  points: number;
  played: number;
  toPlay: number;
  captain: string | null;
  benchByPos: Record<string, number>;
  threats: string[];
  rankNow: number | null;
  rankDelta: number | null;
}

/** Pure, testable facts composer — no network, all inputs in hand. */
export function arcadeFacts(
  question: string,
  matchday: ArcadeMatchdayLite | null,
  card: ResolvedCardLike | null,
): ArcadeFacts {
  const facts: ArcadeFacts = {
    question: question.slice(0, 200),
    gw: matchday?.eventId ?? 0,
    phase: matchday?.phase,
    team: matchday
      ? {
          name: matchday.teamName,
          points: matchday.points,
          played: matchday.played,
          toPlay: matchday.toPlay,
          captain: matchday.captain,
          benchByPos: matchday.benchByPos,
          threats: matchday.threats.slice(0, 4),
          rankNow: matchday.rankNow,
          rankDelta: matchday.rankDelta,
        }
      : undefined,
  };
  if (card) {
    facts.card = {
      component: card.component,
      title: card.title,
      prose: card.prose,
      props: card.props,
    };
  }
  return facts;
}

/** Subset of the resolved card the arcade prompt needs. */
export interface ResolvedCardLike {
  component: string;
  title: string;
  prose: string;
  props: Record<string, unknown> | null;
}

/** Serialise facts for the prompt — compact JSON, bounded size. */
export function factsToPromptContext(facts: ArcadeFacts): string {
  return JSON.stringify(facts, null, 0).slice(0, 1600);
}

/** Strip anything that looks like a stated figure — the rule is absolute. */
export function scrubFigures(text: string): string {
  let out = text.replace(/\d[\d.,]*\s*(pts?|points?|%|k|m|x|xG|GW\d*)/gi, "");
  out = out.replace(/[\d][\d.,]*[kKmM]?/g, "");
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
  return out;
}

/**
 * Deterministic fallback when the gateway is down. Contains no numbers by
 * construction — the resolver's figures still render beside it.
 */
export function personaFallback(persona: Persona): string {
  switch (persona.id) {
    case "oleg":
      return "Proven quality first. Trust the reliable route the figures are showing — the template exists for a reason. Take the safe haul.";
    case "kofi":
      return "Everyone else plays it safe — that is your edge. The differential the crowd ignores is in these figures. Be bold.";
    case "mei":
      return "Value decides it. The budget route keeps your structure flexible and your bench useful. Spend wisely, never waste.";
    case "ana":
      return "The calendar decides before you do. Read the timing in these figures, plan around the fixtures, and the rest follows.";
  }
}
