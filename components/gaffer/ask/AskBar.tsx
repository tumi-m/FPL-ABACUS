"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/primitives/Sheet";
import { GafferBadge } from "@/components/gaffer/GafferBadge";
import { GafferStrip, useGafferPersona } from "@/components/gaffer/ask/GafferStrip";
import { GafferBubble } from "@/components/gaffer/ask/GafferBubble";
import { AssembledAnswer } from "@/components/gaffer/ask/AssembledAnswer";
import { PERSONAS, personaById, type PersonaId } from "@/lib/ai/personas";

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
  | { type: "gaffer-delta"; text: string }
  | { type: "follow"; items: string[] }
  | CardEvent
  | { type: "sources"; items: { title: string; url: string; source: string }[] }
  | { type: "done" }
  | { type: "error"; message: string };

/** Rotating status lines while the gaffer works. */
const THINKING = [
  "Reading the fixture board",
  "Checking the price ticker",
  "Squinting at the xG tallies",
  "Warming up the engines",
  "Consulting the gaffer",
];

function ThinkingLine() {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const t = window.setInterval(() => setI((v) => (v + 1) % THINKING.length), 1_600);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-surface-1 card-ring px-4 py-3" role="status">
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((d) => (
          <span
            key={d}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-volt"
            style={{ animationDelay: `${d * 140}ms` }}
          />
        ))}
      </span>
      <span className="text-xs text-ink-mid">
        {THINKING[i]}
        <span className="animate-pulse">…</span>
      </span>
    </div>
  );
}

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
  /** Registry key + props — the assembled layout quotes the prose line. */
  component: string;
  props: Record<string, unknown>;
  prose: string;
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
  const [sources, setSources] = React.useState<{ title: string; url: string; source: string }[]>([]);
  const [follow, setFollow] = React.useState<string[]>([]);
  /* The turns the desk gets to see. Kept in the tab: a conversation about one
     gameweek has no business outliving the session. */
  const [history, setHistory] = React.useState<{ role: "user" | "gaffer"; content: string }[]>([]);
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
    setSources([]);
    setFollow([]);
    setQ(question);
    const priorTurns = history;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: question, persona: personaId, history: priorTurns }),
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
          if (ev.type === "gaffer-delta") {
            /* Verified sentences arriving one at a time. The first opens the
               bubble; the rest extend it, so the line is written rather than
               dropped in complete after a long pause. */
            setGaffers((g) => {
              if (g.length === 0) return [{ kind: "gaffer", personaId, text: ev.text }];
              const last = g[g.length - 1];
              return [...g.slice(0, -1), { ...last, text: last.text + ev.text }];
            });
          } else if (ev.type === "gaffer") {
            // The final, whole line — replaces the streamed one so a fallback
            // that arrived after a failed stream does not append to a stub.
            setGaffers([{ kind: "gaffer", personaId: ev.persona, text: ev.text }]);
          } else if (ev.type === "follow") {
            setFollow(ev.items);
          } else if (ev.type === "prose") {
            setProse((p) => [...p, ev.text]);
          } else if (ev.type === "card") {
            setCards((c) => [...c, { kind: "card", component: ev.component, props: ev.props, prose: ev.title }]);
          } else if (ev.type === "sources") {
            setSources(ev.items);
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
    setHistory((h) => [...h, { role: "user" as const, content: question }].slice(-8));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the Gaffer"
        className="hidden sm:inline-flex h-8 items-center gap-2 rounded-full glass-edge px-3 text-xs text-ink-lo transition-colors dur-instant hover:text-ink-hi"
      >
        <GafferBadge size="1.15em" />
        Ask the Gaffer
        <kbd className="rounded bg-surface-3 px-1 py-0.5 text-2xs num-tabular">⌘K</kbd>
      </button>
      {/* mobile trigger — the badge stands where a "?" used to, so the button
          shows who answers rather than reading as a help icon */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the Gaffer"
        className="skewed inline-flex h-11 items-center gap-1.5 rounded-md glass-edge px-3.5 text-xs uppercase-label font-semibold text-ink-2 transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi sm:hidden"
      >
        Ask <GafferBadge />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetTitle className="text-center">
            <span className="fig-num text-lg tracking-[0.35em] text-ink-hi">GAFFER</span>
          </SheetTitle>

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
              aria-label="Consult Gaffer"
              className="skewed inline-flex h-10 items-center rounded-md bg-volt px-4 text-xs uppercase-label font-semibold text-on-accent transition-all dur-instant hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <span className="flex items-center gap-1" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-accent"
                      style={{ animationDelay: `${i * 140}ms` }}
                    />
                  ))}
                </span>
              ) : (
                <span>Consult Gaffer</span>
              )}
            </button>
          </form>

          {/* immersive gaffer — the selected one fills the console, frames flip */}
          <SelectedGafferHero personaId={personaId} busy={busy} onSummon={() => inputRef.current?.focus()} />

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
                  className="rounded-full glass-edge px-3 py-1.5 text-xs text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div ref={resultsRef} className="mt-4 max-h-[60dvh] space-y-3 overflow-y-auto pr-1">
            {busy && <ThinkingLine />}
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
            {cards.length > 0 && (
              <AssembledAnswer
                cards={cards.map((c) => ({
                  component: c.component,
                  props: c.props,
                  prose: c.prose,
                }))}
              />
            )}
            {sources.length > 0 && (
              <div className="rounded-lg bg-surface-1 card-ring p-4">
                <p className="upper-label text-2xs text-ink-lo">Sources</p>
                <ul className="mt-2 space-y-1.5">
                  {sources.map((s) => (
                    <li key={s.url} className="text-sm">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-4 transition-colors dur-instant hover:text-volt hover:underline"
                      >
                        {s.title}
                      </a>{" "}
                      <span aria-hidden className="text-2xs text-ink-lo">
                        ↗
                      </span>{" "}
                      <span className="text-2xs uppercase-label text-ink-lo">{s.source}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/*
             * Where to go next, once there is an answer to go on from. The
             * desk understands a vocabulary the reader cannot see, so a
             * one-shot answer ends the conversation at exactly the moment
             * somebody has a second question. Every chip routes — there is a
             * test that walks all of them through the router.
             */}
            {!busy && follow.length > 0 && (
              <div>
                <p className="upper-label mb-1.5 text-2xs text-ink-lo">Ask next</p>
                <div className="flex flex-wrap gap-2">
                  {follow.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => void ask(f)}
                      className="rounded-full glass-edge px-3 py-1.5 text-xs text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
  busy,
  onSummon,
}: {
  personaId: PersonaId;
  /** While the model works the gaffer mumbles — talk frames flip at double speed. */
  busy?: boolean;
  onSummon: () => void;
}) {
  const persona = personaById(personaId);
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(
      () => setFrame((f) => (f + 1) % persona.avatarTalk.length),
      busy ? 140 : 280,
    );
    return () => window.clearInterval(t);
  }, [persona, busy]);

  const src = persona.avatarTalk[frame % persona.avatarTalk.length] ?? persona.avatarIdle;

  return (
    <button
      type="button"
      onClick={onSummon}
      aria-label={`${persona.name} — focus the question box`}
      className="group relative mx-auto mt-5 flex w-full max-w-[560px] flex-col items-center overflow-hidden rounded-xl card-ring transition-all dur-instant hover:-translate-y-0.5"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--sunk) 88%, transparent), color-mix(in oklab, var(--raised) 65%, transparent))",
        boxShadow: busy
          ? `inset 0 0 0 1.5px color-mix(in oklab, ${persona.accentVar} 70%, transparent), 0 0 24px 2px color-mix(in oklab, ${persona.accentVar} 35%, transparent)`
          : `inset 0 0 0 1.5px color-mix(in oklab, ${persona.accentVar} 40%, transparent)`,
      }}
    >
      {/* pitch pad under the boots */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-16 rounded-b-xl"
        style={{
          background:
            "linear-gradient(180deg, transparent, color-mix(in oklab, var(--landing-a) 82%, transparent)), repeating-linear-gradient(90deg, rgba(255,255,255,.03) 0 36px, transparent 36px 72px)",
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
        style={{ color: persona.accentInkVar }}
      >
        {persona.role}
      </span>
    </button>
  );
}

/**
 * The card renderer, fetched the first time an answer carries one.
 *
 * The assembled answer (E4) imports the same module dynamically — one chunk
 * arrives with the first card, whatever template composes them.
 */
