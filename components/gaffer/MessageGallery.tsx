"use client";

import * as React from "react";
import { GafferMessages } from "@/components/gaffer/GafferMessages";
import type { GafferMessage } from "@/lib/engines/gafferMessages";

/** One of each kind, in the shapes the engine actually emits. */
const SAMPLES: GafferMessage[] = [
  {
    id: "a",
    kind: "swing",
    label: "Your captain",
    headline: "Saka scores",
    detail: "5 points, doubled to 10 by your armband.",
    tone: "good",
    href: "/live",
  },
  {
    id: "b",
    kind: "threat",
    label: "Against you",
    headline: "Haaland scores",
    detail: "62% of the field own him. You don't.",
    tone: "bad",
    href: "/live",
  },
  {
    id: "c",
    kind: "deadline",
    label: "Deadline",
    headline: "1h 30m to lock in",
    detail: "Check the XI, the armband and the flags before it closes.",
    tone: "neutral",
    href: "/deadline",
  },
];

export function MessageGallery() {
  const [messages, setMessages] = React.useState<GafferMessage[]>(SAMPLES);
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Gaffer messages</h1>
      <p className="text-sm text-ink-mid">
        One card per tone. They clear themselves after a dwell — press replay to bring them back.
      </p>
      <button
        type="button"
        onClick={() => setMessages(SAMPLES)}
        className="skewed inline-flex h-10 items-center rounded-md bg-volt px-4 text-xs uppercase-label text-on-accent"
      >
        Replay
      </button>
      <GafferMessages
        messages={messages}
        onDismiss={(id) => setMessages((list) => list.filter((m) => m.id !== id))}
      />
    </div>
  );
}
