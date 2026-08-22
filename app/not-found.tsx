import Link from "next/link";
import { Wordmark } from "@/components/gaffer/Wordmark";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <Wordmark className="text-2xl justify-center" />
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Nothing at this address</h1>
        <p className="mt-1 text-sm text-ink-3">The page moved, or never existed.</p>
        <Link href="/live" className="mt-6 inline-flex h-10 items-center rounded-md bg-brand px-5 text-sm font-medium text-brand-ink hover:bg-brand/90">
          Back to Matchday
        </Link>
      </div>
    </div>
  );
}
