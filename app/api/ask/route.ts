import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { cached } from "@/lib/cache/swr";
import { cacheStore } from "@/lib/cache/store";
import { aiEnabled, chat, chatStream, parseJson } from "@/lib/ai/client";
import { createSentenceGate } from "@/lib/ai/sentenceGate";
import { followUpsFor } from "@/lib/genui/followUps";
import { COMPONENT_KEYS, coerceParams, REGISTRY, isValidComponent } from "@/lib/genui/registry";
import { bestGuess, route } from "@/lib/genui/router";
import { resolveCard, type ResolvedCard } from "@/lib/genui/resolve";
import { buildMatchday } from "@/lib/server/buildMatchday";
import { personaById, personaFallback, personaPrompt, arcadeFacts, factsToPromptContext, type ArcadeMatchdayLite } from "@/lib/ai/personas";

export const maxDuration = 30;

const RATE_LIMIT = 60; // per hour per IP — raised for Ollama Pro cloud capacity
const RATE_WINDOW_S = 3600;

interface AskBody {
  q?: string;
  /** v6 — which arcade gaffer speaks. Unknown ids fall back to the default. */
  persona?: string;
  /**
   * The last few turns, so "what about him instead" resolves to somebody.
   * Carried by the client rather than stored: the desk is stateless, and a
   * conversation that lives in the tab dies with it, which is the right
   * lifetime for questions about one gameweek.
   */
  history?: { role: "user" | "gaffer"; content: string }[];
}

/** At most this many prior turns reach the prompt, newest last. */
const HISTORY_TURNS = 4;

function historyBlock(turns: AskBody["history"]): string | undefined {
  if (!turns?.length) return undefined;
  return turns
    .slice(-HISTORY_TURNS)
    .map((t) => `${t.role === "user" ? "user" : "gaffer"}: ${String(t.content).slice(0, 180)}`)
    .join("\n");
}

function ipOf(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function loadMatchday(teamId: number | null) {
  if (!teamId) return null;
  const result = await buildMatchday(teamId);
  return result.ok ? result.model : null;
}

/**
 * v6 gaffer voice: the persona restates the resolved card in its own lens.
 * The strict-numbers rule holds — prompts forbid figures; any model slip is
 * scrubbed before it can reach the bubble. Falls back to the deterministic
 * persona line when the gateway is down.
 */
async function gafferVoice(
  personaId: string | undefined,
  q: string,
  card: ResolvedCard | null,
  matchday: ArcadeMatchdayLite | null,
  history: string | undefined,
  onText: (chunk: string) => Promise<void>,
): Promise<{ persona: string; text: string; invented: number }> {
  const persona = personaById(personaId ?? null);
  if (!card || !aiEnabled()) {
    const text = personaFallback(persona);
    await onText(text);
    return { persona: persona.id, text, invented: 0 };
  }

  const factObj = arcadeFacts(q, matchday, card);
  const facts = factsToPromptContext(factObj);
  // The gate checks against the same object the prompt was built from, so the
  // set of quotable figures and the set of shown figures cannot drift.
  const gate = createSentenceGate(factObj);
  let shown = "";

  try {
    await chatStream(
      [
        { role: "system", content: personaPrompt(persona, facts, history) },
        { role: "user", content: q.slice(0, 200) },
      ],
      { timeoutMs: 20_000, maxTokens: 260, temperature: 0.5 },
      async (chunk) => {
        const out = gate.push(chunk);
        if (out.emit) {
          shown += out.emit;
          await onText(out.emit);
        }
      },
    );
    const tail = gate.flush();
    if (tail.emit) {
      shown += tail.emit;
      await onText(tail.emit);
    }
    if (!shown.trim()) {
      // Everything it said was unverifiable, or it said nothing at all.
      const text = personaFallback(persona);
      await onText(text);
      return { persona: persona.id, text, invented: gate.droppedCount };
    }
    return { persona: persona.id, text: shown.trim(), invented: gate.droppedCount };
  } catch {
    const text = personaFallback(persona);
    await onText(text);
    return { persona: persona.id, text, invented: gate.droppedCount };
  }
}

/** Slim team/gameweek summary for the arcade prompt from the composed model. */
function matchdayToLite(model: import("@/lib/engines/matchdayModel").MatchdayModel | null): ArcadeMatchdayLite | null {
  if (!model) return null;
  const benchByPos: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of model.squad.filter((s) => s.onBench)) {
    const key = POS_KEY[p.pos] ?? "FWD";
    benchByPos[key] = (benchByPos[key] ?? 0) + 1;
  }
  return {
    phase: model.phase,
    eventId: model.event.id,
    teamName: model.entry.name,
    points: model.hero.gwPoints,
    played: model.hero.playersPlayed,
    toPlay: model.hero.playersToPlay,
    captain: model.squad.find((s) => s.isCaptain)?.webName ?? null,
    benchByPos,
    threats: model.leverage.threats.slice(0, 4).map((t) => `${t.webName} (${t.exposure.toFixed(0)}% EO)`),
    rankNow: model.hero.officialLiveRank ?? model.hero.estimatedLiveRank,
    rankDelta: model.hero.rankDeltaSinceLastPoll,
  };
}

const POS_KEY: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

/** The model names a component; it never supplies numbers. */
async function modelSelect(q: string): Promise<{ component: string; params: Record<string, unknown> } | null> {
  if (!aiEnabled()) return null;
  const system =
    "You map fantasy-football questions to UI components. Reply with ONLY JSON " +
    `{"component":"<key>","params":{...}} using one of these keys: ${COMPONENT_KEYS.join(", ")}. ` +
    'Optional params: playerName, query. Never invent numbers.';
  try {
    const raw = await chat(
      [
        { role: "system", content: system },
        { role: "user", content: q.slice(0, 300) },
      ],
      { json: true, timeoutMs: 8_000, temperature: 0 },
    );
    const parsed = parseJson<{ component?: string; params?: Record<string, unknown> }>(raw);
    if (!parsed || !isValidComponent(parsed.component)) return null;
    const params = coerceParams(parsed.component, parsed.params ?? {});
    if (params == null) return null;
    return { component: parsed.component, params };
  } catch {
    return null;
  }
}

function cacheKeyFor(component: string, params: Record<string, unknown>, teamId: number | null, gw: number): string {
  const hash = createHash("sha1")
    .update(JSON.stringify({ c: component, p: params, t: teamId, g: gw }))
    .digest("hex")
    .slice(0, 24);
  return `gaffer:ask:${hash}`;
}

export async function POST(req: NextRequest) {
  let body: AskBody;
  try {
    body = (await req.json()) as AskBody;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const q = (body.q ?? "").trim();
  if (!q || q.length > 200) {
    return NextResponse.json({ error: "empty question" }, { status: 400 });
  }

  // Rate limit — Upstash when configured, memory otherwise.
  try {
    const n = await cacheStore().incrWithTtl(`gaffer:askrl:${ipOf(req)}`, RATE_WINDOW_S);
    if (n > RATE_LIMIT) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
  } catch {
    /* limiter down — serve anyway */
  }

  // Cookie-carried entry context.
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/gaffer_team=(\d+)/);
  const teamId = match ? Number(match[1]) : null;

  const routed =
    route(q) ??
    (await modelSelect(q).then((m) => {
      if (!m) return null;
      return { intent: "model", component: m.component, params: m.params, score: 1 };
    })) ??
    bestGuess(q);

  if (!routed) {
    return NextResponse.json({
      cards: [],
      prose:
        "I couldn't map that to a screen. Try asking about the captaincy, price moves, hits, fixtures, chips, injuries or news.",
      source: "none",
    });
  }

  // Current GW from the live bar data path is heavier than needed here; the
  // resolver only needs it for picks/fixtures, so derive from bootstrap.
  const boot = await import("@/lib/fpl/bootstrapLite").then((m) => m.getBootstrapLite());
  const currentGw =
    boot.events.find((e) => e.is_current)?.id ??
    Math.max(1, (boot.events.find((e) => e.is_next)?.id ?? 2) - 1);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown, delayMs = 0) =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
            resolve();
          }, delayMs);
        });

      try {
        await send({ type: "meta", intent: routed.intent, source: routed.intent === "model" ? "model" : "router" }, 60);

        // team/gameweek context for both the resolver and the arcade voice
        let matchdayLite: ArcadeMatchdayLite | null = null;
        const card: ResolvedCard | null = await cached(
          cacheKeyFor(routed.component, routed.params, teamId, currentGw),
          600,
          async () => {
            const matchday = await loadMatchday(teamId);
            matchdayLite = matchdayToLite(matchday);
            return resolveCard(routed.component, routed.params, {
              teamId,
              currentGw,
              matchday,
            });
          },
        );
        // a cache hit skips the resolver; matchday still needs loading for the voice
        if (matchdayLite === null) {
          matchdayLite = matchdayToLite(await loadMatchday(teamId));
        }

        /*
         * The voice arrives as it is written, not as one block twelve seconds
         * later — but only in verified sentences. `onText` is called with text
         * the sentence gate has already checked against the same facts the
         * prompt was built from, so nothing unverifiable is ever painted and
         * then withdrawn.
         */
        const history = historyBlock(body.history);
        const speak = async (chunk: string) => {
          await send({ type: "gaffer-delta", text: chunk });
        };

        if (!card) {
          const gaffer = await gafferVoice(body.persona, q, null, matchdayLite, history, speak);
          await send({ type: "gaffer", persona: gaffer.persona, text: gaffer.text }, 40);
          await send({
            type: "prose",
            text: `No grounded ${REGISTRY[routed.component]?.title ?? "card"} available right now — upstream may be quiet.`,
          });
        } else {
          // the gaffer speaks first; the grounded card follows
          const gaffer = await gafferVoice(body.persona, q, card, matchdayLite, history, speak);
          await send({ type: "gaffer", persona: gaffer.persona, text: gaffer.text }, 40);
          if (gaffer.invented > 0) {
            // Not shown to the reader — they never saw the dropped sentences —
            // but a model inventing figures is worth knowing about.
            console.warn("[ask] dropped unverifiable figures", {
              count: gaffer.invented,
              component: routed.component,
            });
          }
          await send({ type: "prose", text: card.prose }, 60);
          if (card.props) {
            await send({ type: "card", component: card.component, title: card.title, props: card.props, note: card.note }, 60);
          }
        }
        // newsdesk sources grounding the answer — links, never numbers
        if (card?.sources?.length) {
          await send(
            {
              type: "sources",
              items: card.sources.map((s) => ({ title: s.title, url: s.url, source: s.source })),
            },
            60,
          );
        }
        // What to ask next — every one of these routes, by test.
        await send(
          { type: "follow", items: followUpsFor(card ? routed.component : null, teamId != null) },
          40,
        );
        await send({ type: "done" });
      } catch (err) {
        // The real cause belongs in the server log, not in the user's face:
        // this used to stream raw Postgres text ("relation ... does not
        // exist") straight into the console sheet.
        console.error("[ask] resolve failed", err);
        await send({
          type: "error",
          message: "the desk could not answer that one. Try again in a moment.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    },
  });
}
