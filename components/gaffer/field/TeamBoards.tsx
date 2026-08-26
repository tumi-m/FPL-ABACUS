"use client";

import * as React from "react";
import { StatTable, FMT, type StatColumn } from "@/components/gaffer/field/StatTable";
import { overExpected, perMatch, type TeamStatRow } from "@/lib/engines/teamStats";

/**
 * Six reads of the same twenty clubs.
 *
 * Each board answers one question and stops. Attack asks whether the goals are
 * real; defence asks whether the clean sheets are; the two work boards ask
 * where the points come from that are not goals; the market board asks what
 * everyone else has already worked out. Sorting is the whole interface — every
 * column is a ranking, and the default is the column the board exists for.
 *
 * The over/under columns are the ones worth reading first. A club scoring
 * above its expected goals is finishing better than its chances, and finishing
 * regresses; a club below it is creating and missing, which is the cheaper
 * side of the same trade.
 */

const col = (c: StatColumn): StatColumn => c;

export function TeamBoards({ rows, owned }: { rows: TeamStatRow[]; owned: number[] }) {
  const ownedSet = React.useMemo(() => new Set(owned), [owned]);

  const attack: StatColumn[] = [
    col({ key: "played", label: "Pl", title: "Matches played", read: (r) => r.played, group: "" }),
    col({ key: "xg", label: "xG", title: "Expected goals, summed across the squad", read: (r) => r.xg, format: FMT.oneDp, group: "Scoring" }),
    col({ key: "goals", label: "G", title: "Goals scored", read: (r) => r.goals, group: "Scoring" }),
    col({ key: "gVsXg", label: "G−xG", title: "Goals minus expected goals — above the line is finishing above the chances", read: (r) => overExpected(r.goals, r.xg), format: FMT.signed, tone: "diverge", group: "Scoring" }),
    col({ key: "xa", label: "xA", title: "Expected assists", read: (r) => r.xa, format: FMT.oneDp, group: "Creating" }),
    col({ key: "assists", label: "A", title: "Assists", read: (r) => r.assists, group: "Creating" }),
    col({ key: "aVsXa", label: "A−xA", title: "Assists minus expected assists", read: (r) => overExpected(r.assists, r.xa), format: FMT.signed, tone: "diverge", group: "Creating" }),
    col({ key: "xgi", label: "xGI", title: "Expected goal involvements", read: (r) => r.xgi, format: FMT.oneDp, group: "Both" }),
    col({ key: "gi", label: "GI", title: "Goals plus assists", read: (r) => r.gi, group: "Both" }),
    col({ key: "xg90", label: "xG/M", title: "Expected goals per match", read: (r) => perMatch(r.xg, r.played), format: FMT.oneDp, tone: "heat", group: "Both" }),
  ];

  const defence: StatColumn[] = [
    col({ key: "played", label: "Pl", title: "Matches played", read: (r) => r.played, group: "" }),
    col({ key: "xgc", label: "xGC", title: "Expected goals conceded, from the club's most-played player", read: (r) => r.xgc, format: FMT.oneDp, group: "Conceding" }),
    col({ key: "conceded", label: "GC", title: "Goals conceded, from the match results", read: (r) => r.conceded, group: "Conceding" }),
    col({ key: "gcVsXgc", label: "xGC−GC", title: "Expected concession minus actual — above the line means the goalkeeping and the luck have been holding", read: (r) => overExpected(r.xgc, r.conceded), format: FMT.signed, tone: "diverge", group: "Conceding" }),
    col({ key: "xgc90", label: "xGC/M", title: "Expected goals conceded per match — the lower the better", read: (r) => perMatch(r.xgc, r.played), format: FMT.oneDp, group: "Conceding" }),
    col({ key: "cs", label: "CS", title: "Clean sheets kept", read: (r) => r.cleanSheets, tone: "heat", group: "Holding out" }),
    col({ key: "csRate", label: "CS%", title: "Share of matches ending in a clean sheet", read: (r) => perMatch(r.cleanSheets, r.played) * 100, format: FMT.whole, group: "Holding out" }),
    col({ key: "saves", label: "Sv", title: "Saves made", read: (r) => r.saves, group: "Holding out" }),
  ];

  const work: StatColumn[] = [
    col({ key: "defcon", label: "DC", title: "Defensive contributions — the stat FPL pays two points for", read: (r) => r.defcon, tone: "heat", group: "Volume" }),
    col({ key: "dc90", label: "DC/M", title: "Defensive contributions per match", read: (r) => perMatch(r.defcon, r.played), format: FMT.oneDp, group: "Volume" }),
    col({ key: "tackles", label: "T", title: "Tackles", read: (r) => r.tackles, group: "Where it comes from" }),
    col({ key: "recoveries", label: "R", title: "Recoveries", read: (r) => r.recoveries, group: "Where it comes from" }),
    col({ key: "cbi", label: "CBI", title: "Clearances, blocks and interceptions", read: (r) => r.cbi, group: "Where it comes from" }),
    col({ key: "yellow", label: "YC", title: "Yellow cards", read: (r) => r.yellow, group: "The cost" }),
    col({ key: "red", label: "RC", title: "Red cards", read: (r) => r.red, group: "The cost" }),
  ];

  const returns: StatColumn[] = [
    col({ key: "points", label: "Pts", title: "FPL points scored by this club's players", read: (r) => r.points, tone: "heat", group: "Paid out" }),
    col({ key: "ptsM", label: "Pts/M", title: "FPL points per match", read: (r) => perMatch(r.points, r.played), format: FMT.oneDp, group: "Paid out" }),
    col({ key: "bonus", label: "B", title: "Bonus points", read: (r) => r.bonus, group: "Bonus" }),
    col({ key: "bps", label: "BPS", title: "Bonus points system score — the tally bonus is awarded from", read: (r) => r.bps, group: "Bonus" }),
    col({ key: "bonusShare", label: "B/M", title: "Bonus points per match", read: (r) => perMatch(r.bonus, r.played), format: FMT.oneDp, tone: "heat", group: "Bonus" }),
    col({ key: "og", label: "OG", title: "Own goals", read: (r) => r.ownGoals, group: "Mishaps" }),
    col({ key: "pensMissed", label: "PM", title: "Penalties missed", read: (r) => r.pensMissed, group: "Mishaps" }),
    col({ key: "pensSaved", label: "PS", title: "Penalties saved", read: (r) => r.pensSaved, group: "Mishaps" }),
  ];

  const market: StatColumn[] = [
    col({ key: "owned", label: "Top %", title: "How widely the club's most-owned player is held", read: (r) => r.topOwned?.percent ?? 0, format: FMT.oneDp, tone: "heat", group: "Ownership" }),
    col({ key: "topPrice", label: "Max £", title: "The priciest asset at the club", read: (r) => r.topPrice, format: FMT.oneDp, group: "Ownership" }),
    col({ key: "net", label: "Net", title: "Net transfers this gameweek — in minus out, across the whole club", read: (r) => r.transfersIn - r.transfersOut, format: (v) => (v > 0 ? `+${Math.round(v).toLocaleString("en-GB")}` : Math.round(v).toLocaleString("en-GB")), tone: "diverge", group: "This week's traffic" }),
    col({ key: "in", label: "In", title: "Transfers in this gameweek", read: (r) => r.transfersIn, format: (v) => Math.round(v).toLocaleString("en-GB"), group: "This week's traffic" }),
    col({ key: "out", label: "Out", title: "Transfers out this gameweek", read: (r) => r.transfersOut, format: (v) => Math.round(v).toLocaleString("en-GB"), group: "This week's traffic" }),
    col({ key: "risers", label: "↑", title: "Players whose price has risen since the season opened", read: (r) => r.risers, group: "Since the opener" }),
    col({ key: "fallers", label: "↓", title: "Players whose price has fallen since the season opened", read: (r) => r.fallers, group: "Since the opener" }),
  ];

  const luck: StatColumn[] = [
    col({ key: "gVsXg", label: "G−xG", title: "Goals minus expected goals", read: (r) => overExpected(r.goals, r.xg), format: FMT.signed, tone: "diverge", group: "Running hot or cold" }),
    col({ key: "aVsXa", label: "A−xA", title: "Assists minus expected assists", read: (r) => overExpected(r.assists, r.xa), format: FMT.signed, tone: "diverge", group: "Running hot or cold" }),
    col({ key: "gcVsXgc", label: "xGC−GC", title: "Expected concession minus actual", read: (r) => overExpected(r.xgc, r.conceded), format: FMT.signed, tone: "diverge", group: "Running hot or cold" }),
    col({ key: "net", label: "Net", title: "The three gaps added together — the club's total distance from what the chances say", read: (r) => overExpected(r.goals, r.xg) + overExpected(r.assists, r.xa) + overExpected(r.xgc, r.conceded), format: FMT.signed, tone: "diverge", group: "All three" }),
    col({ key: "xgi", label: "xGI", title: "Expected goal involvements — the process underneath it all", read: (r) => r.xgi, format: FMT.oneDp, tone: "heat", group: "All three" }),
    col({ key: "gi", label: "GI", title: "Goals plus assists", read: (r) => r.gi, group: "All three" }),
  ];

  return (
    <div className="space-y-8">
      <StatTable
        eyebrow="Board 1"
        title="Attack"
        blurb="Whether the goals are earned. A club well above its expected goals is finishing better than its chances, and that regresses."
        rows={rows}
        columns={attack}
        defaultSort="xgi"
        owned={ownedSet}
        footnote="Expected goals and assists are FPL's own published figures, summed across every player at the club."
      />

      <StatTable
        eyebrow="Board 2"
        title="Defence"
        blurb="The other half of a defender's price. Clean sheets follow expected concession far more reliably than they follow last week's result."
        rows={rows}
        columns={defence}
        defaultSort="cs"
        owned={ownedSet}
        footnote="Goals conceded come from the match results, so they are exact. Expected concession is FPL's figure for the club's most-played player — the club's own number for anyone close to ever-present."
      />

      <StatTable
        eyebrow="Board 3"
        title="Defensive contributions"
        blurb="Where the DEFCON points live. Two points a match for tackles, recoveries, clearances, blocks and interceptions — and some clubs simply do more of it."
        rows={rows}
        columns={work}
        defaultSort="defcon"
        owned={ownedSet}
        footnote="A defender needs ten of these in a match to bank the two points; a midfielder needs twelve."
      />

      <StatTable
        eyebrow="Board 4"
        title="What it paid"
        blurb="FPL points rather than football. Bonus is the part you cannot see in a scoreline, and it concentrates in clubs that both win and dominate the ball."
        rows={rows}
        columns={returns}
        defaultSort="points"
        owned={ownedSet}
      />

      <StatTable
        eyebrow="Board 5"
        title="The market"
        blurb="What the other eleven million have already decided. Heavy net traffic into a club is the template forming; heavy traffic out is where a differential becomes cheap."
        rows={rows}
        columns={market}
        defaultSort="net"
        owned={ownedSet}
        footnote="Transfer counts are this gameweek only and cover every player at the club, so a club with two popular assets shows more traffic than one with a single star."
      />

      <StatTable
        eyebrow="Board 6"
        title="Hot and cold"
        blurb="The three gaps on one board. Green is a club banking more than its chances deserve; red is one doing the work and getting nothing for it — which is the side of the trade you want to be early on."
        rows={rows}
        columns={luck}
        defaultSort="net"
        owned={ownedSet}
        footnote="Each column is actual minus expected, so a defence is green when it has conceded fewer than the chances against it suggested."
      />
    </div>
  );
}
