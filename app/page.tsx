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
      {/* floodlit hero — wordmark over the gate, no photo */}
      <section className="relative flex flex-col items-center justify-center px-4 pb-6 pt-[14dvh] text-center md:pt-[16dvh]">
        <Wordmark className="text-4xl drop-shadow-[0_4px_18px_rgba(0,0,0,.55)] md:text-6xl" />
        <p className="sr-only">Enter your FPL team ID to continue</p>
        <div className="mt-8 flex w-full justify-center">
          <TeamIdGate next={target} />
        </div>
      </section>

      {/* the club map — every crest pinned home, tap to tint */}
      <ClubMap />

      {/* the gaffer lineup — animated, selectable, arms the console */}
      <HeroLineup />

      {/* 4K action art + the match ball — paired broadcast band closing the page */}
      <section aria-hidden className="relative h-[46dvh] min-h-[320px] overflow-hidden md:h-[54dvh]">
        <div className="grid h-full md:grid-cols-[62%_38%]">
          <div className="relative">
            <Image
              src="/images/kofi-ball.jpg"
              alt=""
              fill
              sizes="(min-width: 768px) 62vw, 100vw"
              className="object-cover object-top"
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(90deg, var(--landing-c) 0%, transparent 18%, transparent 78%, var(--landing-c) 100%), linear-gradient(180deg, var(--landing-c) 0%, transparent 22%)" }}
            />
          </div>
          <div className="relative hidden md:block">
            <Image
              src="/images/ball.webp"
              alt=""
              fill
              sizes="38vw"
              className="object-cover object-center"
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(90deg, var(--landing-c) 0%, transparent 30%), linear-gradient(0deg, var(--landing-c) 8%, transparent 40%)" }}
            />
          </div>
        </div>
        <div
          className="absolute inset-0 md:hidden"
          style={{ background: "linear-gradient(180deg, var(--landing-c) 0%, transparent 30%, transparent 60%, var(--landing-c) 96%)" }}
        />
        <div className="absolute inset-x-0 bottom-5 text-center">
          <p className="upper-label text-2xs text-white/55">Beat your week. Know why.</p>
        </div>
      </section>
    </div>
  );
}
