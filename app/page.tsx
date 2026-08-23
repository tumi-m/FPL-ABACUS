import Image from "next/image";
import { Wordmark } from "@/components/gaffer/Wordmark";
import { TeamIdGate } from "@/components/gaffer/TeamIdGate";
import { SwingBars } from "@/components/charts/SwingBars";

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex min-h-[78dvh] max-w-2xl flex-col items-center justify-center px-4 text-center">
        <Wordmark className="text-3xl" />
        {/* the prize you're playing for — photo supplied by the owner */}
        <Image
          src="/images/trophy.jpeg"
          alt="The Premier League trophy"
          width={216}
          height={270}
          priority
          className="mt-8 h-[216px] w-[173px] rounded-lg object-cover card-ring has-gloss"
        />
        <div className="mt-8 flex w-full justify-center">
          <TeamIdGate next={target} />
        </div>
      </div>

      <section aria-label="What GAFFER shows" className="mx-auto max-w-[1360px] px-4 pb-10 md:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <PreviewCard title="Swing Engine" line="Every scoring event, priced in your ranks.">
            <SwingBars
              rows={[
                { label: "Saka assist", value: 86_400 },
                { label: "Gabriel bonus", value: -18_200 },
                { label: "Haaland goal", value: 55_100 },
              ]}
              ariaLabel="Sample swing bars"
            />
          </PreviewCard>
          <PreviewCard title="Leverage Board" line="If he scores — and what it costs you if the field's man does.">
            <div className="space-y-2 text-sm num-tabular">
              <Row label="Haaland (C)" value="+142k" good />
              <Row label="Gabriel CS" value="+55k" good />
              <Row label="Palmer (threat)" value="\u221296k" />
            </div>
          </PreviewCard>
          <PreviewCard title="Multiverse" line="The captain you didn't pick. The transfer you didn't roll. Each priced in ranks.">
            <div className="space-y-2 text-sm num-tabular">
              <Row label="Captain Haaland instead" value="+214k" good />
              <Row label="Roll the transfer" value="+31k" good />
              <Row label="Kept Mbeumo" value={"\u221212k"} />
            </div>
          </PreviewCard>
        </div>

        {/* the match ball — fills the closing whitespace as a broadcast band */}
        <Image
          src="/images/ball.webp"
          alt="The match ball on the turf"
          width={1440}
          height={810}
          className="mt-6 h-40 w-full rounded-lg object-cover card-ring has-gloss md:h-56"
        />
      </section>
    </div>
  );
}

function PreviewCard({ title, line, children }: { title: string; line: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-1 card-ring p-5">
      <h2 className="text-base font-medium tracking-tight">{title}</h2>
      <p className="mt-1 mb-4 text-sm leading-relaxed text-ink-3">{line}</p>
      {children}
    </div>
  );
}

function Row({ label, value, good = false }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-hairline pb-1.5 last:border-0 last:pb-0">
      <span className="text-ink-2">{label}</span>
      <span className={`font-medium ${good ? "text-good" : "text-critical"}`}>{value}</span>
    </div>
  );
}
