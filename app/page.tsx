import Link from "next/link";
import { Wordmark } from "@/components/gaffer/Wordmark";

export default function Landing() {
  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="text-center max-w-md">
        <Wordmark className="text-3xl justify-center" />
        <p className="mt-4 text-lg text-ink-2">Your gameweek, explained.</p>
        <Link
          href="/live"
          className="mt-8 inline-flex h-12 items-center rounded-md bg-brand px-6 text-base font-medium text-brand-ink transition-colors dur-instant hover:bg-brand/90"
        >
          Open Matchday
        </Link>
        <p className="mt-4 text-xs text-ink-3">Full entry experience arrives with Phase 5.</p>
      </div>
    </div>
  );
}
