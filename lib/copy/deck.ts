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
  upstreamDown: {
    title: "FPL's servers aren't responding",
    body: "Try again shortly — the circuit breaker recovers automatically.",
    inline: "Showing the last good data.",
  },
  standingsDown: {
    title: "Couldn't load standings",
    body: "FPL may be busy. Try again shortly.",
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
  noMatchHistory: "No match history yet this season.",
  notFound: {
    title: "Nothing at this address",
    body: "The page moved, or never existed.",
  },
  teamIdInvalid: "No team with that ID. Check the number on your FPL Points page.",
} as const;
