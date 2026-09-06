"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { personaById } from "@/lib/ai/personas";
import { useGafferPersona } from "@/components/gaffer/ask/GafferStrip";
import { X } from "@/components/primitives/icons";
import { cn } from "@/lib/ui/cn";
import type { GafferMessage, MessageTone } from "@/lib/engines/gafferMessages";

/**
 * The Gaffer's lower-third — the console-football message card.
 *
 * A single line of grey text at the bottom of the screen was the whole
 * vocabulary this app had for "something just happened", and it was used for
 * exactly one thing. The register a football game uses is a card: who is
 * telling you, what kind of news it is, the headline, and the number under
 * it — enough to read at a glance from across a room, and gone before it is
 * in the way.
 *
 * The gaffer talking is the one you picked in the Arcade, so his face and his
 * accent colour are on the card. The tone rail is the model's, not his: good
 * news is surge, bad news is flare, and a fact is neither.
 *
 * Chrome only. Every figure in a message came out of the model in
 * `gafferMessages`, and the card adds nothing to it.
 */

const DWELL_MS = 9_000;
/** More than this on screen and it is a feed, not an interruption. */
const MAX_ON_SCREEN = 3;

const RAIL: Record<MessageTone, string> = {
  good: "bg-surge",
  bad: "bg-flare",
  neutral: "bg-volt",
};

export function GafferMessages({
  messages,
  onDismiss,
}: {
  messages: GafferMessage[];
  onDismiss: (id: string) => void;
}) {
  const [personaId] = useGafferPersona();
  const persona = personaById(personaId);
  const shown = messages.slice(0, MAX_ON_SCREEN);
  if (shown.length === 0) return null;

  return (
    <div
      // Above the thumb bar on a phone, clear of the corner on a desktop.
      // pointer-events are handed back per card so the page underneath stays
      // usable while a message is up.
      className="pointer-events-none fixed inset-x-3 z-50 flex flex-col items-stretch gap-2 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-4 sm:w-[22rem] lg:bottom-6"
    >
      {shown.map((m) => (
        <Card
          key={m.id}
          message={m}
          avatar={persona.avatarIdle}
          gaffer={persona.name}
          accent={persona.accentVar}
          onDismiss={() => onDismiss(m.id)}
        />
      ))}
    </div>
  );
}

function Card({
  message,
  avatar,
  gaffer,
  accent,
  onDismiss,
}: {
  message: GafferMessage;
  avatar: string;
  gaffer: string;
  accent: string;
  onDismiss: () => void;
}) {
  React.useEffect(() => {
    const t = setTimeout(onDismiss, DWELL_MS);
    return () => clearTimeout(t);
    // The card clears on its own after one dwell, whatever happens to the
    // props around it — a re-render must not restart the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const body = (
    <>
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", RAIL[message.tone])} />
      <span
        aria-hidden
        className="relative ml-1 grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-sunk"
        style={{ boxShadow: `0 0 0 1.5px ${accent}` }}
      >
        <Image src={avatar} alt="" width={40} height={40} className="object-cover" unoptimized />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="upper-label text-2xs" style={{ color: accent }}>
            {gaffer}
          </span>
          <span aria-hidden className="text-2xs text-ink-lo/60">·</span>
          <span className="upper-label text-2xs text-ink-lo">{message.label}</span>
        </span>
        <span className="mt-0.5 block truncate text-sm font-medium text-ink-hi">
          {message.headline}
        </span>
        <span className="mt-0.5 block text-2xs leading-snug text-ink-mid">{message.detail}</span>
      </span>
    </>
  );

  return (
    <div
      role="status"
      className="gaffer-msg pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-md glass-lift py-2.5 pl-2.5 pr-9"
    >
      {message.href ? (
        <Link href={message.href} className="flex flex-1 items-center gap-3 min-w-0">
          {body}
        </Link>
      ) : (
        body
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Dismiss: ${message.headline}`}
        className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-sm text-ink-lo transition-colors dur-instant hover:text-ink-hi"
      >
        <X width={13} height={13} />
      </button>
    </div>
  );
}
