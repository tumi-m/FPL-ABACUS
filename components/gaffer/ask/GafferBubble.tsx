"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/ui/cn";
import { blip } from "@/lib/ai/blips";
import type { Persona } from "@/lib/ai/personas";

const CHAR_MS = 18;
const PUNCT_MS = 130;

/**
 * The arcade speech bubble (v6-B): persona prose types out token-by-token
 * with punctuation pauses and synthesised blips, exactly like a 90s text box.
 * Numbers never appear here — they render beside it from resolver data.
 * Reduced-motion: full text instantly, no blips, avatar static.
 */
export function GafferBubble({
  persona,
  text,
  blipsOn,
  onDone,
}: {
  persona: Persona;
  text: string;
  blipsOn: boolean;
  onDone?: () => void;
}) {
  const [shown, setShown] = React.useState(0);
  const [talking, setTalking] = React.useState(false);
  const doneRef = React.useRef(false);

  React.useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(text.length);
      return;
    }
    setShown(0);
    setTalking(true);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (i >= text.length) {
        setTalking(false);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone?.();
        }
        return;
      }
      const ch = text[i];
      i++;
      setShown(i);
      const punct = /[.!?,:;—]/.test(ch);
      if (blipsOn) blip(punct);
      timer = setTimeout(step, punct ? PUNCT_MS : CHAR_MS);
    };
    timer = setTimeout(step, CHAR_MS);
    return () => clearTimeout(timer);
  }, [text, blipsOn, onDone]);

  return (
    <div className="flex items-start gap-3" aria-live="polite">
      {/* avatar — breathing idle, bounce while talking; transform only */}
      <div
        className={cn(
          "shrink-0 select-none",
          talking ? "gaffer-talk" : "gaffer-breathe",
        )}
        aria-hidden
      >
        <Image
          src={persona.avatar}
          alt=""
          width={64}
          height={84}
          className="h-[84px] w-16 rounded-md object-cover object-top"
          unoptimized
        />
      </div>

      {/* speech bubble — pixel border via layered box-shadows, accent rail left */}
      <div className="relative min-w-0 flex-1">
        <div
          className="rounded-md bg-surface-1 p-3.5"
          style={{
            boxShadow: `inset 3px 0 0 ${persona.accentVar}, inset 0 0 0 1px var(--line), 0 4px 0 0 rgba(0,0,0,.35)`,
          }}
        >
          <p className="upper-label text-2xs" style={{ color: persona.accentVar }}>
            {persona.name} · {persona.role}
          </p>
          <p className="mt-1.5 min-h-[2.5rem] text-sm leading-relaxed text-ink-hi">
            {text.slice(0, shown)}
            {shown < text.length && <span aria-hidden className="gaffer-caret">▌</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
