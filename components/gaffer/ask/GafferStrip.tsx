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
 * The character-select strip (v6-B) — four gaffers, accent outline + rail on
 * the active one, idle sprite per tile. Choosing a gaffer changes the voice,
 * never the numbers.
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
              "skewed group flex min-h-[88px] flex-col items-center justify-end gap-1 rounded-md card-ring px-1 pb-1.5 pt-2 transition-colors dur-instant",
              selected ? "bg-surface-3" : "hover:bg-surface-3/60",
            )}
            style={selected ? { boxShadow: `inset 0 0 0 1.5px ${p.accentVar}, var(--lift)` } : undefined}
          >
            <span className="relative block h-14 w-14 overflow-hidden rounded-sm" aria-hidden>
              <Image
                src={p.avatarIdle}
                alt=""
                fill
                sizes="56px"
                className={cn("object-contain object-bottom", !selected && "opacity-75 saturate-[.85]")}
                unoptimized
              />
            </span>
            <span className="text-[10px] font-bold uppercase-label text-ink-hi leading-none">{p.name}</span>
            <span
              aria-hidden
              className="block h-0.5 w-6 rounded-full"
              style={{ background: selected ? p.accentVar : "transparent" }}
            />
          </button>
        );
      })}
    </div>
  );
}
