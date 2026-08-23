import Link from "next/link";
import { Wordmark } from "@/components/gaffer/Wordmark";
import { COPY } from "@/lib/copy/deck";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <Wordmark className="text-2xl justify-center" />
        <h1 className="mt-6 text-xl font-semibold tracking-tight">{COPY.notFound.title}</h1>
        <p className="mt-1 text-sm text-ink-3">{COPY.notFound.body}</p>
        <Link href="/live" className="mt-6 inline-flex h-10 items-center rounded-md bg-brand px-5 text-sm font-medium text-brand-ink hover:bg-brand/90">
          Back to Matchday
        </Link>
      </div>
    </div>
  );
}
