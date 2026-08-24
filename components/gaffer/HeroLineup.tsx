"use client";

import * as React from "react";
import Image from "next/image";
import { PERSONAS, personaById, type Persona, type PersonaId } from "@/lib/ai/personas";
import { useGafferPersona } from "@/components/gaffer/ask/GafferStrip";
import { cn } from "@/lib/ui/cn";

/**
 * Landing hero band — the four gaffers in a line; the selected one frame-flips
 * while idle. Selecting persists the gaffer (⌘K console follows); double-click
 * or the CTA opens the sheet pre-seeded.
 */
export function HeroLineup() {
  const [personaId, setPersonaId] = useGafferPersona();
  const selected: Persona = personaById(personaId ?? undefined);
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setFrame((f) => f + 1), 280);
    return () => window.clearInterval(t);
  }, []);

  const summon = (id: PersonaId) => {
    setPersonaId(id);
    window.dispatchEvent(new CustomEvent("gaffer:open-ask", { detail: { persona: id } }));
  };

  return (
    <section aria-label="Meet the gaffers" className="relative flex flex-col">
      <div className="relative mx-auto flex w-full max-w-[1100px] flex-col items-center px-4 pt-6 pb-10 text-center">
        <p className="upper-label text-2xs text-white/60">
          Four gaffers. One console. Pick who talks.
        </p>

        <div
          role="radiogroup"
          aria-label="Gaffers"
          className="mt-4 flex w-full items-end justify-center gap-1 sm:gap-3 md:gap-6"
        >
          {PERSONAS.map((p) => {
            const active = selected.id === p.id;
            const src = active ? p.avatarTalk[frame % p.avatarTalk.length] : p.avatarIdle;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPersonaId(p.id)}
                onDoubleClick={() => summon(p.id)}
                title={`${p.name} — ${p.role}. Double-click to ask.`}
                className={cn(
                  "group relative flex flex-col items-center transition-transform dur-instant",
                  !active && "hover:-translate-y-1",
                )}
              >
                <span
                  className={cn(
                    "relative block",
                    active && "after:absolute after:-inset-1.5 after:-z-10 after:rounded-lg after:bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--volt)_26%,transparent),transparent)] after:ring-1 after:ring-volt/50",
                  )}
                >
                  <Image
                    src={src}
                    alt={p.name}
                    width={256}
                    height={256}
                    className={cn(
                      "h-28 w-28 object-contain object-bottom drop-shadow-[0_14px_16px_rgba(0,0,0,.45)] sm:h-36 sm:w-36 md:h-44 md:w-44",
                      !active && "opacity-70 saturate-75",
                    )}
                    unoptimized
                  />
                </span>
                <span
                  className={cn(
                    "skewed mt-2 inline-flex scale-x-[1.12] items-center rounded-sm px-3 py-0.5 text-2xs font-extrabold tracking-[0.18em] text-black transition-opacity dur-instant",
                    !active && "opacity-70",
                  )}
                  style={{ background: p.accentVar }}
                >
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-white/60">
          Double-click a gaffer to open the console — every figure still comes from the engines.
        </p>
      </div>
    </section>
  );
}

