import Image from "next/image";
import { Wordmark } from "@/components/gaffer/Wordmark";
import { TeamIdGate } from "@/components/gaffer/TeamIdGate";
import { GafferShowcase } from "@/components/gaffer/GafferShowcase";

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
      {/* full-bleed trophy hero — the prize fills the viewport edge to edge */}
      <section className="relative flex h-[64dvh] min-h-[440px] flex-col md:h-[76dvh]">
        <Image
          src="/images/trophy.jpeg"
          alt="The Premier League trophy"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* blend the photo into the floodlight ramp; keeps the gate legible */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg,rgba(0,0,0,.18),transparent 32%,transparent 52%,var(--landing-b) 96%)",
          }}
        />
        <div className="relative mt-auto flex w-full flex-col items-center px-4 pb-10 text-center md:pb-14">
          <Wordmark className="text-4xl drop-shadow-[0_4px_18px_rgba(0,0,0,.55)] md:text-5xl" />
          <p className="sr-only">Enter your FPL team ID to continue</p>
          <div className="mt-6 flex w-full justify-center">
            <TeamIdGate next={target} />
          </div>
        </div>
      </section>

      {/* the four gaffers — pick a voice, arm the console */}
      <GafferShowcase />

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
