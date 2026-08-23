import { ArcadeClient } from "@/components/gaffer/arcade/ArcadeClient";

export const metadata = { title: "The Arcade" };

export default function ArcadePage() {
  return (
    <div className="space-y-4">
      {/* broadcast lower-third — match-graphic header per style guide §7 */}
      <header className="flex overflow-hidden rounded-[4px] card-lift" aria-label="The Arcade">
        <span aria-hidden className="skewed w-[12px] shrink-0 scale-x-[1.4]" style={{ background: "var(--volt)" }} />
        <div
          className="flex flex-1 flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 md:px-5"
          style={{ background: "linear-gradient(180deg,var(--bg-overlay),var(--bg-raised))" }}
        >
          <div>
            <h1 className="fig-num text-[22px] leading-none">The Arcade</h1>
            <p className="upper-label mt-1.5 text-2xs text-ink-lo">Pick your gaffer · the voice follows you across the app</p>
          </div>
        </div>
      </header>

      <ArcadeClient />
    </div>
  );
}
