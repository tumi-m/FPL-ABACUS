import Image from "next/image";
import { brand } from "@/config/brand";
import { Wordmark } from "@/components/gaffer/Wordmark";
import { TeamIdGate } from "@/components/gaffer/TeamIdGate";
import { HeroLineup } from "@/components/gaffer/HeroLineup";
import { ClubMap } from "@/components/gaffer/ClubMap";
import { LandingStatus } from "@/components/gaffer/LandingStatus";

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ background: "linear-gradient(180deg,var(--landing-a),var(--landing-b) 46%,var(--landing-c))" }}
    >
      {/* FIFA-menu atmosphere — diagonal electric sweeps over the floodlight ramp */}
      <div aria-hidden className="landing-atmos" />

      {/* floodlit hero — the 4K trophy under the wordmark and gate */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-4 pb-14 pt-[12dvh] text-center md:pb-20 md:pt-[14dvh]">
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
          {/* the menu cuts ride over the photo — softer than the page field */}
          <div aria-hidden className="landing-atmos opacity-70" />
          {/* and a top wash, so the wordmark reads against the bright trophy */}
          <div
            className="absolute inset-x-0 top-0 h-[62%]"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in oklab, var(--landing-b) 72%, transparent) 0%, color-mix(in oklab, var(--landing-b) 46%, transparent) 55%, transparent 100%)",
            }}
          />
        </div>
        {/* One scrim behind the whole copy column: the trophy is bright silver
            in places, so drop shadows alone cannot carry body text over it. */}
        <div className="relative z-10 flex w-full max-w-[640px] flex-col items-center rounded-2xl bg-black/45 px-5 py-8 backdrop-blur-[3px] md:px-10 md:py-10">
          <Wordmark className="text-4xl md:text-6xl" />
          <p className="mt-3 max-w-[26ch] text-lg font-semibold text-white/95 md:text-xl">
            {brand.tagline}
          </p>
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-white/80">
            {brand.description}
          </p>
          {/* the week's state, where the status pill used to float over every
              app screen. It reads itself in after hydration so this page stays
              static and the gate — the one thing here that has to be instant —
              never waits on the FPL API. */}
          <LandingStatus />
          <p className="sr-only">Enter your FPL team ID to continue</p>
          <div className="mt-7 flex w-full justify-center">
            <TeamIdGate next={target} />
          </div>
          <p className="mt-5 text-2xs uppercase-label text-white/55">
            Free · no account · read-only, your team is never changed
          </p>
        </div>
      </section>

      {/* what you actually get — named, not hinted at */}
      <FeatureBand />

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
        <div aria-hidden className="landing-atmos opacity-60" />
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

const FEATURES = [
  {
    title: "Transfer Planner",
    body:
      "Your pitch and the whole market side by side. Tap who leaves, tap who arrives — the desk prices the move over six gameweeks, counts the hit and refuses anything the rules would.",
  },
  {
    title: "Fixture ticker",
    body:
      "Twenty clubs against the run ahead, ranked by how kind it is. Doubles stack, blanks score nothing, and the clubs you already own are marked.",
  },
  {
    title: "Matchday",
    body:
      "Live points, provisional bonus and projected autosubs while the games are on — plus what each of them is doing to your rank, not just your score.",
  },
  {
    title: "Price watch",
    body:
      "Who is closest to a rise or a fall tonight, read off live transfer traffic and labelled honestly as the estimate it is.",
  },
];

function FeatureBand() {
  return (
    <section
      aria-label="What Gaffer does"
      className="mx-auto max-w-[1100px] px-4 pb-4 pt-10 md:pt-14"
    >
      <h2 className="text-center upper-label text-2xs text-white/50">
        Four screens, one question — what should I do next?
      </h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <li
            key={f.title}
            className="rounded-lg glass-dark p-4"
          >
            <h3 className="fig-num text-base leading-none text-white/95">{f.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-white/65">{f.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
