"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/ui/cn";
import { PERSONAS } from "@/lib/ai/personas";
import { useGafferPersona } from "@/components/gaffer/ask/GafferStrip";

/**
 * The Arcade (v6) — the mockup's character-select screen as a route. Choosing
 * a gaffer here persists the same way the ⌘K console does, so the voice
 * follows you across the app. Selection is chrome; numbers still live in the
 * resolver.
 */
export function ArcadeClient() {
  const [personaId, choosePersona] = useGafferPersona();

  const askGaffer = () => {
    window.dispatchEvent(new CustomEvent("gaffer:open-ask"));
  };

  return (
    <div className="space-y-5">
      {/* the select grid — 2×2 mobile, 4-up desktop, like the mockup */}
      <div role="radiogroup" aria-label="Select your gaffer" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {PERSONAS.map((p) => {
          const selected = p.id === personaId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${p.name}, ${p.role} from ${p.region}`}
              onClick={() => choosePersona(p.id)}
              className={cn(
                "group relative flex flex-col rounded-lg text-left transition-transform dur-instant focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt active:scale-[0.98]",
                selected ? "card-lift" : "opacity-90 hover:opacity-100",
              )}
              style={selected ? { boxShadow: "inset 0 0 0 1.5px var(--volt), var(--lift)" } : undefined}
            >
              {/* speech bubble — the gaffer's intro line */}
              <div
                className="mb-2 min-h-[92px] rounded-md bg-surface-1 p-3"
                style={{
                  boxShadow: `inset 3px 0 0 ${p.accentVar}, inset 0 0 0 1px var(--line), 0 4px 0 0 rgba(0,0,0,.35)`,
                }}
              >
                <p className="upper-label text-2xs" style={{ color: p.accentInkVar }}>
                  {p.name}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-hi">{p.intro}</p>
              </div>

              {/* the gaffer — avatar still, flat, never skewed */}
              <div className="relative overflow-hidden rounded-lg" aria-hidden>
                <Image
                  src={p.avatarIdle}
                  alt=""
                  width={256}
                  height={256}
                  className="aspect-square w-full object-cover object-top"
                  unoptimized
                />
                {selected && (
                  <span className="absolute left-2 top-2 rounded-sm bg-volt px-1.5 py-0.5 text-[9px] font-bold uppercase-label text-on-accent">
                    Selected
                  </span>
                )}
              </div>

              {/* name plate — skewed chrome, accent rail, region */}
              <div
                className="skewed mt-2 flex items-center justify-between rounded-md bg-raised px-3 py-2 card-ring"
                style={{ boxShadow: `inset 0 -2px 0 ${p.accentVar}` }}
              >
                <span className="fig-num text-base leading-none text-ink-hi">{p.name}</span>
                <span className="upper-label text-2xs text-ink-lo">{p.region}</span>
              </div>
              <p className="upper-label mt-1.5 text-2xs text-ink-lo">{p.role}</p>
            </button>
          );
        })}
      </div>

      {/* the CTA — opens the same console the strip lives in */}
      <div className="flex flex-col items-center gap-2 rounded-lg bg-surface-1 card-ring px-5 py-4 text-center">
        <p className="text-sm text-ink-2">
          Your gaffer rides the bench in the ⌘K console — every figure they point at comes from
          the engines, never invented.
        </p>
        <button
          type="button"
          onClick={askGaffer}
          className="skewed inline-flex h-11 items-center rounded-md bg-volt px-5 text-xs uppercase-label text-on-accent btn-glow transition-transform dur-instant active:scale-[0.97]"
        >
          <span>Put your gaffer to work</span>
        </button>
      </div>
    </div>
  );
}
