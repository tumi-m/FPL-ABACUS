/**
 * The copy deck — every shared sentence lives here once (v5-G). Screens must
 * not hand-roll error or empty-state prose; import from the deck so tone stays
 * consistent and honest.
 */
export const COPY = {
  picksMissing: {
    title: "No picks yet for this gameweek",
    body: (surface: string) =>
      `${surface} needs your squad. If the deadline hasn't passed, set your team in the official game — it lights up the moment picks exist.`,
  },
  /*
   * Kept only for the inline "stale data" note. The title and body used to be
   * printed for any upstream failure and both asserted things nobody had
   * checked — that FPL's servers were the problem, and that the breaker was
   * involved. Screens read the error instead now: see
   * lib/engines/upstreamFailure.ts. `standingsDown` was removed outright
   * rather than left here to be reached for again.
   */
  upstreamDown: {
    title: "FPL's servers aren't responding",
    body: "Try again shortly.",
    inline: "Showing the last good data.",
  },
  nothingToAttribute: {
    title: "Nothing to attribute yet",
    picksBody: "Set your squad in the official game — attribution appears once picks exist.",
  },
  noSquadYet: {
    title: "No squad yet",
    body: "Picks appear once FPL has them for this gameweek.",
  },
  picksUnavailable: "Couldn't load that entry's picks.",
  noMatchHistory: "He has not played a match yet this season. The charts and the match table fill in from his first whistle.",
  notFound: {
    title: "Nothing at this address",
    body: "The page moved, or never existed.",
  },
  unexpected: {
    title: "That screen didn't load",
    body: "Something went wrong on our side — the fault is logged. Going home keeps everything else working.",
  },
  global: {
    title: "GAFFER hit a fault it couldn't recover from",
    body: "Reload to come back. Your team ID and preferences are stored on this device and survive it.",
  },
  teamIdInvalid: "No team with that ID. Check the number on your FPL Points page.",
} as const;
