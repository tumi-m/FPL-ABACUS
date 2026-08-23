"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/ui/cn";
import { PERSONAS, personaById, type PersonaId } from "@/lib/ai/personas";

const STORAGE_KEY = "gaffer_gaffer";

export function useGafferPersona(): [PersonaId, (id: PersonaId) => void] {
  const [id, setId] = React.useState<PersonaId>(DEFAULT_VALUE);
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setId(personaById(stored).id);
    } catch {
      /* storage blocked — default persona */
    }
  }, []);
  const choose = React.useCallback((next: PersonaId) => {
    setId(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* session-only */
    }
  }, []);
  return [id, choose];
}

const DEFAULT_VALUE: PersonaId = "oleg";

/**
 * The character-select strip (v6-B) — four gaffers, volt ring on the active
 * one, accent rail underneath. Choosing a gaffer changes the voice, never
 * the numbers.
 */
export function GafferStrip({ active, onChoose }: { active: PersonaId; onChoose: (id: PersonaId) => void }) {
  return (
    <div role="radiogroup" aria-label="Choose your gaffer" className="grid grid-cols-4 gap-2">
      {PERSONAS.map((p) => {
        const selected = p.id === active;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${p.name}, ${p.role} — ${p.blurb}`}
            title={`${p.role}: ${p.blurb}`}
            onClick={() => onChoose(p.id)}
            className={cn(
              "skewed group flex min-h-[64px] flex-col items-center justify-end gap-0.5 rounded-md card-ring px-1 pb-1.5 pt-1 transition-colors dur-instant",
              selected ? "bg-surface-3" : "hover:bg-surface-3/60",
            )}
            style={selected ? { boxShadow: "inset 0 0 0 1.5px var(--volt), var(--lift)" } : undefined}
          >
            <span className="relative block h-10 w-8 overflow-hidden rounded-sm" aria-hidden>
              <Image
                src={p.avatar}
                alt=""
                fill
                sizes="32px"
                className={cn("object-cover object-top", !selected && "opacity-75")}
                unoptimized
              />
            </span>
            <span className="text-[10px] font-bold uppercase-label text-ink-hi leading-none">{p.name}</span>
            <span
              aria-hidden
              className="block h-0.5 w-6 rounded-full"
              style={{ background: p.accentVar }}
            />
          </button>
        );
      })}
    </div>
  );
}
