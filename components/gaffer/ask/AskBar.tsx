"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/primitives/Sheet";
import { cn } from "@/lib/ui/cn";
import { GafferStrip, useGafferPersona } from "@/components/gaffer/ask/GafferStrip";
import { GafferBubble } from "@/components/gaffer/ask/GafferBubble";
import { PERSONAS, personaById, type PersonaId } from "@/lib/ai/personas";
import { EOScatter } from "@/components/charts/EOScatter";
import { PriceGauge } from "@/components/charts/PriceGauge";
import { FixtureSwing } from "@/components/charts/FixtureSwing";
import { DefconRate } from "@/components/charts/DefconRate";
import { XgVsActual } from "@/components/charts/XgVsActual";
import { DistributionCurve } from "@/components/charts/DistributionCurve";
import { SwingBars } from "@/components/charts/SwingBars";
import { ChipTimeline } from "@/components/charts/ChipTimeline";
import { Meter } from "@/components/charts/Meter";
import { ProbabilityBand } from "@/components/charts/ProbabilityBand";

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
  | { type: "gaffer"; persona: string; text: string }
  | CardEvent
  | { type: "done" }
  | { type: "error"; message: string };

const PROMPTS_BY_SCREEN: Record<string, string[]> = {
  "/live": ["Which event moved my rank most?", "Where am I exposed to the template?"],
  "/field": ["Should I captain Salah or Haaland?", "Does Gabriel hit 10 defcon?"],
  "/board": ["How are Isak's fixtures looking?", "When should I play my wildcard?"],
  "/planner": ["Is it worth taking a hit?", "Will Mbeumo rise tonight?"],
  DEFAULT: ["Who should I captain?", "Will anyone rise tonight?", "Any injury doubts in my squad?"],
};

interface GafferLine {
  kind: "gaffer";
  personaId: string;
  text: string;
}

interface ChartCard {
  kind: "card";
  node: React.ReactNode;
}

const BLIPS_KEY = "gaffer_blips_muted";

export function AskBar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [prose, setProse] = React.useState<string[]>([]);
  const [gaffers, setGaffers] = React.useState<GafferLine[]>([]);
  const [cards, setCards] = React.useState<ChartCard[]>([]);
  const [personaId, choosePersona] = useGafferPersona();
  const [blipsMuted, setBlipsMuted] = React.useState(true);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
      setBlipsMuted(localStorage.getItem(BLIPS_KEY) === "1");
    } catch {
      /* storage blocked — muted */
    }
  }, []);

  const toggleBlips = () => {
    setBlipsMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem(BLIPS_KEY, next ? "1" : "0");
      } catch {
        /* session-only */
      }
      return next;
    });
  };

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

  // Any surface can summon the gaffers — landing showcase, arcade cards, etc.
  React.useEffect(() => {
    const onOpenAsk = (e: Event) => {
      const persona = (e as CustomEvent<{ persona?: string }>).detail?.persona;
      if (persona && PERSONAS.some((p) => p.id === persona)) choosePersona(persona as PersonaId);
      setOpen(true);
    };
    window.addEventListener("gaffer:open-ask", onOpenAsk);
    return () => window.removeEventListener("gaffer:open-ask", onOpenAsk);
  }, [choosePersona]);

  const suggestions =
    Object.entries(PROMPTS_BY_SCREEN).find(([k]) => k !== "DEFAULT" && pathname.startsWith(k))?.[1] ??
    PROMPTS_BY_SCREEN.DEFAULT;

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setProse([]);
    setGaffers([]);
    setCards([]);
    setQ(question);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: question, persona: personaId }),
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
          if (ev.type === "gaffer") {
            setGaffers((g) => [...g, { kind: "gaffer", personaId: ev.persona, text: ev.text }]);
          } else if (ev.type === "prose") {
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
        aria-label="Ask the Gaffer"
        className="hidden sm:inline-flex h-8 items-center gap-2 rounded-full card-ring px-3 text-xs text-ink-lo transition-colors dur-instant hover:text-ink-hi"
      >
        Ask the Gaffer
        <kbd className="rounded bg-surface-3 px-1 py-0.5 text-2xs num-tabular">⌘K</kbd>
      </button>
      {/* mobile trigger — 44px icon beside the theme toggle */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the Gaffer"
        className="relative grid h-11 w-11 place-items-center rounded-full card-ring text-ink-lo transition-colors dur-instant after:absolute after:inset-0 after:content-[''] hover:text-ink-hi sm:hidden"
      >
        <span aria-hidden className="text-sm font-bold">?</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetTitle>Ask the gaffer</SheetTitle>

          {/* character select — the four arcade gaffers */}
          <div className="mt-3">
            <GafferStrip active={personaId} onChoose={choosePersona} />
          </div>

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

          {/* immersive gaffer — the selected one fills the console, frames flip */}
          <SelectedGafferHero personaId={personaId} onSummon={() => inputRef.current?.focus()} />

          <div className="mt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={toggleBlips}
              aria-pressed={!blipsMuted}
              className="text-2xs uppercase-label text-ink-lo transition-colors dur-instant hover:text-ink-hi"
            >
              Sound {blipsMuted ? "off" : "on"}
            </button>
          </div>

          {prose.length === 0 && cards.length === 0 && gaffers.length === 0 && (
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
            {gaffers.map((g, i) => (
              <GafferBubble
                key={`g-${i}`}
                persona={personaById(g.personaId)}
                text={g.text}
                blipsOn={!blipsMuted}
              />
            ))}
            {prose.map((t, i) => (
              <p key={`p-${i}`} className="text-sm leading-relaxed text-ink-mid">
                {t}
              </p>
            ))}
            {cards.map((c, i) => (
              <div key={`c-${i}`}>{c.node}</div>
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

/**
 * The selected gaffer as a large console hero — 2–3× the strip tile on desktop
 * with the accent outline, a soft pitch pad underfoot, and the idle frame flip
 * running. Tap to focus the question box.
 */
function SelectedGafferHero({
  personaId,
  onSummon,
}: {
  personaId: PersonaId;
  onSummon: () => void;
}) {
  const persona = personaById(personaId);
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(
      () => setFrame((f) => (f + 1) % persona.avatarTalk.length),
      280,
    );
    return () => window.clearInterval(t);
  }, [persona]);

  const src = persona.avatarTalk[frame % persona.avatarTalk.length] ?? persona.avatarIdle;

  return (
    <button
      type="button"
      onClick={onSummon}
      aria-label={`${persona.name} — focus the question box`}
      className="group relative mx-auto mt-5 flex w-full max-w-[560px] flex-col items-center overflow-hidden rounded-xl card-ring transition-transform dur-instant hover:-translate-y-0.5"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--sunk) 88%, transparent), color-mix(in oklab, var(--raised) 65%, transparent))",
        boxShadow: `inset 0 0 0 1.5px color-mix(in oklab, ${persona.accentVar} 40%, transparent)`,
      }}
    >
      {/* pitch pad under the boots */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-16 rounded-b-xl"
        style={{
          background:
            "linear-gradient(180deg, transparent, color-mix(in oklab, #123B27 82%, transparent)), repeating-linear-gradient(90deg, rgba(255,255,255,.03) 0 36px, transparent 36px 72px)",
        }}
      />
      <span className="relative z-10 pt-4 md:pt-6">
        <span className="relative block h-36 w-36 sm:h-44 sm:w-44 md:h-64 md:w-64" aria-hidden>
          <Image
            src={src}
            alt=""
            fill
            sizes="(min-width: 768px) 256px, (min-width: 640px) 176px, 144px"
            className="object-contain object-bottom transition-transform dur-instant group-hover:scale-[1.02]"
            unoptimized
          />
        </span>
      </span>
      <span
        className="skewed relative z-10 -mt-1 mb-1 inline-flex scale-x-[1.12] items-center rounded-sm px-4 py-1 text-xs font-extrabold tracking-[0.18em] text-black"
        style={{ background: persona.accentVar }}
      >
        {persona.name}
      </span>
      <span
        className="upper-label relative z-10 mb-4 text-[9px] tracking-[0.16em]"
        style={{ color: persona.accentVar }}
      >
        {persona.role}
      </span>
    </button>
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
    case "effective-bets":
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <Meter
            value={props.value as number}
            label={(props.label as string) ?? "Effective bets"}
            hint={props.hint as string}
          />
          <p className="mt-2 text-2xs leading-relaxed text-ink-lo">
            Participation ratio of your squad&apos;s simulated correlation matrix — 11 means fully
            independent bets, lower means stacking.
          </p>
        </div>
      );
    case "true-form":
      return (
        <ProbabilityBand
          points={props.points as never}
          xLabel="Gameweek"
          ariaLabel="Kalman-filtered per-90 contribution with uncertainty band"
        />
      );
    case "squad-generator": {
      const players = props.players as {
        elementId: number; webName: string; posLabel: string; cost: number; epNext: number | null;
      }[];
      const totalCost = props.totalCost as number;
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="flex items-baseline justify-between">
            <div className="upper-label text-2xs text-ink-lo">Generated 15</div>
            <div className="fig-num text-sm text-ink-hi">£{(totalCost / 10).toFixed(1)}m</div>
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-3">
            {players.map((p) => (
              <li key={p.elementId} className="flex items-baseline justify-between gap-2 rounded-md bg-surface-0 px-2.5 py-2 card-ring">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-hi">{p.webName}</span>
                  <span className="text-2xs uppercase-label text-ink-lo">{p.posLabel}</span>
                </span>
                <span className="text-right num-tabular">
                  <span className="fig-num block text-xs text-ink-hi">£{(p.cost / 10).toFixed(1)}</span>
                  <span className="block text-2xs text-ink-lo">{p.epNext ?? "—"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "transfer-watch": {
      const players = props.players as { name: string; epNext: number | null; cost: number; flagged: boolean; news: string }[];
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="upper-label text-2xs text-ink-lo">Weakest projected links</div>
          <ul className="mt-2 divide-y divide-hairline">
            {players.map((p) => (
              <li key={p.name} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-sm font-medium text-ink-hi">
                  {p.name}
                  {p.flagged && <span className="ml-2 text-2xs uppercase-label text-flare">flagged</span>}
                </span>
                <span className="num-tabular text-xs text-ink-lo">
                  {p.epNext ?? "—"} pts · £{(p.cost / 10).toFixed(1)}m
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "chip-timing": {
      const gws = props.gws as number[];
      const payoffs = props.payoffs as number[];
      const exerciseIndex = props.exerciseIndex as number;
      const best = Math.max(...payoffs, 1);
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="upper-label text-2xs text-ink-lo">Projected payoff by week</div>
          <ul className="mt-3 space-y-1.5">
            {gws.map((gw, i) => (
              <li key={gw} className="flex items-center gap-3">
                <span className={cn("w-12 text-xs num-tabular", i === exerciseIndex ? "font-semibold text-volt" : "text-ink-mid")}>
                  GW{gw}
                </span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(payoffs[i] / best) * 100}%`, background: i === exerciseIndex ? "var(--volt)" : "var(--seq-400)" }}
                  />
                </span>
                <span className="w-10 text-right fig-num text-xs text-ink-mid">{payoffs[i]}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "crowding": {
      const rows = props.rows as {
        posLabel: string; effectivePicks: number; players: number; topName: string | null; topShare: number;
      }[];
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="upper-label text-2xs text-ink-lo">Effective picks by position</div>
          <table className="mt-2 w-full text-sm num-tabular">
            <tbody>
              {rows.map((r) => (
                <tr key={r.posLabel} className="border-b border-hairline last:border-0">
                  <td className="py-1.5 text-ink-hi">{r.posLabel}</td>
                  <td className="py-1.5 text-right fig-num">{r.effectivePicks.toFixed(1)}</td>
                  <td className="w-28 py-1.5 pl-3 text-right text-xs text-ink-lo">
                    {r.topName != null ? `${r.topName} ${Math.round(r.topShare * 100)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-2xs leading-relaxed text-ink-lo">
            1/HHI over the field&apos;s ownership shares — low means the market collapsed onto
            one template, high means genuine disagreement to attack.
          </p>
        </div>
      );
    }
    case "wpa": {
      const winProb = props.winProb as number;
      const rivalName = props.rivalName as string;
      const moments = props.moments as { name: string; side: "you" | "them"; wpa: number }[];
      return (
        <div className="rounded-lg bg-surface-1 card-ring p-4">
          <div className="flex items-baseline justify-between">
            <div className="upper-label text-2xs text-ink-lo">Win probability</div>
            <div className="text-2xs uppercase-label text-ink-lo">vs {rivalName}</div>
          </div>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-l-full" style={{ width: `${winProb}%`, background: "var(--surge)" }} />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="fig-num text-sm text-surge">{winProb}%</span>
            <span className="text-2xs text-ink-lo">paired simulations — shared fixtures drawn once</span>
          </div>
          <ul className="mt-3 space-y-1">
            {moments.map((m) => (
              <li key={`${m.side}-${m.name}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-hi">
                  {m.name}
                  <span className="ml-1.5 text-2xs uppercase-label text-ink-lo">{m.side === "you" ? "yours" : "theirs"}</span>
                </span>
                <span className={`fig-num text-xs ${m.wpa >= 0 ? "text-surge" : "text-flare"}`}>
                  {m.wpa >= 0 ? "+" : "−"}{Math.abs(m.wpa).toFixed(1)}pp
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "twin-study": {
      const arms = props.arms as { arm: string; n: number; mean: number; median: number }[];
      const n = props.n as number;
      const reliable = props.reliable as boolean;
      const best = arms.length ? Math.max(...arms.map((a) => a.mean)) : 0;
      return (
        <div className={cn("rounded-lg bg-surface-1 card-ring p-4", !reliable && "opacity-60")}>
          <div className="flex items-baseline justify-between">
            <div className="upper-label text-2xs text-ink-lo">Twin study — observational</div>
            <div className="text-2xs text-ink-lo num-tabular">n = {n.toLocaleString("en-GB")}{reliable ? "" : " · thin"}</div>
          </div>
          <ul className="mt-2 space-y-1.5">
            {arms.map((a) => (
              <li key={a.arm} className="flex items-center gap-3">
                <span className="w-16 text-xs uppercase-label text-ink-mid">{a.arm}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${best > 0 ? (a.mean / best) * 100 : 0}%`, background: "var(--series-1)" }}
                  />
                </span>
                <span className="w-16 text-right fig-num text-xs text-ink-hi">{a.mean.toFixed(1)}</span>
                <span className="w-14 text-right text-2xs text-ink-lo num-tabular">n={a.n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-2xs leading-relaxed text-ink-lo">
            Managers with near-identical squads and bank, split by the decision they actually
            made. Observational — selection is visible in the arms, not controlled.
          </p>
        </div>
      );
    }
    default:
      return null;
  }
}
