"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/primitives/Sheet";
import { EOScatter } from "@/components/charts/EOScatter";
import { PriceGauge } from "@/components/charts/PriceGauge";
import { FixtureSwing } from "@/components/charts/FixtureSwing";
import { DefconRate } from "@/components/charts/DefconRate";
import { XgVsActual } from "@/components/charts/XgVsActual";
import { DistributionCurve } from "@/components/charts/DistributionCurve";
import { SwingBars } from "@/components/charts/SwingBars";
import { ChipTimeline } from "@/components/charts/ChipTimeline";

interface CardEvent {
  type: "card";
  component: string;
  title: string;
  props: Record<string, unknown>;
  note?: string;
}

type StreamEvent =
  | { type: "meta"; intent: string; source: string }
  | { type: "prose"; text: string }
  | CardEvent
  | { type: "done" }
  | { type: "error"; message: string };

const PROMPTS_BY_SCREEN: Record<string, string[]> = {
  "/live": ["Which event moved my rank most?", "Where am I exposed to the template?"],
  "/field": ["Should I captain Salah or Haaland?", "Does Gabriel hit 10 defcon?"],
  "/board": ["How are Isak's fixtures looking?", "When should I play my wildcard?"],
  "/news": ["Any injury news on Trent?", "What's the latest gossip?"],
  "/planner": ["Is it worth taking a hit?", "Will Mbeumo rise tonight?"],
  DEFAULT: ["Who should I captain?", "Will anyone rise tonight?", "Any injury doubts in my squad?"],
};

interface ChartCard {
  kind: "card";
  node: React.ReactNode;
}

export function AskBar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [prose, setProse] = React.useState<string[]>([]);
  const [cards, setCards] = React.useState<ChartCard[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const suggestions =
    Object.entries(PROMPTS_BY_SCREEN).find(([k]) => k !== "DEFAULT" && pathname.startsWith(k))?.[1] ??
    PROMPTS_BY_SCREEN.DEFAULT;

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setProse([]);
    setCards([]);
    setQ(question);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: question }),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: StreamEvent;
          try {
            ev = JSON.parse(line) as StreamEvent;
          } catch {
            continue;
          }
          if (ev.type === "prose") {
            setProse((p) => [...p, ev.text]);
          } else if (ev.type === "card") {
            const node = renderCard(ev.component, ev.props);
            if (node) setCards((c) => [...c, { kind: "card", node }]);
          } else if (ev.type === "error") {
            setProse((p) => [...p, `Something went wrong: ${ev.message}`]);
          }
        }
      }
    } catch {
      setProse((p) => [...p, "The ask bar couldn't reach the server."]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => resultsRef.current?.scrollTo({ top: 0 }));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Ask"
        className="hidden sm:inline-flex h-8 items-center gap-2 rounded-full card-ring px-3 text-xs text-ink-lo transition-colors dur-instant hover:text-ink-hi"
      >
        Ask
        <kbd className="rounded bg-surface-3 px-1 py-0.5 text-2xs num-tabular">⌘K</kbd>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetTitle>Ask the gaffer</SheetTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(q);
            }}
            className="mt-3 flex gap-2"
          >
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Who should I captain?"
              aria-label="Your question"
              className="h-10 flex-1 rounded-md border border-line bg-sunk px-3 text-sm text-ink-hi placeholder:text-ink-lo focus-visible:outline focus-visible:outline-volt"
            />
            <button
              type="submit"
              disabled={busy || !q.trim()}
              className="skewed rounded-sm bg-volt px-4 text-xs uppercase-label text-on-accent disabled:opacity-40"
            >
              <span>{busy ? "…" : "Ask"}</span>
            </button>
          </form>

          {prose.length === 0 && cards.length === 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="rounded-full card-ring px-3 py-1.5 text-xs text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div ref={resultsRef} className="mt-4 max-h-[60dvh] space-y-3 overflow-y-auto pr-1">
            {prose.map((t, i) => (
              <p key={i} className="text-sm leading-relaxed text-ink-mid">
                {t}
              </p>
            ))}
            {cards.map((c, i) => (
              <div key={i}>{c.node}</div>
            ))}
          </div>
          <p className="mt-3 text-2xs leading-relaxed text-ink-lo">
            Numbers come only from Gaffer&apos;s engines and FPL data — never invented.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Registry-driven renderer — every branch is a grounded engine product. */
function renderCard(component: string, props: Record<string, unknown>): React.ReactNode | null {
  switch (component) {
    case "exposure-scatter":
      return <EOScatter rows={props.rows as never} />;
    case "price-gauge":
      return <PriceGauge {...(props as React.ComponentProps<typeof PriceGauge>)} />;
    case "fixture-run":
      return <FixtureSwing {...(props as React.ComponentProps<typeof FixtureSwing>)} />;
    case "defcon-check":
      return <DefconRate {...(props as React.ComponentProps<typeof DefconRate>)} />;
    case "xg-vs-actual":
      return <XgVsActual {...(props as React.ComponentProps<typeof XgVsActual>)} />;
    case "rank-projection":
      return (
        <DistributionCurve
          bins={props.bins as { x: number; y: number }[]}
          yourScore={(props.yourScore as number) ?? 0}
          ariaLabel="Field score distribution with your score marked"
        />
      );
    case "swing-impact":
      return <SwingBars rows={props.rows as never} ariaLabel="Rank impact by event" />;
    case "chip-timeline":
      return props.plays ? (
        <ChipTimeline plays={props.plays as never} gwRange={props.gwRange as [number, number]} />
      ) : null;
    case "captain-compare": {
      const rows = props.rows as { name: string; epNext: number; eo: number }[];
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="upper-label text-2xs text-ink-lo">Captaincy board</div>
          <table className="mt-2 w-full text-sm num-tabular">
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-hairline last:border-0">
                  <td className="py-1.5 text-ink-hi">{r.name}</td>
                  <td className="py-1.5 text-right fig-num">{r.epNext}</td>
                  <td className="w-24 py-1.5 pl-3">
                    <span className="fig-num text-xs text-ink-lo">{r.eo.toFixed(0)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "injury-list": {
      const players = props.players as {
        name: string;
        news: string;
        status: string;
        chance: number | null;
      }[];
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="upper-label text-2xs text-ink-lo">Availability desk</div>
          <ul className="mt-2 space-y-1.5">
            {players.map((p) => (
              <li key={p.name} className="text-sm">
                <span className="font-medium text-ink-hi">{p.name}</span>{" "}
                <span className="text-flare">{p.news}</span>
                {p.chance != null && <span className="ml-1 text-xs text-ink-lo">({p.chance}% to play)</span>}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "news-search": {
      const items = props.items as { title: string; url: string; source: string }[];
      return (
        <ul className="space-y-1.5 rounded-lg bg-surface-1 card-ring p-4 text-sm">
          {items.map((i) => (
            <li key={i.url}>
              <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-ink-hi hover:text-volt">
                {i.title}
              </a>{" "}
              <span className="text-2xs uppercase-label text-ink-lo">{i.source}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "transfer-sim":
      return null; // prose carries the verdict; ledger maths lives on the Board
    default:
      return null;
  }
}
