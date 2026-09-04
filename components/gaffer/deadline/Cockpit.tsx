import Link from "next/link";
import { Est } from "@/components/gaffer/Est";
import { Badge } from "@/components/primitives/Badge";
import { cn } from "@/lib/ui/cn";
import type { CockpitResult } from "@/lib/engines/cockpit";

/**
 * The Deadline Cockpit — a column of verdicts, not data.
 *
 * Each block is one line, always visible; the evidence opens beneath it and
 * starts closed. A block with nothing to say renders as a tick line — never
 * an empty card. All styling is chrome; the verdicts and estimates are plain
 * text on the page ground (skew/gloss never touch data).
 *
 * Server component: the verdicts arrive composed. The only interactivity is
 * native <details>, which needs no JS at all.
 */

const STATE_MARK: Record<string, { glyph: string; className: string }> = {
  ok: { glyph: "✓", className: "text-good" },
  warn: { glyph: "!", className: "text-warning" },
  critical: { glyph: "✕", className: "text-critical" },
};

const BLOCK_LABEL: Record<string, string> = {
  xi: "Your XI",
  flagged: "Availability",
  captain: "Captain",
  transfers: "Transfers",
  price: "Price moves",
};

export function Cockpit({ cockpit }: { cockpit: CockpitResult }) {
  return (
    <section aria-label="Deadline verdicts" className="space-y-2">
      <ol className="space-y-2">
        {cockpit.blocks.map((b) => {
          const mark = STATE_MARK[b.state] ?? STATE_MARK.ok;
          const hasEvidence = (b.evidence?.length ?? 0) > 0;
          return (
            <li key={b.id}>
              <details
                open={b.state !== "ok"}
                className={cn(
                  "group rounded-lg card-ring",
                  b.state === "ok" ? "bg-surface-1" : "bg-raised",
                  hasEvidence && "open:pb-1",
                )}
              >
                <summary
                  aria-label={`${BLOCK_LABEL[b.id] ?? b.id}: ${b.verdict}`}
                  className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 marker:content-[''] focus-visible:outline-2 focus-visible:outline-volt"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full text-2xs font-bold",
                      b.state === "ok" && "bg-surface-3",
                      mark.className,
                    )}
                  >
                    {mark.glyph}
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-snug text-ink-1">{b.verdict}</span>
                  {hasEvidence && (
                    <span
                      aria-hidden
                      className="text-2xs text-ink-lo transition-transform dur-instant group-open:rotate-180"
                    >
                      ▾
                    </span>
                  )}
                </summary>
                {hasEvidence && (
                  <div className="border-t border-hairline px-4 py-3 pl-12">
                    <ul className="space-y-1.5">
                      {b.evidence!.map((e, i) => (
                        <li key={i} className="text-xs leading-relaxed text-ink-mid">
                          {e.href ? (
                            <Link href={e.href} className="text-ink-1 underline-offset-2 hover:text-brand hover:underline">
                              {e.text}
                            </Link>
                          ) : (
                            e.text
                          )}
                          {e.est && (
                            <span className="ml-1.5 fig-num text-sm text-ink-hi">
                              <Est method={e.est.method}>{e.est.value}</Est>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </details>
            </li>
          );
        })}
      </ol>

      {cockpit.allClear ? (
        <p className="rounded-lg has-gloss bg-raised px-4 py-3 text-sm font-semibold text-ink-1">
          Nothing else to do.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {cockpit.blocks
            .filter((b) => b.action && b.state !== "ok")
            .map((b) => (
              <Link
                key={b.id}
                href={b.action!.href}
                className="skewed inline-flex h-10 items-center rounded-md bg-volt px-4 text-2xs uppercase-label text-on-accent transition-transform dur-instant active:scale-[0.98]"
              >
                <span>{b.action!.label}</span>
              </Link>
            ))}
        </div>
      )}
    </section>
  );
}

/** The tick-line legend, so the marks say their names (style-guide rule). */
export function CockpitKey({ blocks }: { blocks: CockpitResult["blocks"] }) {
  const states = new Set(blocks.map((b) => b.state));
  return (
    <div className="flex gap-2">
      {states.has("ok") && <Badge>done</Badge>}
      {states.has("warn") && <Badge variant="warning">watch</Badge>}
      {states.has("critical") && <Badge variant="critical">act</Badge>}
    </div>
  );
}