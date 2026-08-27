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
  const [talkIdx, setTalkIdx] = React.useState(0);
  const doneRef = React.useRef(false);

  // Talking animation — flip the sprite's talk frames at ~3.5fps while the
  // text types; reduced-motion keeps a static idle frame.
  React.useEffect(() => {
    if (!talking || persona.avatarTalk.length === 0) {
      setTalkIdx(-1);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setTalkIdx(0);
    const iv = setInterval(() => setTalkIdx((i) => (i + 1) % persona.avatarTalk.length), 280);
    return () => clearInterval(iv);
  }, [talking, persona]);

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
    <div className="flex items-start gap-3 md:gap-4" aria-live="polite">
      {/* avatar — idle sprite breathes; talk frames flip while speaking */}
      <div
        className={cn(
          "shrink-0 select-none",
          talking ? "gaffer-talk" : "gaffer-breathe",
        )}
        aria-hidden
      >
        <Image
          src={talkIdx >= 0 ? persona.avatarTalk[talkIdx] ?? persona.avatarIdle : persona.avatarIdle}
          alt=""
          width={128}
          height={128}
          sizes="(min-width: 768px) 128px, 96px"
          className="h-24 w-24 rounded-lg card-ring object-cover object-top md:h-32 md:w-32"
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
          <p className="upper-label text-2xs" style={{ color: persona.accentInkVar }}>
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
