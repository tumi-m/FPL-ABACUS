import Image from "next/image";
import { Wordmark } from "@/components/gaffer/Wordmark";
import { TeamIdGate } from "@/components/gaffer/TeamIdGate";
import { HeroLineup } from "@/components/gaffer/HeroLineup";

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
      <section className="relative flex flex-col items-center justify-center px-4 pb-14 pt-[18dvh] text-center md:pt-[20dvh]">
        <Wordmark className="text-4xl drop-shadow-[0_4px_18px_rgba(0,0,0,.55)] md:text-6xl" />
        <p className="sr-only">Enter your FPL team ID to continue</p>
        <div className="mt-8 flex w-full justify-center">
          <TeamIdGate next={target} />
        </div>
      </section>

      {/* the gaffer lineup — animated, selectable, arms the console */}
      <HeroLineup />

      {/* the match ball — full-bleed broadcast band closing the page */}
      <section aria-hidden className="relative h-[38dvh] min-h-[260px] md:h-[48dvh]">
        <Image
          src="/images/ball.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg,var(--landing-c),transparent 34%)" }}
        />
      </section>
    </div>
  );
}
