"use client";

import * as React from "react";
import Image from "next/image";
import { PERSONAS, type Persona } from "@/lib/ai/personas";
import { cn } from "@/lib/ui/cn";

/**
 * Character-select showcase for the landing page. Four gaffers, one intro
 * bubble each; selecting arms the "Ask the Gaffer" CTA which summons the ask
 * console pre-seeded with that persona.
 */
export function GafferShowcase() {
  const [selected, setSelected] = React.useState<Persona>(PERSONAS[0]);

  const summon = () => {
    window.dispatchEvent(new CustomEvent("gaffer:open-ask", { detail: { persona: selected.id } }));
  };

  return (
    <section aria-label="Choose your gaffer" className="mx-auto w-full max-w-[1360px] px-4 pb-14 pt-10 md:px-6 md:pt-14">
      <h2 className="upper-label text-center text-2xs text-white/60">Pick a voice — every figure still comes from the engines</h2>

      <div role="radiogroup" aria-label="Gaffers" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PERSONAS.map((p) => {
          const checked = selected.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setSelected(p)}
              className={cn(
                "group relative flex flex-col items-center rounded-xl bg-surface-1/90 p-5 pt-4 backdrop-blur-sm transition-all dur-instant",
                "card-ring hover:-translate-y-1 hover:bg-surface-1",
                checked && "-translate-y-1 bg-surface-1",
              )}
              style={
                checked
                  ? { boxShadow: `0 0 0 2px ${p.accentVar}, 0 18px 40px -18px rgba(0,0,0,.65)` }
                  : undefined
              }
            >
              {/* speech bubble */}
              <span
                className={cn(
                  "relative mb-3 block rounded-lg px-3.5 py-2.5 text-center text-xs leading-relaxed transition-colors dur-instant",
                  checked ? "bg-surface-3 text-ink-hi" : "bg-surface-2 text-ink-mid",
                )}
              >
                {p.intro}
                <span
                  aria-hidden
                  className={cn("absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px]", checked ? "bg-surface-3" : "bg-surface-2")}
                />
              </span>

              <Image
                src={p.avatarIdle}
                alt=""
                width={352}
                height={353}
                className={cn(
                  "h-44 w-auto max-w-full object-contain object-bottom transition-transform dur-instant group-hover:scale-[1.03] md:h-52",
                  !checked && "opacity-80 saturate-[.85]",
                )}
              />

              <span
                aria-hidden
                className="skewed mt-3 inline-flex scale-x-[1.12] items-center rounded-sm px-4 py-1 text-sm font-extrabold tracking-[0.18em] text-black"
                style={{ background: p.accentVar }}
              >
                {p.name}
              </span>
              <span className="upper-label mt-2 text-2xs" style={{ color: p.accentVar }}>
                {p.role}
              </span>
              <span className="mt-1 block text-center text-xs leading-relaxed text-ink-lo">{p.blurb}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={summon}
          className="skewed inline-flex h-12 items-center gap-3 rounded-md bg-volt px-8 text-base uppercase-label font-bold text-on-accent shadow-[0_10px_30px_-10px_var(--volt)] transition-transform dur-instant hover:-translate-y-0.5 active:translate-y-0"
        >
          Ask the Gaffer
          <kbd className="rounded bg-black/20 px-1.5 py-0.5 text-2xs num-tabular">⌘K</kbd>
        </button>
      </div>
    </section>
  );
}
