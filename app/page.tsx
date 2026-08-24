import Image from "next/image";
import { Wordmark } from "@/components/gaffer/Wordmark";
import { TeamIdGate } from "@/components/gaffer/TeamIdGate";
import { HeroLineup } from "@/components/gaffer/HeroLineup";
import { ClubMap } from "@/components/gaffer/ClubMap";

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return (
    <div
      className="min-h-dvh"
      style={{ background: "linear-gradient(180deg,var(--landing-a),var(--landing-b) 46%,var(--landing-c))" }}
    >
      {/* floodlit hero — the 4K trophy under the wordmark and gate */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-4 pb-6 pt-[14dvh] text-center md:pt-[16dvh]">
        <div aria-hidden className="absolute inset-0">
          <Image
            src="/images/trophy-4k.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          {/* legibility washes — the ramp shows through at both ends */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, var(--landing-a) 0%, color-mix(in oklab, var(--landing-a) 55%, transparent) 22%, transparent 46%, transparent 64%, var(--landing-b) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 34%, transparent 38%, color-mix(in oklab, var(--landing-b) 78%, transparent) 100%)",
            }}
          />
        </div>
        <div className="relative z-10 flex w-full flex-col items-center">
          <Wordmark className="text-4xl drop-shadow-[0_4px_18px_rgba(0,0,0,.55)] md:text-6xl" />
          <p className="sr-only">Enter your FPL team ID to continue</p>
          <div className="mt-8 flex w-full justify-center">
            <TeamIdGate next={target} />
          </div>
        </div>
      </section>

      {/* the club map — every crest pinned home, tap to tint */}
      <ClubMap />

      {/* the gaffer lineup — animated, selectable, arms the console */}
      <HeroLineup />

      {/* the match ball — broadcast band closing the page */}
      <section aria-hidden className="relative h-[42dvh] min-h-[300px] overflow-hidden md:h-[50dvh]">
        <Image
          src="/images/ball.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, var(--landing-c) 0%, transparent 18%, transparent 78%, var(--landing-c) 100%), linear-gradient(180deg, var(--landing-c) 0%, transparent 24%, transparent 62%, var(--landing-c) 98%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-5 text-center">
          <p className="upper-label text-2xs text-white/55">Beat your week. Know why.</p>
        </div>
      </section>
    </div>
  );
}
