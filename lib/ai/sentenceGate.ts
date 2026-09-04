import { verifyFigures } from "@/lib/ai/verifyFigures";

/**
 * Streams the gaffer's reply without ever showing an unchecked figure.
 *
 * Streaming and verification pull against each other: the check needs a whole
 * sentence, and the point of streaming is not to wait for the whole reply. The
 * gate resolves it at the sentence boundary — text is held until it is a
 * complete sentence, verified against the facts, and only then released. A
 * sentence carrying a figure the facts do not support is dropped and never
 * reaches the screen, so the reader sees the answer arriving without ever
 * seeing a number that has to be taken back.
 */
export interface GateOut {
  /** Verified text ready to show. Empty when nothing has completed yet. */
  emit: string;
  /** Figures dropped on this pass. */
  invented: string[];
}

const TERMINATOR = /[.!?]["')\]]?\s/;

export function createSentenceGate(facts: unknown) {
  let buf = "";
  let dropped = 0;

  const take = (upTo: number): GateOut => {
    const chunk = buf.slice(0, upTo);
    buf = buf.slice(upTo);
    const v = verifyFigures(chunk, facts);
    dropped += v.invented.length;
    return { emit: v.text ? `${v.text} ` : "", invented: v.invented };
  };

  return {
    /** Feed raw model text; get back whatever is now safe to show. */
    push(chunk: string): GateOut {
      buf += chunk;
      let emit = "";
      const invented: string[] = [];
      for (;;) {
        const m = TERMINATOR.exec(buf);
        if (!m) break;
        const out = take(m.index + m[0].length);
        emit += out.emit;
        invented.push(...out.invented);
      }
      return { emit, invented };
    },

    /** End of stream: release the tail, terminator or not. */
    flush(): GateOut {
      if (!buf.trim()) {
        buf = "";
        return { emit: "", invented: [] };
      }
      return take(buf.length);
    },

    /** How many invented figures were caught across the whole reply. */
    get droppedCount(): number {
      return dropped;
    },
  };
}
